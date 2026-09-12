import { and, eq, isNull } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/db/schema';
import { resumeEntrySchema, type ResumeEntryInput } from './schema';

export function createCandidateMergeService(db: BetterSQLite3Database<typeof schema>) {
  return {
    merge(input: { candidateId: number; expectedEntryJson: string; entry: ResumeEntryInput }) {
      const proposed = resumeEntrySchema.parse(input.entry);
      return db.transaction(tx => {
        const candidate = tx.select().from(schema.resumeEntryCandidates).where(eq(schema.resumeEntryCandidates.id, input.candidateId)).get();
        if (!candidate || candidate.state !== 'pending') throw new Error('候选不存在或已处理，请刷新。');
        const entry = candidate.duplicateEntryId ? tx.select().from(schema.resumeEntries).where(eq(schema.resumeEntries.id, candidate.duplicateEntryId)).get() : undefined;
        if (!entry || JSON.stringify(entry) !== input.expectedEntryJson) throw new Error('已有条目已更新或删除，请刷新并重新核对差异。');
        if (entry.type !== proposed.type || candidate.type !== entry.type) throw new Error('只能补充同类型条目。');
        const timestamp = new Date().toISOString();
        const after = tx.update(schema.resumeEntries).set({ type: proposed.type, title: proposed.title,
          contentJson: JSON.stringify(proposed.content), tagsJson: JSON.stringify(proposed.tags), updatedAt: timestamp,
        }).where(eq(schema.resumeEntries.id, entry.id)).returning().get();
        const merge = tx.insert(schema.resumeEntryMerges).values({ entryId: entry.id, candidateId: candidate.id,
          beforeJson: JSON.stringify(entry), afterJson: JSON.stringify(after), sourceExcerpt: candidate.sourceExcerpt, createdAt: timestamp,
        }).returning().get();
        tx.update(schema.resumeEntryCandidates).set({ state: 'accepted', updatedAt: timestamp }).where(eq(schema.resumeEntryCandidates.id, candidate.id)).run();
        return merge.id;
      });
    },
    undo(mergeId: number) {
      db.transaction(tx => {
        const merge = tx.select().from(schema.resumeEntryMerges).where(and(eq(schema.resumeEntryMerges.id, mergeId), isNull(schema.resumeEntryMerges.undoneAt))).get();
        if (!merge) throw new Error('该次补充不存在或已撤回。');
        const current = tx.select().from(schema.resumeEntries).where(eq(schema.resumeEntries.id, merge.entryId)).get();
        if (!current || JSON.stringify(current) !== merge.afterJson) throw new Error('条目在补充后已有更新，不能直接撤回，请手动整理。');
        const before = JSON.parse(merge.beforeJson) as typeof schema.resumeEntries.$inferSelect;
        const timestamp = new Date().toISOString();
        tx.update(schema.resumeEntries).set({ type: before.type, title: before.title, contentJson: before.contentJson, tagsJson: before.tagsJson, updatedAt: timestamp }).where(eq(schema.resumeEntries.id, merge.entryId)).run();
        tx.update(schema.resumeEntryMerges).set({ undoneAt: timestamp }).where(eq(schema.resumeEntryMerges.id, merge.id)).run();
        if (merge.candidateId) tx.update(schema.resumeEntryCandidates).set({ state: 'pending', updatedAt: timestamp }).where(eq(schema.resumeEntryCandidates.id, merge.candidateId)).run();
      });
    },
  };
}
