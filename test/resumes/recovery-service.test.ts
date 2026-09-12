import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../../src/db/schema';
import { createTaskService } from '../../src/features/resumes/workflow/task-service';
import { createRecoveryService } from '../../src/features/resumes/workflow/recovery-service';

function setup() {
  const sqlite = new Database(':memory:');
  const database = drizzle(sqlite, {schema});
  migrate(database, {migrationsFolder:'drizzle'});
  const tasks = createTaskService(database);
  let task = tasks.saveTask({targetRole:'后端',jdText:'接口开发'});
  const entry = database.insert(schema.resumeEntries).values({type:'project',title:'接口',contentJson:JSON.stringify({projectCategory:'后端',techStack:[],content:'开发接口'})}).returning().get();
  task = tasks.saveSelection(task.id,task.inputRevision,[entry.id]);
  return {sqlite,database,tasks,task,service:createRecoveryService(database)};
}

test('recovery preserves reserved call budget and refuses stale execution leases', () => {
  const f=setup();
  try {
    const run=f.service.start(f.task.id,f.task.inputRevision,'test');
    f.service.reserveCall(run);
    f.service.fail(run,'network_error');
    const resumed=f.service.resume(run.id);
    assert.throws(()=>f.service.reserveCall(run),/过期|占用/);
    f.service.reserveCall(resumed);
    assert.throws(()=>f.service.reserveCall(resumed),/次数/);
    assert.equal(f.service.get(run.id).callCount,2);
  } finally {f.sqlite.close();}
});

test('input changes and newer runs prevent recovery of previous runs', () => {
  const f=setup();
  try {
    const old=f.service.start(f.task.id,f.task.inputRevision,'test');
    f.service.fail(old,'network_error');
    const next=f.service.start(f.task.id,f.task.inputRevision,'test');
    assert.throws(()=>f.service.resume(old.id),/过期|替代/);
    f.service.fail(next,'network_error');
    f.tasks.saveTask({taskId:f.task.id,inputRevision:f.task.inputRevision,targetRole:'前端',jdText:'页面'});
    assert.throws(()=>f.service.resume(next.id),/更新|过期|替代/);
  } finally {f.sqlite.close();}
});

test('single-item recovery waits for facts and completes idempotently', () => {
  const f=setup();
  try {
    const material=f.tasks.getMaterials(f.task.id)[0];
    const run=f.service.start(f.task.id,f.task.inputRevision,'test',material.id);
    f.service.waitForFacts(run);
    assert.equal(f.service.get(run.id).status,'waiting');
    const resumed=f.service.resume(run.id);
    const output=[{materialId:material.id,proposedContent:material.snapshot.entry.content,rationale:'保持事实'}];
    assert.equal(f.service.complete(resumed,output,0),true);
    assert.equal(f.service.complete(resumed,output,0),false);
    assert.equal(f.database.select().from(schema.resumeOptimizationSuggestions).all().length,1);
  } finally {f.sqlite.close();}
});

test('cleanup reservation blocks recovery but remains retryable until deletion succeeds',()=>{
  const f=setup();
  try {
    const run=f.service.start(f.task.id,f.task.inputRevision,'test');
    assert.throws(()=>f.service.prepareClear(run.id),/完成/);
    f.service.fail(run,'network_error');
    f.service.prepareClear(run.id);
    assert.throws(()=>f.service.resume(run.id),/替代/);
    assert.equal(f.service.get(run.id).checkpointsCleared,false);
    f.service.markCleared(run.id);
    assert.equal(f.service.get(run.id).inputJson,null);
    assert.equal(f.service.get(run.id).checkpointsCleared,true);
  } finally {f.sqlite.close();}
});
