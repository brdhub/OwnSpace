'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { JdTaskView } from '../queries';
import type { ResumeActionState } from '../actions';
import { clearOptimizationCheckpointAction, resumeOptimizationAction, startResumableOptimizationAction } from '../workflow/recovery-actions';
import { AgentProgress } from './agent-progress';
import { Check, Loader2, MessageCircle, Sparkles } from 'lucide-react';
import styles from './optimization-workspace.module.css';

const initial:ResumeActionState={success:false};
const stageLabels:Record<string,string>={prepare:'准备素材',preparing:'准备素材',awaitFacts:'等待补充',awaiting_facts:'等待补充',generating:'生成建议',validating:'校验建议',repairing:'修正失败条目',finishing:'保存结果',finish:'处理完成',agent_planning:'制定计划',agent_thinking:'选择下一步行动',agent_tools:'执行工具与校验'};
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
  const working=processing||pending||task.running;
  if(!run)return <div className={`${styles.surface} ${styles.scroll} flex h-full flex-col items-center p-6 text-center`}>
    <div className={`mb-6 rounded-[28px] border border-primary/15 bg-primary/10 p-6 text-primary ${working?'motion-safe:animate-pulse':''}`}><Sparkles className="h-10 w-10" /></div>
    <h3 className="text-2xl font-semibold">{working?'正在准备这次优化':'把经历说得更清楚'}</h3>
    <p className="mt-4 max-w-md text-base leading-8 text-muted-foreground">{working?'进度会自动更新，你的原始素材会完整保留。':'选择左侧的优化方式。任务开始后，计划、执行记录和修改依据会在这里逐步呈现。'}</p>
    <div className="mt-6 flex flex-wrap justify-center gap-2">{['基于真实经历','保留原文','逐条确认'].map(label=><span key={label} className="rounded-full border bg-card px-4 py-2 text-sm text-muted-foreground">{label}</span>)}</div>
  </div>;
  return <section className="flex h-full min-h-0 min-w-0 flex-col">
    <header className={`${styles.surface} flex shrink-0 items-center gap-4 border-b px-5 py-4`}>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">{working?<Loader2 className="h-6 w-6 motion-safe:animate-spin"/>:run.status==='waiting'?<MessageCircle className="h-6 w-6"/>:run.status==='completed'?<Check className="h-6 w-6"/>:<Sparkles className="h-6 w-6"/>}</span>
      <div className="min-w-0"><p role="status" className="truncate text-xl font-semibold">{working?'正在处理':statusLabels[run.status]??run.status}</p><p className="mt-1 text-sm text-muted-foreground">{stageLabels[run.stage]??'处理建议'} · 已请求 {run.callCount}/{run.maxCalls??2} 次</p></div>
    </header>
    <div className={`${styles.scroll} min-w-0 flex-1 space-y-5 p-5`}>
      {run.canResume&&<div className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
        {run.status==='waiting'&&<label className="block text-base font-medium leading-7">{run.agentTrace?.question?`素材 #${run.agentTrace.question.materialId}：${run.agentTrace.question.question}`:'补充这条经历的真实信息'}<Textarea form={`resume-optimization-${run.id}`} key={run.agentTrace?.question?.question??run.id} name="facts" maxLength={4000} rows={3} className="mt-3 h-24 rounded-xl bg-card text-base leading-7" placeholder="填写可以确认的事实，也可以留空跳过。"/></label>}
        <p className="text-sm leading-6 text-muted-foreground">补充仅用于本次优化。继续可能调用 DeepSeek，整个运行最多 {run.maxCalls??2} 次，恢复不会重置次数。</p>
      </div>}
      {run.agentTrace?<AgentProgress trace={run.agentTrace}/>:<div className="rounded-2xl bg-muted/40 p-5"><h3 className="text-lg font-semibold">{run.status==='completed'?'建议已准备好':'正在整理修改建议'}</h3><p className="mt-2 text-base leading-8 text-muted-foreground">{run.status==='completed'?'切换到“审阅建议”，对照原文决定是否采用。':'快速优化会生成并校验建议，无法通过校验的条目会保留原文。'}</p></div>}
      {run.fallbackCount>0&&<p className="rounded-xl bg-muted/50 p-4 text-base leading-7">{run.fallbackCount} 条未通过校验，已保留原文。</p>}
      <details className="rounded-xl border p-4"><summary className="cursor-pointer text-sm text-muted-foreground">本次运行详情</summary><p className="mt-3 text-sm leading-7 text-muted-foreground">调用耗时 {(run.durationMs/1000).toFixed(1)} 秒 · 输入 {run.inputTokens??'未知'} / 输出 {run.outputTokens??'未知'} tokens</p>
        {run.canClear&&<form action={clearAction} className="mt-2" onSubmit={event=>{if(!window.confirm('清理后无法恢复此执行进度，简历草稿和版本仍保留。继续？'))event.preventDefault();}}><input type="hidden" name="runId" value={run.id}/><Button variant="ghost" disabled={pending||clearing||disabled||task.running}>清理执行存档</Button></form>}
      </details>
      {(state.message||clearState.message)&&<p role="status" className="text-base leading-7">{state.message||clearState.message}</p>}
    </div>
    {run.canResume&&<form id={`resume-optimization-${run.id}`} action={action} className="shrink-0 border-t bg-primary/5 px-5 py-3">
      <input type="hidden" name="runId" value={run.id}/>
      <Button className="shrink-0 self-start rounded-xl" disabled={disabled||task.running||pending||clearing}>{pending?'正在继续…':run.status==='waiting'?'确认并继续（可留空）':'从已保存进度继续'}</Button>
    </form>}
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
