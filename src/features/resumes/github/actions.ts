'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/db';
import { getDeepSeekConfig } from '../deepseek-core';
import { requestAgentTurn } from '../agent/provider';
import { getCheckpointStore } from '../workflow/checkpoint-store';
import { createGithubClient } from './client';
import { githubTools, startSchema } from './contracts';
import { createGithubGraph, invokeGithubGraph } from './graph';
import { createGithubStore } from './store';

export type GithubActionState = {success: boolean; runId?: string; message?: string};
const store = () => createGithubStore(db);
const refresh = () => {revalidatePath('/resumes/github'); revalidatePath('/resumes');};
const errorMessage = (error: unknown) => error instanceof z.ZodError ? error.issues.map(item => item.message).slice(0, 3).join('；') : error instanceof Error ? error.message : '处理失败，请稍后重试。';

async function execute(id: string, answer?: string): Promise<GithubActionState> {
  const service = store();
  const run = service.claim(id);
  try {
    const graph = createGithubGraph({
      checkpointer: getCheckpointStore(),
      client: createGithubClient(() => service.reserve(run, 'github')),
      generate: messages => requestAgentTurn(messages, {}, githubTools),
      reserveCall: () => service.reserve(run, 'model'),
      publish: view => service.publish(run, view),
    });
    const result = await invokeGithubGraph(graph, id, startSchema.parse(JSON.parse(run.inputJson)), answer);
    service.finish(run, result.waiting ? 'waiting' : 'completed', result.view);
    return {success: true, runId: id, message: result.waiting ? '请补充个人贡献后继续。' : '项目草稿已生成，请核对证据并确认入库。'};
  } catch (error) {
    const message = errorMessage(error);
    service.finish(run, 'failed', undefined, message);
    return {success: false, runId: id, message};
  } finally {refresh();}
}

export async function startGithubAction(_previous: GithubActionState, form: FormData): Promise<GithubActionState> {
  try {
    const input = startSchema.parse(Object.fromEntries(form));
    getDeepSeekConfig();
    const run = store().create(input);
    return await execute(run.id);
  } catch (error) {return {success: false, message: errorMessage(error)};}
}

export async function resumeGithubAction(_previous: GithubActionState, form: FormData): Promise<GithubActionState> {
  try {
    const input = z.object({id: z.string().uuid(), facts: z.string().trim().max(4000).optional(), consent: z.literal('on')}).parse(Object.fromEntries(form));
    getDeepSeekConfig();
    return await execute(input.id, input.facts);
  } catch (error) {return {success: false, message: errorMessage(error)};}
}

export async function acceptGithubAction(_previous: GithubActionState, form: FormData): Promise<GithubActionState> {
  try {
    const input = z.object({id: z.string().uuid(), title: z.string(), projectCategory: z.string(), techStack: z.string(), content: z.string(), responsibilities: z.string(), confirmed: z.literal('on')}).parse(Object.fromEntries(form));
    store().accept(input.id, {type: 'project', title: input.title, content: {projectCategory: input.projectCategory, techStack: input.techStack.split(/[,，\n]/).map(item => item.trim()).filter(Boolean), content: input.content, responsibilities: input.responsibilities}, tags: []});
    refresh();
    return {success: true, runId: input.id, message: '已保存为简历仓库的项目条目，可以在 JD 匹配中选用。'};
  } catch (error) {return {success: false, message: errorMessage(error)};}
}
