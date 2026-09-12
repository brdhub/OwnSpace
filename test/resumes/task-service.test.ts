import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../../src/db/schema';
import { createTaskService } from '../../src/features/resumes/workflow/task-service';

function setup() {
  const sqlite = new Database(':memory:');
  const database = drizzle(sqlite, { schema });
  migrate(database, { migrationsFolder: 'drizzle' });
  return { sqlite, database, service: createTaskService(database) };
}

test('manual tasks need no JD and selection creates independent snapshots', () => {
  const { sqlite, database, service } = setup();
  try {
    const task = service.saveTask({ targetRole: '后端', jdText: '' });
    const entry = database.insert(schema.resumeEntries).values({ type: 'project', title: 'API', contentJson: JSON.stringify({projectCategory:'后端',techStack:[],content:'接口'}),tagsJson:'[]' }).returning().get();
    const saved = service.saveSelection(task.id, task.inputRevision, [entry.id]);
    assert.equal(saved.inputRevision, 2);
    assert.equal(service.getMaterials(task.id)[0].snapshot.entry.title, 'API');
    assert.throws(() => service.saveSelection(task.id, 1, []), /更新/);
  } finally { sqlite.close(); }
});

test('AI runs reject simultaneous requests and never write late results after input changes', () => {
  const { sqlite, service } = setup();
  try {
    const task = service.saveTask({ targetRole:'后端',jdText:'开发接口' });
    const run = service.beginRun(task.id, task.inputRevision, 'recommendation', { test:1 }, 'test');
    assert.throws(() => service.beginRun(task.id, task.inputRevision, 'recommendation', {}, 'test'), /进行/);
    service.saveTask({taskId:task.id,inputRevision:1,targetRole:'前端',jdText:'页面开发'});
    assert.equal(service.finishRecommendations(run, []), false);
    assert.equal(service.getTask(task.id).targetRole, '前端');
  } finally { sqlite.close(); }
});

test('failed rerun keeps accepted suggestions and interrupted run cannot finish', () => {
  const { sqlite, database, service } = setup();
  try {
    const task = service.saveTask({targetRole:'后端',jdText:'接口'});
    const run = service.beginRun(task.id, 1, 'recommendation', {}, 'test');
    service.failRun(run, 'network_error');
    const retry = service.beginRun(task.id, 1, 'recommendation', {}, 'test');
    assert.equal(service.finishRecommendations(run, []), false);
    assert.equal(service.finishRecommendations(retry, []), true);
    assert.equal(database.select().from(schema.resumeAiRuns).all().length, 2);
  } finally { sqlite.close(); }
});
