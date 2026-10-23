import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openCheckpointStore } from '../../src/features/resumes/workflow/checkpoint-store';
import { createResumeAgent, invokeResumeAgent } from '../../src/features/resumes/agent/graph';
import { executeAgentTool, type ToolState } from '../../src/features/resumes/agent/tools';
import { MAX_AGENT_CALLS, traceSchema, type AgentMessage, type ToolCall } from '../../src/features/resumes/agent/contracts';

const input = {targetRole: '后端', jdText: '接口开发', materials: [{materialId: 1, type: 'project' as const, title: '项目', tags: [], content: {projectCategory: '后端', techStack: [], content: '开发接口'}}]};
const plan = [{title: '核对岗位要求与素材后改写', status: 'in_progress' as const}];
const call = (name: string, args: unknown): ToolCall => ({id: `call_${name}`, type: 'function', function: {name, arguments: JSON.stringify(args)}});
const turn = (name: string, args: unknown) => ({message: {role: 'assistant', content: null, tool_calls: [call(name, args)]} as AgentMessage});
const proposed = (quote = '开发接口') => ({materialId: 1, proposedContent: {...input.materials[0].content, content: '完成接口开发'}, rationale: '突出接口开发经历', evidence: [{materialId: 1, source: 'material', quote}]});
const run = {id: 'agent-test', inputJson: JSON.stringify(input)};
const state = (): ToolState => ({input, plan, readIds: [1], facts: {}, questionsAsked: 0, suggestions: [], evidence: []});

test('agent tools enforce scope, plan, fixed fields, and source provenance', () => {
  assert.match(JSON.stringify(executeAgentTool(state(), call('read_materials', {materialIds: [99]})).response), /已选/);
  assert.match(JSON.stringify(executeAgentTool({...state(), plan: []}, call('propose_changes', {suggestions: [proposed()]})).response), /计划/);
  for (const bad of [
    proposed('提升吞吐量 200%'),
    {...proposed(), proposedContent: {...proposed().proposedContent, techStack: ['Redis']}},
    {...proposed(), materialId: 99},
    {...proposed(), evidence: [{materialId: 99, source: 'material', quote: '开发接口'}]},
    {...proposed(), evidence: [{materialId: 1, source: 'user_facts', quote: '开发接口'}]},
  ]) {
    const result = executeAgentTool(state(), call('propose_changes', {suggestions: [bad]}));
    assert.equal(result.update?.suggestions?.length ?? 0, 0);
    assert.match(JSON.stringify(result.response), /issues|error/);
  }
  const result = executeAgentTool(state(), call('propose_changes', {suggestions: [proposed()]}));
  assert.equal(result.update?.suggestions?.length, 1);
  assert.equal(result.update?.evidence?.[0].quote, '开发接口');
  assert.match(JSON.stringify(executeAgentTool(state(), call('execute_shell', {command: 'anything'})).response), /允许列表/);
});

test('invalid JSON is returned as tool feedback and the model repairs it within the same run', async () => {
  const store = openCheckpointStore(':memory:');
  const turns = [turn('write_plan', {steps: plan}), turn('read_materials', {materialIds: [1]}), {message: {role: 'assistant', content: null, tool_calls: [{...call('propose_changes', {}), function: {name: 'propose_changes', arguments: '{broken'}}]} as AgentMessage}, turn('propose_changes', {suggestions: [proposed()]})];
  let calls = 0;
  try {
    const graph = createResumeAgent({checkpointer: store, generate: async messages => {
      if (calls === 3) assert.match(JSON.stringify(messages.at(-1)), /有效 JSON/);
      return turns[calls++];
    }});
    const result = await invokeResumeAgent(graph, run, false);
    assert.equal(result.waiting, false);
    if (result.waiting) return;
    assert.equal(calls, 4);
    assert.deepEqual(result.output.fallbackMaterialIds, []);
    assert.deepEqual(result.output.suggestions[0].proposedContent, proposed().proposedContent);
    assert.equal(traceSchema.safeParse(result.output).success, true);
    await invokeResumeAgent(graph, run, true);
    assert.equal(calls, 4, 'reopening completed checkpoints must not regenerate');
  } finally {store.db.close();}
});

test('agent pauses on a concrete question and resumes from disk without repeating completed tools', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'ownspace-agent-'));
  const path = join(directory, 'checkpoints.db');
  let store = openCheckpointStore(path);
  let calls = 0;
  try {
    const turns = [turn('write_plan', {steps: plan}), turn('read_materials', {materialIds: [1]}), turn('request_user_facts', {materialId: 1, question: '接口是否经过测试？'})];
    const first = createResumeAgent({checkpointer: store, generate: async () => turns[calls++]});
    assert.equal((await invokeResumeAgent(first, run, false)).waiting, true);
    store.db.close();
    store = openCheckpointStore(path);
    const second = createResumeAgent({checkpointer: store, generate: async messages => {
      calls++;
      assert.match(JSON.stringify(messages.at(-1)), /通过单元测试/);
      return turn('propose_changes', {suggestions: [{...proposed(), proposedContent: {...proposed().proposedContent, content: '开发接口并通过单元测试'}, evidence: [{materialId: 1, source: 'user_facts', quote: '通过单元测试'}]}]});
    }});
    assert.equal((await invokeResumeAgent(second, run, true)).waiting, true);
    assert.equal(calls, 3);
    const result = await invokeResumeAgent(second, run, true, '通过单元测试');
    assert.equal(result.waiting, false);
    if (result.waiting) return;
    assert.equal(calls, 4);
    assert.equal(result.output.questionsAsked, 1);
    assert.equal(result.output.facts['1'], '通过单元测试');
    assert.deepEqual(result.output.fallbackMaterialIds, []);
  } finally {store.db.close(); rmSync(directory, {recursive: true, force: true});}
});

test('explicitly skipping a question continues without treating recovery itself as a skip', async () => {
  const store = openCheckpointStore(':memory:');
  let calls = 0;
  const turns = [turn('read_materials', {materialIds: [1]}), turn('request_user_facts', {materialId: 1, question: '有结果数据吗？'}), turn('finish', {})];
  try {
    const graph = createResumeAgent({checkpointer: store, generate: async messages => {
      if (calls === 2) assert.match(JSON.stringify(messages.at(-1)), /skipped/);
      return turns[calls++];
    }});
    assert.equal((await invokeResumeAgent(graph, run, false)).waiting, true);
    const result = await invokeResumeAgent(graph, run, true, '');
    assert.equal(result.waiting, false);
    if (!result.waiting) {
      assert.deepEqual(result.output.fallbackMaterialIds, [1]);
      assert.deepEqual(result.output.suggestions[0].proposedContent, input.materials[0].content);
    }
  } finally {store.db.close();}
});

test('repeated invalid actions exhaust the bounded loop and preserve original content', async () => {
  const store = openCheckpointStore(':memory:');
  let calls = 0;
  try {
    const graph = createResumeAgent({checkpointer: store, generate: async () => {calls++; return turn('unknown', {});}});
    const result = await invokeResumeAgent(graph, run, false);
    assert.equal(result.waiting, false);
    assert.equal(calls, MAX_AGENT_CALLS);
    if (!result.waiting) {
      assert.deepEqual(result.output.fallbackMaterialIds, [1]);
      assert.deepEqual(result.output.suggestions[0].proposedContent, input.materials[0].content);
    }
  } finally {store.db.close();}
});

test('partial batches keep valid results while repairing another material', () => {
  const current = {...state(), input: {...input, materials: [...input.materials, {...input.materials[0], materialId: 2}]}, readIds: [1, 2]};
  const result = executeAgentTool(current, call('propose_changes', {suggestions: [proposed(), {...proposed('不存在的证据'), materialId: 2}]}));
  assert.deepEqual(result.update?.suggestions?.map(item => item.materialId), [1]);
  const retained = {...current, ...result.update};
  const correction = executeAgentTool(retained, call('propose_changes', {suggestions: [{...proposed(), materialId: 2, evidence: [{materialId: 2, source: 'material', quote: '开发接口'}]}]}));
  assert.deepEqual(correction.update?.suggestions?.map(item => item.materialId), [1, 2]);
});
