import { randomUUID } from 'node:crypto';
import { and, desc, eq, lt, ne, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/db/schema';
import { resumeEntrySchema } from '../schema';
import { MAX_GITHUB_REQUESTS, MAX_MODEL_CALLS, startSchema, type GithubInput, type GithubView } from './contracts';

const runs = schema.githubResumeRuns;
export const LEASE_MS = 180_000;
export type GithubRun = typeof runs.$inferSelect;
export const emptyView = (): GithubView => ({repository: null, files: [], plan: [], events: [], question: null, facts: '', draft: null});
export function viewOf(run: GithubRun): GithubView {return {...emptyView(), ...JSON.parse(run.viewJson)};}

export function createGithubStore(db: BetterSQLite3Database<typeof schema>, clock = () => Date.now()) {
  const now = () => new Date(clock()).toISOString();
  const get = (id: string) => {
    const run = db.select().from(runs).where(eq(runs.id, id)).get();
    if (!run) throw new Error('未找到项目解析任务。');
    return run;
  };
  const owned = (run: GithubRun) => and(eq(runs.id, run.id), eq(runs.leaseToken, run.leaseToken!), eq(runs.status, 'running'));
  return {
    get,
    list: () => db.select().from(runs).orderBy(desc(runs.createdAt)).limit(30).all(),
    create(input: GithubInput) {
      return db.insert(runs).values({id: randomUUID(), inputJson: JSON.stringify(startSchema.parse(input)), createdAt: now(), updatedAt: now()}).returning().get();
    },
    claim(id: string) {
      const run = db.update(runs).set({status: 'running', leaseToken: randomUUID(), leaseUntil: clock() + LEASE_MS, error: null, updatedAt: now()})
        .where(and(eq(runs.id, id), lt(runs.leaseUntil, clock()), ne(runs.status, 'accepted'), ne(runs.status, 'completed'))).returning().get();
      if (!run) throw new Error('任务正在处理或已完成，请刷新查看。');
      return run;
    },
    reserve(run: GithubRun, kind: 'model' | 'github') {
      const field = kind === 'model' ? runs.callCount : runs.requestCount;
      const limit = kind === 'model' ? MAX_MODEL_CALLS : MAX_GITHUB_REQUESTS;
      const updated = db.update(runs).set(kind === 'model' ? {callCount: sql`${runs.callCount} + 1`, leaseUntil: clock() + LEASE_MS} : {requestCount: sql`${runs.requestCount} + 1`, leaseUntil: clock() + LEASE_MS})
        .where(and(owned(run), lt(field, limit))).returning({id: runs.id}).get();
      if (!updated) throw new Error(`任务已失去执行权或达到${kind === 'model' ? '模型调用' : 'GitHub 请求'}上限；恢复不会重置额度。`);
    },
    publish(run: GithubRun, view: GithubView) {
      if (!db.update(runs).set({viewJson: JSON.stringify(view), leaseUntil: clock() + LEASE_MS, updatedAt: now()}).where(owned(run)).returning({id: runs.id}).get()) throw new Error('任务执行权已过期。');
    },
    finish(run: GithubRun, status: 'waiting' | 'completed' | 'failed', view?: GithubView, error?: string) {
      db.update(runs).set({status, ...(view ? {viewJson: JSON.stringify(view)} : {}), error: error?.slice(0, 1000) ?? null, leaseToken: null, leaseUntil: 0, updatedAt: now()}).where(owned(run)).run();
    },
    accept(id: string, rawEntry: unknown) {
      const entry = resumeEntrySchema.parse(rawEntry);
      if (entry.type !== 'project') throw new Error('只能保存项目经历。');
      return db.transaction(tx => {
        const run = tx.select().from(runs).where(eq(runs.id, id)).get();
        if (!run) throw new Error('任务不存在。');
        if (run.status === 'accepted') return run.entryId;
        if (run.status !== 'completed' || !viewOf(run).draft) throw new Error('请先完成草稿并审阅。');
        const existing = tx.select().from(schema.resumeEntries).where(and(eq(schema.resumeEntries.type, 'project'), eq(schema.resumeEntries.title, entry.title), eq(schema.resumeEntries.contentJson, JSON.stringify(entry.content)))).get();
        const saved = existing ?? tx.insert(schema.resumeEntries).values({type: 'project', title: entry.title, contentJson: JSON.stringify(entry.content), tagsJson: JSON.stringify(entry.tags), createdAt: now(), updatedAt: now()}).returning().get();
        tx.update(runs).set({status: 'accepted', entryId: saved.id, updatedAt: now()}).where(eq(runs.id, id)).run();
        return saved.id;
      });
    },
  };
}
