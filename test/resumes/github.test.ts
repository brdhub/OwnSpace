import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../../src/db/schema';
import { createGithubClient, allowedPath } from '../../src/features/resumes/github/client';
import { MAX_MODEL_CALLS, MAX_GITHUB_REQUESTS, parseRepositoryUrl, validateDraft, startSchema, type RepositorySnapshot } from '../../src/features/resumes/github/contracts';
import { createGithubGraph, invokeGithubGraph } from '../../src/features/resumes/github/graph';
import { createGithubStore, emptyView, LEASE_MS } from '../../src/features/resumes/github/store';
import { openCheckpointStore } from '../../src/features/resumes/workflow/checkpoint-store';
import { requestAgentTurn } from '../../src/features/resumes/agent/provider';
import { githubTools } from '../../src/features/resumes/github/contracts';
import type { AgentMessage } from '../../src/features/resumes/agent/contracts';

const input = startSchema.parse({repositoryUrl: 'https://github.com/example/project', targetRole: '后端', jdText: '接口开发', consent: 'on'});
const source = {path: 'src/server.ts', text: 'export function getUser() {\n  return {id: 1};\n}'};
const repository: RepositorySnapshot = {owner: 'example', repo: 'project', url: input.repositoryUrl, commit: 'a'.repeat(40), description: '测试项目', files: [{path: source.path, sha: 'b'.repeat(40), size: 100}], omitted: 0};
const draft = {title: '示例项目', projectCategory: '后端', techStack: ['TypeScript'], bullets: [{text: '实现用户信息读取函数。', evidence: [{path: source.path, startLine: 1, endLine: 3, quote: source.text}]}], rationale: '突出接口开发相关能力'};
const turn = (name: string, args: unknown) => ({message: {role: 'assistant', content: null, tool_calls: [{id: `call-${name}`, type: 'function', function: {name, arguments: JSON.stringify(args)}}]} as AgentMessage});
const firstTurns = () => [turn('write_plan', {steps: ['核对接口实现']}), turn('read_repository_files', {paths: [source.path]}), turn('request_user_facts', {question: '你负责哪些模块？'})];

test('GitHub URL and file policies reject off-site, traversal, secret and generated inputs', () => {
  assert.equal(parseRepositoryUrl('https://github.com/example/project.git').url, input.repositoryUrl);
  for (const url of ['http://github.com/a/b', 'https://github.com.evil.test/a/b', 'https://user@github.com/a/b', 'https://github.com/a/b/tree/main', 'https://github.com/a/b?token=x', 'https://127.0.0.1/a/b']) assert.throws(() => parseRepositoryUrl(url));
  for (const path of ['.env', '.env.local', 'src/credentials.json', '../secret.ts', 'node_modules/x.ts', 'package-lock.json', 'image.png']) assert.equal(allowedPath(path), false, path);
  assert.equal(allowedPath('src/workflow.ts'), true);
  assert.equal(startSchema.safeParse({...input, consent: undefined}).success, false);
});

test('client reads immutable commit/blob, excludes symlinks and refuses unlisted files', async () => {
  const requests: string[] = [];
  let reserved = 0;
  const outputs = [{private: false, default_branch: 'feature/main', description: null}, {sha: repository.commit}, {truncated: false, tree: [{path: source.path, mode: '100644', type: 'blob', sha: 'b'.repeat(40), size: 100}, {path: 'link.ts', mode: '120000', type: 'blob', sha: 'c'.repeat(40), size: 10}]}, {encoding: 'base64', content: Buffer.from(source.text).toString('base64'), size: source.text.length}];
  const client = createGithubClient(() => {reserved++;}, (async (url, options) => {
    requests.push(String(url)); assert.equal(options?.redirect, 'error'); assert.equal(new URL(String(url)).hostname, 'api.github.com');
    return Response.json(outputs.shift());
  }) as typeof fetch);
  const snapshot = await client.inspect(input.repositoryUrl);
  assert.equal(snapshot.files.length, 1);
  assert.match(requests[1], /feature%2Fmain$/);
  assert.match(requests[2], new RegExp(repository.commit));
  assert.deepEqual(await client.read(snapshot, source.path), source);
  assert.match(requests[3], /git\/blobs\/b{40}$/);
  await assert.rejects(client.read(snapshot, 'link.ts'), /允许/);
  assert.equal(reserved, 4);
});

test('client surfaces rate limits, truncated trees and refuses oversized or secret file responses', async () => {
  await assert.rejects(createGithubClient(() => {}, (async () => new Response('', {status: 429})) as typeof fetch).inspect(input.repositoryUrl), /额度/);
  const outputs = [{private: false, default_branch: 'main', description: null}, {sha: repository.commit}, {truncated: true, tree: []}];
  await assert.rejects(createGithubClient(() => {}, (async () => Response.json(outputs.shift())) as typeof fetch).inspect(input.repositoryUrl), /过大/);
  for (const content of ['-----BEGIN PRIVATE KEY-----', 'x'.repeat(60_000)]) {
    const client = createGithubClient(() => {}, (async () => Response.json({encoding: 'base64', size: content.length, content: Buffer.from(content).toString('base64')})) as typeof fetch);
    await assert.rejects(client.read(repository, source.path));
  }
});

test('evidence validation rejects invented files, line ranges, quotes, and empty evidence', () => {
  assert.deepEqual(validateDraft(draft, [source]), draft);
  for (const ref of [{...draft.bullets[0].evidence[0], path: 'README.md'}, {...draft.bullets[0].evidence[0], startLine: 2}, {...draft.bullets[0].evidence[0], endLine: 99}, {...draft.bullets[0].evidence[0], quote: '提升性能50%'}]) assert.throws(() => validateDraft({...draft, bullets: [{...draft.bullets[0], evidence: [ref]}]}, [source]));
  assert.throws(() => validateDraft({...draft, bullets: [{text: '无依据', evidence: []}]}, [source]));
});

test('graph persists on disk, requires contribution confirmation and repairs bad evidence after resume', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'github-agent-'));
  const path = join(folder, 'checkpoint.db');
  let saver = openCheckpointStore(path);
  let requests = 0;
  let calls = 0;
  const client = {inspect: async () => {requests++; return repository;}, read: async () => {requests++; return source;}};
  try {
    const turns = [turn('propose_resume_entry', draft), ...firstTurns()];
    let graph = createGithubGraph({checkpointer: saver, client, reserveCall: () => {calls++;}, generate: async messages => {
      if (turns.length === 3) assert.match(JSON.stringify(messages.at(-1)), /必须先/);
      return turns.shift()!;
    }});
    assert.equal((await invokeGithubGraph(graph, 'test', input)).waiting, true);
    const previousCalls = calls;
    saver.db.close(); saver = openCheckpointStore(path);
    const resumedTurns = [turn('propose_resume_entry', {...draft, bullets: [{...draft.bullets[0], evidence: [{...draft.bullets[0].evidence[0], quote: '不存在的代码'}]}]}), turn('propose_resume_entry', draft)];
    graph = createGithubGraph({checkpointer: saver, client, reserveCall: () => {calls++;}, generate: async messages => {
      if (resumedTurns.length === 2) assert.match(JSON.stringify(messages.at(-1)), /负责接口/);
      else assert.match(JSON.stringify(messages.at(-1)), /引用必须/);
      return resumedTurns.shift()!;
    }});
    assert.equal((await invokeGithubGraph(graph, 'test', input)).waiting, true);
    assert.equal(calls, previousCalls);
    const result = await invokeGithubGraph(graph, 'test', input, '负责接口');
    assert.equal(result.waiting, false);
    assert.equal(result.view.facts, '负责接口');
    assert.deepEqual(result.view.draft, draft);
    assert.equal(requests, 2, 'resume must use cached repository/files');
    await invokeGithubGraph(graph, 'test', input);
    assert.equal(resumedTurns.length, 0);
  } finally {saver.db.close(); rmSync(folder, {recursive: true, force: true});}
});

test('graph permits explicit contribution skip and stops repeated invalid calls at budget', async () => {
  const saver = openCheckpointStore(':memory:');
  const client = {inspect: async () => repository, read: async () => source};
  try {
    const turns = [...firstTurns(), turn('propose_resume_entry', draft)];
    const graph = createGithubGraph({checkpointer: saver, client, reserveCall: () => {}, generate: async () => turns.shift()!});
    await invokeGithubGraph(graph, 'skip', input);
    const result = await invokeGithubGraph(graph, 'skip', input, '');
    assert.equal(result.view.facts, ''); assert.deepEqual(result.view.draft, draft);
    let count = 0;
    const bounded = createGithubGraph({checkpointer: saver, client, reserveCall: () => {count++;}, generate: async () => turn('shell', {})});
    await assert.rejects(invokeGithubGraph(bounded, 'bounded', input), /上限/);
    assert.equal(count, MAX_MODEL_CALLS);
  } finally {saver.db.close();}
});

test('persistent reservations survive retries and reject concurrent or stale owners; acceptance is idempotent', () => {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, {schema});
  migrate(db, {migrationsFolder: 'drizzle'});
  let time = Date.now();
  const store = createGithubStore(db, () => time);
  try {
    const created = store.create(input);
    const first = store.claim(created.id);
    assert.throws(() => store.claim(created.id), /正在/);
    store.reserve(first, 'model'); store.reserve(first, 'github');
    time += LEASE_MS + 1;
    const second = store.claim(created.id);
    assert.throws(() => store.reserve(first, 'model'), /执行权/);
    for (let i = 1; i < MAX_MODEL_CALLS; i++) store.reserve(second, 'model');
    assert.throws(() => store.reserve(second, 'model'), /上限/);
    for (let i = 1; i < MAX_GITHUB_REQUESTS; i++) store.reserve(second, 'github');
    assert.throws(() => store.reserve(second, 'github'), /上限/);
    const entry = {type: 'project', title: draft.title, tags: [], content: {projectCategory: draft.projectCategory, techStack: draft.techStack, content: draft.bullets[0].text, responsibilities: ''}};
    assert.throws(() => store.accept(created.id, entry), /完成草稿/);
    store.finish(second, 'completed', {...emptyView(), repository, files: [source], draft});
    const savedId = store.accept(created.id, entry);
    assert.equal(store.accept(created.id, entry), savedId);
    assert.equal(db.select().from(schema.resumeEntries).all().length, 1);
    assert.throws(() => store.claim(created.id), /完成/);
  } finally {sqlite.close();}
});

test('provider uses GitHub tool registry without changing existing resume tools', async () => {
  await requestAgentTurn([{role: 'user', content: 'test'}], {env: {DEEPSEEK_API_KEY: 'test'}, fetch: (async (_, options) => {
    const body = JSON.parse(String(options?.body));
    assert.deepEqual(body.tools, githubTools);
    assert.equal(body.tools.some((tool: {function: {name: string}}) => tool.function.name === 'read_materials'), false);
    return Response.json({choices: [{finish_reason: 'tool_calls', message: turn('write_plan', {steps: ['plan']}).message}]});
  }) as typeof fetch}, githubTools);
});
