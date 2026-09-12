import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import * as schema from '@/db/schema';
import { parseResumeEntryContent, parseResumeEntryTags, parseResumeMaterialSnapshot, stringifyResumeMaterialSnapshot } from '../schema';
import type { EntryOptimizationSuggestion, JdRecommendation } from '../ai-schema';

export const manualTaskSchema = z.object({
  taskId: z.coerce.number().int().positive().optional(),
  inputRevision: z.coerce.number().int().positive().optional(),
  applicationId: z.coerce.number().int().positive().optional(),
  targetRole: z.string().trim().min(1, '请填写目标岗位。').max(120),
  jdText: z.string().trim().max(20_000).default(''),
});
type Run = typeof schema.resumeAiRuns.$inferSelect;
const { resumeOptimizationTasks: tasks, resumeOptimizationMaterials: materials, resumeOptimizationSuggestions: suggestions, resumeAiRuns: runs } = schema;

export function createTaskService(database: BetterSQLite3Database<typeof schema>) {
  const now = () => new Date().toISOString();
  function getTask(id: number) {
    const task = database.select().from(tasks).where(eq(tasks.id, id)).get();
    if (!task) throw new Error('未找到岗位任务。');
    return task;
  }
  function checkRevision(id: number, revision: number) {
    const task = getTask(id);
    if (task.inputRevision !== revision) throw new Error('任务已更新，请刷新后重试。');
    return task;
  }
  function invalidate(id: number) {
    database.update(runs).set({ status: 'superseded', finishedAt: now() }).where(and(eq(runs.taskId, id), inArray(runs.status, ['running','waiting','failed','interrupted']))).run();
  }
  function saveTask(raw: z.input<typeof manualTaskSchema>) {
    const input = manualTaskSchema.parse(raw);
    return database.transaction(() => {
      if (input.taskId) {
        if (!input.inputRevision) throw new Error('任务已更新，请刷新后重试。');
        const task = checkRevision(input.taskId, input.inputRevision);
        if (input.applicationId !== undefined && input.applicationId !== task.applicationId) throw new Error('来源投递不一致。');
        if (task.targetRole === input.targetRole && task.jdText === input.jdText) return task;
        invalidate(task.id);
        database.update(tasks).set({ targetRole: input.targetRole, jdText: input.jdText, inputRevision: task.inputRevision + 1, aiOutputJson: null, status: 'draft', updatedAt: now() }).where(eq(tasks.id, task.id)).run();
        return getTask(task.id);
      }
      if (input.applicationId && !database.select().from(schema.applications).where(eq(schema.applications.id, input.applicationId)).get()) throw new Error('来源投递不存在。');
      return database.insert(tasks).values({ targetRole: input.targetRole, jdText: input.jdText, jdSource: 'text', applicationId: input.applicationId ?? null, status: 'draft', inputRevision: 1, updatedAt: now() }).returning().get();
    });
  }
  function getMaterials(taskId: number) {
    return database.select().from(materials).where(and(eq(materials.taskId, taskId), eq(materials.kind, 'entry'))).all().map(material => {
      const snapshot = parseResumeMaterialSnapshot(material.snapshotJson);
      if (snapshot.kind !== 'entry') throw new Error('素材快照无效。');
      return { ...material, snapshot };
    });
  }
  function saveSelection(taskId: number, revision: number, ids: number[]) {
    z.array(z.number().int().positive()).max(200).refine(value => new Set(value).size === value.length).parse(ids);
    return database.transaction(() => {
      const task = checkRevision(taskId, revision);
      const existing = getMaterials(taskId);
      if (JSON.stringify(existing.map(item => item.resumeEntryId)) === JSON.stringify(ids)) return task;
      const entries = new Map(database.select().from(schema.resumeEntries).all().map(entry => [entry.id, entry]));
      if (ids.some(id => !entries.has(id))) throw new Error('所选条目已删除，请刷新。');
      invalidate(taskId);
      database.delete(suggestions).where(eq(suggestions.taskId, taskId)).run();
      database.delete(materials).where(and(eq(materials.taskId, taskId), eq(materials.kind, 'entry'))).run();
      for (const id of ids) {
        const old = existing.find(item => item.resumeEntryId === id);
        const entry = entries.get(id)!;
        database.insert(materials).values({ taskId, kind: 'entry', resumeEntryId: id, snapshotJson: old?.snapshotJson ?? stringifyResumeMaterialSnapshot({ kind: 'entry', entry: { id, type: entry.type, title: entry.title, content: parseResumeEntryContent(entry.contentJson), tags: parseResumeEntryTags(entry.tagsJson) } }) }).run();
      }
      database.update(tasks).set({ inputRevision: revision + 1, aiOutputJson: null, status: 'ready', updatedAt: now() }).where(eq(tasks.id, taskId)).run();
      return getTask(taskId);
    });
  }
  function expireRuns(maxAgeMs = 300_000) {
    const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
    database.update(runs).set({ status: 'interrupted', finishedAt: now(), errorCode: 'interrupted' }).where(and(eq(runs.status, 'running'), lt(sql`coalesce(${runs.heartbeatAt}, ${runs.startedAt})`, cutoff))).run();
  }
  function beginRun(taskId: number, revision: number, operation: 'recommendation' | 'optimization', input: unknown, model: string) {
    return database.transaction(() => {
      checkRevision(taskId, revision);
      expireRuns();
      if (database.select().from(runs).where(and(eq(runs.taskId, taskId), eq(runs.status, 'running'))).get()) throw new Error('此任务已有 AI 请求正在进行，请稍后刷新。');
      return database.insert(runs).values({ id: randomUUID(), taskId, operation, inputRevision: revision, inputHash: createHash('sha256').update(JSON.stringify(input)).digest('hex'), status: 'running', model, promptVersion: 'resume-v3.4-1', startedAt: now() }).returning().get();
    });
  }
  function isCurrent(run: Run) {
    const current = database.select().from(runs).where(eq(runs.id, run.id)).get();
    const task = run.taskId ? database.select().from(tasks).where(eq(tasks.id, run.taskId)).get() : null;
    return current?.status === 'running' && task?.inputRevision === run.inputRevision;
  }
  function finishRecommendations(run: Run, recommendations: JdRecommendation[]) {
    return database.transaction(() => {
      if (!isCurrent(run)) return false;
      database.update(tasks).set({ aiOutputJson: JSON.stringify({ recommendations }), status: 'completed', updatedAt: now() }).where(eq(tasks.id, run.taskId!)).run();
      database.update(runs).set({ status: 'completed', finishedAt: now() }).where(eq(runs.id, run.id)).run();
      return true;
    });
  }
  function finishOptimization(run: Run, output: EntryOptimizationSuggestion[]) {
    return database.transaction(() => {
      if (!isCurrent(run)) return false;
      const originals = new Map(getMaterials(run.taskId!).map(item => [item.id, item.snapshot.entry.content]));
      if (output.length !== originals.size || new Set(output.map(item => item.materialId)).size !== originals.size || output.some(item => !originals.has(item.materialId))) throw new Error('优化结果素材不一致。');
      database.delete(suggestions).where(eq(suggestions.taskId, run.taskId!)).run();
      for (const [index, suggestion] of output.entries()) database.insert(suggestions).values({ taskId: run.taskId!, materialId: suggestion.materialId, inputRevision: run.inputRevision, originalText: JSON.stringify(originals.get(suggestion.materialId)), proposedText: JSON.stringify(suggestion.proposedContent), rationale: suggestion.rationale, sortOrder: index, createdAt: now(), updatedAt: now() }).run();
      database.update(runs).set({ status: 'completed', finishedAt: now() }).where(eq(runs.id, run.id)).run();
      return true;
    });
  }
  function failRun(run: Run, errorCode: string) {
    database.update(runs).set({ status: 'failed', errorCode, finishedAt: now() }).where(and(eq(runs.id, run.id), eq(runs.status, 'running'))).run();
  }
  function reviewSuggestion(id: number, state: 'pending' | 'accepted' | 'ignored') {
    return database.transaction(() => {
      const suggestion = database.select().from(suggestions).where(eq(suggestions.id, id)).get();
      if (!suggestion) throw new Error('未找到建议。');
      const task = getTask(suggestion.taskId);
      if (state !== 'pending' && suggestion.inputRevision !== task.inputRevision) throw new Error('建议已过期，请重新优化。');
      database.update(suggestions).set({ state, updatedAt: now() }).where(eq(suggestions.id, id)).run();
      return task;
    });
  }
  return { getTask, saveTask, getMaterials, saveSelection, beginRun, finishRecommendations, finishOptimization, failRun, expireRuns, reviewSuggestion };
}
