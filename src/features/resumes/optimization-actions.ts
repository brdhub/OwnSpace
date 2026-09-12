"use server";

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/db';
import { resumeEntries } from '@/db/schema';
import type { ResumeActionState } from './actions';
import { getDeepSeekConfig, DeepSeekError, recommendEntriesForJd } from './deepseek';
import { parseResumeEntryContent, parseResumeEntryTags, saveJdSelectionSchema, updateOptimizationSuggestionStateSchema } from './schema';
import { createTaskService, manualTaskSchema } from './workflow/task-service';
import { assertPromptBudget } from './workflow/optimization-graph';
import { startResumableOptimizationAction } from './workflow/recovery-actions';

const service = createTaskService(db);
const revisionSchema = z.coerce.number().int().positive();
const runSchema = z.object({ taskId: z.coerce.number().int().positive(), inputRevision: revisionSchema });
function result(error: unknown): ResumeActionState {
  return { success: false, message: error instanceof z.ZodError ? error.issues.map(issue => issue.message).join('；') : error instanceof Error ? error.message : '操作失败，请重试。' };
}
function refresh() { revalidatePath('/resumes', 'layout'); }

export async function saveJdTaskAction(_previous: ResumeActionState, formData: FormData): Promise<ResumeActionState> {
  try {
    const task = service.saveTask(manualTaskSchema.parse(Object.fromEntries(formData)));
    refresh();
    return { success: true, taskId: task.id, message: '岗位已保存，可以手动选材。' };
  } catch (error) { return result(error); }
}

export async function saveJdMaterialSelectionAction(_previous: ResumeActionState, formData: FormData): Promise<ResumeActionState> {
  try {
    const parsed = saveJdSelectionSchema.parse(Object.fromEntries(formData));
    const revision = revisionSchema.parse(formData.get('inputRevision'));
    const task = service.saveSelection(parsed.taskId, revision, parsed.selectedEntryIds);
    refresh();
    return { success: true, taskId: task.id, message: `已保存 ${parsed.selectedEntryIds.length} 条素材。` };
  } catch (error) { return result(error); }
}

export async function runJdRecommendationAction(_previous: ResumeActionState, formData: FormData): Promise<ResumeActionState> {
  let run: ReturnType<typeof service.beginRun> | undefined;
  try {
    const parsed = runSchema.parse(Object.fromEntries(formData));
    const task = service.getTask(parsed.taskId);
    if (!task.jdText.trim()) throw new Error('请先填写并保存 JD，再使用 AI 推荐。');
    const entries = db.select().from(resumeEntries).all();
    if (!entries.length) throw new Error('请先添加正式条目。');
    const input = { targetRole: task.targetRole, jdText: task.jdText, formalEntries: entries.map(entry => ({ id: entry.id, type: entry.type, title: entry.title, content: parseResumeEntryContent(entry.contentJson), tags: parseResumeEntryTags(entry.tagsJson) })) };
    assertPromptBudget(input);
    const config = getDeepSeekConfig();
    run = service.beginRun(task.id, parsed.inputRevision, 'recommendation', input, config.model);
    const recommendations = await recommendEntriesForJd(input);
    const saved = service.finishRecommendations(run, recommendations);
    refresh();
    return { success: saved, taskId: task.id, message: saved ? '推荐已生成；可点击应用推荐选材，或保留当前选择。' : '任务输入已变化，本次结果未应用。' };
  } catch (error) {
    if (run) service.failRun(run, error instanceof DeepSeekError ? error.code : 'invalid_response');
    refresh(); return result(error);
  }
}

export async function runEntryDescriptionOptimizationAction(_previous: ResumeActionState, formData: FormData): Promise<ResumeActionState> {
  return startResumableOptimizationAction(_previous,formData);
}

export async function updateOptimizationSuggestionStateAction(_previous: ResumeActionState, formData: FormData): Promise<ResumeActionState> {
  try {
    const parsed = updateOptimizationSuggestionStateSchema.parse(Object.fromEntries(formData));
    const task = service.reviewSuggestion(parsed.suggestionId, parsed.state);
    refresh();
    return { success: true, taskId: task.id, message: parsed.state === 'pending' ? '已撤销，制作时保留原文。' : parsed.state === 'accepted' ? '已接受，生成新草稿时采用。' : '已忽略，保留原文。' };
  } catch (error) { return result(error); }
}
