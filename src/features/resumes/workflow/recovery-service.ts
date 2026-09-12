import { and, eq, inArray, ne } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { randomUUID } from 'node:crypto';
import * as schema from '@/db/schema';
import { createTaskService } from './task-service';
import { assertPromptBudget, validateOptimizationSuggestions } from './optimization-graph';
import { ModelCallBudgetError, RESUME_WORKFLOW_VERSION } from './resumable-graph';
import type { OptimizationPromptInput } from '../prompts';
import type { EntryOptimizationSuggestion } from '../ai-schema';

export const RECOVERY_VERSION = RESUME_WORKFLOW_VERSION;
export const MAX_MODEL_CALLS = 2;
const {resumeAiRuns: runs, resumeOptimizationSuggestions: suggestions} = schema;
export type RecoveryRun = schema.ResumeAiRun;

export function createRecoveryService(database: BetterSQLite3Database<typeof schema>) {
  const tasks = createTaskService(database);
  const now = () => new Date().toISOString();
  function get(id: string) {
    const run = database.select().from(runs).where(eq(runs.id,id)).get();
    if (!run) throw new Error('未找到本次处理记录。');
    return run;
  }
  function guard(run: RecoveryRun) {
    const current=get(run.id);
    if(current.status!=='running'||current.executionId!==run.executionId) throw new Error('处理占用已过期，请刷新页面。');
    if(!current.taskId||tasks.getTask(current.taskId).inputRevision!==current.inputRevision) throw new Error('岗位或选材已更新，本次处理已过期。');
    return current;
  }
  function start(taskId:number, revision:number, model:string, targetMaterialId?:number) {
    return database.transaction(()=>{
      const task=tasks.getTask(taskId);
      if(task.inputRevision!==revision) throw new Error('任务已更新，请刷新。');
      if(!task.jdText.trim()) throw new Error('请先保存 JD，或直接手动制作简历。');
      const materials=tasks.getMaterials(taskId).filter(m=>targetMaterialId===undefined||m.id===targetMaterialId);
      if(!materials.length) throw new Error('请先保存有效的选材。');
      const input:OptimizationPromptInput={targetRole:task.targetRole,jdText:task.jdText,materials:materials.map(m=>({materialId:m.id,...m.snapshot.entry}))};
      assertPromptBudget(input);
      const run=tasks.beginRun(taskId,revision,'optimization',input,model);
      database.update(runs).set({status:'superseded',finishedAt:now()}).where(and(eq(runs.taskId,taskId),eq(runs.operation,'optimization'),ne(runs.id,run.id),inArray(runs.status,['waiting','failed','interrupted']))).run();
      database.update(runs).set({promptVersion:RECOVERY_VERSION,inputJson:JSON.stringify(input),targetMaterialId:targetMaterialId??null,executionId:randomUUID(),heartbeatAt:now()}).where(eq(runs.id,run.id)).run();
      return get(run.id);
    });
  }
  function resume(id:string) {
    return database.transaction(()=>{
      tasks.expireRuns();
      const run=get(id);
      if(run.promptVersion!==RECOVERY_VERSION||run.checkpointsCleared||!run.inputJson) throw new Error('此记录没有可恢复的流程，请重新优化。');
      if(!['waiting','failed','interrupted'].includes(run.status)) throw new Error('流程已完成、正在运行或已被替代。');
      if(!run.taskId||tasks.getTask(run.taskId).inputRevision!==run.inputRevision) throw new Error('任务已更新，旧流程不可恢复。');
      if(database.select().from(runs).where(and(eq(runs.taskId,run.taskId),eq(runs.status,'running'))).get()) throw new Error('此任务已有请求正在进行。');
      database.update(runs).set({status:'running',executionId:randomUUID(),heartbeatAt:now(),errorCode:null,finishedAt:null}).where(eq(runs.id,id)).run();
      return get(id);
    });
  }
  function stage(run:RecoveryRun,value:string) {
    guard(run);
    database.update(runs).set({stage:value,heartbeatAt:now()}).where(eq(runs.id,run.id)).run();
  }
  function reserveCall(run:RecoveryRun) {
    return database.transaction(()=>{
      const current=guard(run);
      if(current.callCount>=MAX_MODEL_CALLS) throw new ModelCallBudgetError();
      database.update(runs).set({callCount:current.callCount+1,heartbeatAt:now()}).where(eq(runs.id,run.id)).run();
    });
  }
  function recordUsage(run:RecoveryRun,usage:{inputTokens:number|null;outputTokens:number|null},durationMs:number) {
    guard(run);
    const current=get(run.id);
    const sum=(previous:number|null,next:number|null)=>next===null?null:current.callCount===1?next:previous===null?null:previous+next;
    database.update(runs).set({inputTokens:sum(current.inputTokens,usage.inputTokens),outputTokens:sum(current.outputTokens,usage.outputTokens),durationMs:current.durationMs+Math.max(0,durationMs),heartbeatAt:now()}).where(eq(runs.id,run.id)).run();
  }
  function waitForFacts(run:RecoveryRun) {
    guard(run);
    database.update(runs).set({status:'waiting',stage:'awaitFacts',heartbeatAt:now()}).where(eq(runs.id,run.id)).run();
  }
  function fail(run:RecoveryRun,code:string) {
    database.update(runs).set({status:'failed',errorCode:code,finishedAt:now()}).where(and(eq(runs.id,run.id),eq(runs.status,'running'),eq(runs.executionId,run.executionId!))).run();
  }
  function complete(run:RecoveryRun,output:EntryOptimizationSuggestion[],fallbackCount:number) {
    return database.transaction(()=>{
      try {guard(run);} catch {return false;}
      const input=JSON.parse(run.inputJson!) as OptimizationPromptInput;
      validateOptimizationSuggestions(input,output);
      const scope=run.targetMaterialId===null?eq(suggestions.taskId,run.taskId!):and(eq(suggestions.taskId,run.taskId!),eq(suggestions.materialId,run.targetMaterialId));
      database.delete(suggestions).where(scope).run();
      for(const [index,item] of output.entries()) {
        database.insert(suggestions).values({taskId:run.taskId!,materialId:item.materialId,inputRevision:run.inputRevision,originalText:JSON.stringify(input.materials.find(m=>m.materialId===item.materialId)!.content),proposedText:JSON.stringify(item.proposedContent),rationale:item.rationale,sortOrder:index,createdAt:now(),updatedAt:now()}).run();
      }
      database.update(runs).set({status:'completed',stage:'finish',fallbackCount,finishedAt:now()}).where(eq(runs.id,run.id)).run();
      return true;
    });
  }
  function prepareClear(id:string) {
    const run=get(id);
    if(['running','waiting'].includes(run.status)) throw new Error('请先完成或替代本次处理，再清理存档。');
    // Block resume first; if external checkpoint deletion fails the UI can retry cleanup.
    if(['failed','interrupted'].includes(run.status)) database.update(runs).set({status:'superseded'}).where(eq(runs.id,id)).run();
  }
  function markCleared(id:string) {
    prepareClear(id);
    database.update(runs).set({checkpointsCleared:true,inputJson:null}).where(eq(runs.id,id)).run();
  }
  return {get,start,resume,guard,stage,reserveCall,recordUsage,waitForFacts,fail,complete,prepareClear,markCleared};
}
