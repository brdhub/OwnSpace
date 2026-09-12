import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createCandidateMergeService } from '../../src/features/resumes/candidate-merge-service';

test('merge updates in place once, records provenance, rejects stale writes and supports safe undo', () => {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: 'drizzle' });
  try {
    const content = { projectCategory: '', techStack: [], content: '原文' };
    const entry = db.insert(schema.resumeEntries).values({ type: 'project', title: '项目', contentJson: JSON.stringify(content) }).returning().get();
    const asset = db.insert(schema.resumeAssets).values({ originalName: '简历.pdf', storageKey: 'test.pdf', mimeType: 'application/pdf', byteSize: 10 }).returning().get();
    const candidate = db.insert(schema.resumeEntryCandidates).values({ resumeAssetId: asset.id, type: 'project', title: '项目', contentJson: JSON.stringify(content), sourceExcerpt: '补充', duplicateEntryId: entry.id }).returning().get();
    const service = createCandidateMergeService(db);
    const input = { candidateId: candidate.id, expectedEntryJson: JSON.stringify(entry), entry: { type: 'project' as const, title: '项目', content: { ...content, content: '原文\n补充' }, tags: [] } };
    assert.throws(() => service.merge({ ...input, expectedEntryJson: '{}' }), /更新/);
    const mergeId = service.merge(input);
    assert.equal(db.select().from(schema.resumeEntries).all().length, 1);
    assert.throws(() => service.merge(input), /已处理/);
    assert.equal(db.select().from(schema.resumeEntryMerges).get()?.sourceExcerpt, '补充');
    const merged = db.select().from(schema.resumeEntries).get()!;
    db.update(schema.resumeEntries).set({ title: '后来修改' }).where(eq(schema.resumeEntries.id, entry.id)).run();
    assert.throws(() => service.undo(mergeId), /更新/);
    db.update(schema.resumeEntries).set({ title: merged.title }).where(eq(schema.resumeEntries.id, entry.id)).run();
    service.undo(mergeId);
    assert.equal(db.select().from(schema.resumeEntries).get()?.contentJson, entry.contentJson);
    assert.equal(db.select().from(schema.resumeEntryCandidates).get()?.state, 'pending');
    assert.throws(() => service.undo(mergeId), /撤回/);
  } finally { sqlite.close(); }
});
