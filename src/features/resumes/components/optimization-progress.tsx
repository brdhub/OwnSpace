'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { JdTaskView } from '../queries';
import type { ResumeActionState } from '../actions';
import { clearOptimizationCheckpointAction, resumeOptimizationAction, startResumableOptimizationAction } from '../workflow/recovery-actions';

const initial:ResumeActionState={success:false};
const stageLabels:Record<string,string>={prepare:'准备素材',preparing:'准备素材',awaitFacts:'等待补充',awaiting_facts:'等待补充',generating:'生成建议',validating:'校验建议',repairing:'修正失败条目',finishing:'保存结果',finish:'处理完成'};
const statusLabels:Record<string,string>={running:'处理中',waiting:'等待补充',completed:'已完成',failed:'处理失败',interrupted:'上次处理已中断',superseded:'已被新输入或新处理替代'};

export function OptimizationProgress({task,disabled=false,processing=false}:{task:JdTaskView;disabled?:boolean;processing?:boolean}) {
  const [state,action,pending]=useActionState(resumeOptimizationAction,initial);
  const [clearState,clearAction,clearing]=useActionState(clearOptimizationCheckpointAction,initial);
  const router=useRouter();
  useEffect(()=>{if(state.success||clearState.success)router.refresh();},[state,clearState,router]);
  useEffect(()=>{
    if(!task.running&&!pending&&!processing)return;
    const timer=window.setInterval(()=>router.refresh(),3000);
    return()=>window.clearInterval(timer);
  },[task.running,pending,processing,router]);
  const run=task.optimizationRun;
  if(!run)return null;
  return <section className="mt-4 space-y-3 rounded-md border p-3 text-sm">
    <p role="status">{statusLabels[run.status]??run.status} · {stageLabels[run.stage]??'处理建议'}</p>
    <p className="text-xs text-muted-foreground">已发起 {run.callCount}/2 次模型请求 · 已记录调用耗时 {(run.durationMs/1000).toFixed(1)} 秒 · 输入 {run.inputTokens??'未知'} / 输出 {run.outputTokens??'未知'} tokens</p>
    {run.fallbackCount>0&&<p>{run.fallbackCount} 条未通过校验，已保留原文。</p>}
    {run.canResume&&<form action={action} className="space-y-3">
      <input type="hidden" name="runId" value={run.id}/>
      {run.status==='waiting'&&<label className="block">补充这条经历的真实信息<Textarea name="facts" maxLength={4000} rows={4} placeholder="你具体负责什么？采取了哪些措施？有什么可以确认的结果？没有量化数据可以不填。"/><span className="mt-1 block text-xs text-muted-foreground">仅用于本次条目重写，不改正式条目库；不填写即跳过补充。</span></label>}
      <Button variant="outline" disabled={disabled||task.running||pending||clearing}>{pending?'正在继续…':run.status==='waiting'?'确认补充并继续（可留空）':'从已保存进度继续'}</Button>
      <p className="text-xs text-muted-foreground">继续可能调用 DeepSeek；复用已保存结果，整个运行最多两次请求，恢复不会重置次数。</p>
    </form>}
    {run.canClear&&<form action={clearAction} onSubmit={event=>{if(!window.confirm('清理后无法恢复此执行进度，简历草稿和版本仍保留。继续？'))event.preventDefault();}}><input type="hidden" name="runId" value={run.id}/><Button variant="ghost" size="sm" disabled={pending||clearing}>清理执行存档</Button></form>}
    {(state.message||clearState.message)&&<p role="status">{state.message||clearState.message}</p>}
  </section>;
}

export function SupplementRewrite({taskId,inputRevision,materialId,disabled}:{taskId:number;inputRevision:number;materialId:number;disabled?:boolean}) {
  const [state,action,pending]=useActionState(startResumableOptimizationAction,initial);
  const router=useRouter();
  useEffect(()=>{if(state.success)router.refresh();},[state,router]);
  return <div className="mt-3"><form action={action} onSubmit={event=>{if(!window.confirm('将创建单条重写流程，替代本岗位之前未完成的优化。新结果保存后只重置此条建议的审阅状态，继续？'))event.preventDefault();}}>
    <input type="hidden" name="taskId" value={taskId}/><input type="hidden" name="inputRevision" value={inputRevision}/><input type="hidden" name="materialId" value={materialId}/>
    <Button variant="outline" size="sm" disabled={disabled||pending}>补充事实后重写此条</Button>
  </form>{state.message&&<p className="mt-2 text-sm" role="status">{state.message}</p>}</div>;
}
