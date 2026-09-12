"use client";

import { formatExperienceProjects, getExperienceProjects } from "../experience-projects";

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import type { ResumeActionState } from '../actions';
import type { JdTaskView, ResumeEntryView } from '../queries';
import type { ApplicationJdContext } from '@/features/applications/jd-context';
import { resolveJdImportState } from '../jd-import';
import { defaultSelectedEntryIds } from '../jd-selection';
import { OptimizationProgress, SupplementRewrite } from './optimization-progress';
import { saveJdTaskAction, saveJdMaterialSelectionAction, runJdRecommendationAction, runEntryDescriptionOptimizationAction, updateOptimizationSuggestionStateAction } from '../optimization-actions';

const initial: ResumeActionState = { success: false };
const fieldLabels: Record<string,string> = { projectCategory:'项目分类',techStack:'技术栈',content:'内容',position:'岗位',responsibilities:'个人职责',projects:'负责项目',workContent:'工作内容',degree:'学历',major:'专业',dateRange:'时间',proficiency:'掌握程度',award:'奖项' };
function Message({ state }: {state: ResumeActionState}) { return state.message ? <p role="status" className={`text-sm ${state.success ? 'text-muted-foreground' : 'text-destructive'}`}>{state.message}</p> : null; }
function TaskFields({task}: {task: JdTaskView}) {return <><input type="hidden" name="taskId" value={task.id}/><input type="hidden" name="inputRevision" value={task.inputRevision ?? 1}/></>;}

export function JdMatchingWorkspace({entries,tasks,applicationContext=null,applicationContextError}: {entries:ResumeEntryView[];tasks:JdTaskView[];applicationContext?:ApplicationJdContext|null;applicationContextError?:string}) {
  const imported = resolveJdImportState(tasks, applicationContext);
  const [activeId,setActiveId] = useState<number|null>(applicationContext ? imported.activeTaskId : tasks[0]?.id ?? null);
  const task = tasks.find(item=>item.id===activeId) ?? null;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-sm">历史岗位 <Select aria-label="历史岗位" value={activeId ?? 'new'} onChange={e=>setActiveId(e.target.value==='new'?null:Number(e.target.value))}><option value="new">新建岗位</option>{tasks.map(t=><option key={t.id} value={t.id}>{t.targetRole}</option>)}</Select></label>
      <Button variant="outline" onClick={()=>setActiveId(null)}>新建岗位</Button>
      <Link className="text-sm text-primary underline" href="/resumes/versions">已保存的简历版本</Link>
    </div>
    {applicationContext && <p className="text-sm text-muted-foreground">来自 {applicationContext.company} · {applicationContext.role}；带入 JD 不会调用 AI。</p>}
    {applicationContextError && <p className="text-sm text-destructive">{applicationContextError}</p>}
    <TaskEditor key={`${activeId ?? 'new'}:${task?.inputRevision ?? 1}`} task={task} entries={entries} context={applicationContext} onSaved={setActiveId}/>
  </div>;
}

function TaskEditor({task,entries,context,onSaved}: {task:JdTaskView|null;entries:ResumeEntryView[];context:ApplicationJdContext|null;onSaved:(id:number)=>void}) {
  const router=useRouter();
  const [role,setRole]=useState(task?.targetRole ?? context?.role ?? '');
  const [jd,setJd]=useState(task?.jdText ?? context?.jobDescription ?? '');
  const [ids,setIds]=useState<number[]>(task?.selectedEntryIds ?? []);
  const [saveState,saveAction,saving]=useActionState(saveJdTaskAction,initial);
  const [selectionState,selectionAction,selecting]=useActionState(saveJdMaterialSelectionAction,initial);
  const [recommendState,recommendAction,recommending]=useActionState(runJdRecommendationAction,initial);
  const [optimizeState,optimizeAction,optimizing]=useActionState(runEntryDescriptionOptimizationAction,initial);
  const [reviewState,reviewAction,reviewing]=useActionState(updateOptimizationSuggestionStateAction,initial);
  const dirtyTask=role!==(task?.targetRole ?? context?.role ?? '') || jd!==(task?.jdText ?? context?.jobDescription ?? '');
  const dirtySelection=JSON.stringify([...ids].sort((a,b)=>a-b))!==JSON.stringify([...(task?.selectedEntryIds ?? [])].sort((a,b)=>a-b));
  const dirty=dirtyTask||dirtySelection;
  const busy=saving||selecting||recommending||optimizing||reviewing||task?.running;
  useEffect(()=>{ if(saveState.success&&saveState.taskId){onSaved(saveState.taskId);router.refresh();} },[saveState,onSaved,router]);
  useEffect(()=>{ if(selectionState.success||recommendState.success||optimizeState.success||reviewState.success) router.refresh(); },[selectionState,recommendState,optimizeState,reviewState,router]);
  useEffect(()=>{
    if(!dirty)return;
    const before=(e:BeforeUnloadEvent)=>{e.preventDefault();};
    const click=(e:MouseEvent)=>{const element=e.target as HTMLElement;if(element.closest('a[href]')&&!window.confirm('有未保存的输入，确认离开？')){e.preventDefault();e.stopPropagation();}};
    window.addEventListener('beforeunload',before);document.addEventListener('click',click,true);
    return()=>{window.removeEventListener('beforeunload',before);document.removeEventListener('click',click,true);};
  },[dirty]);
  const recommendations=new Map(task?.recommendations.map(item=>[item.entryId,item]));
  return <div className="grid gap-5 xl:grid-cols-2">
    <section className="rounded-lg border bg-card p-5">
      <h2 className="mb-4 font-semibold">1 · 岗位与 JD</h2>
      <form action={saveAction} className="space-y-4">
        {task ? <TaskFields task={task}/> : context ? <input type="hidden" name="applicationId" value={context.id}/> : null}
        <label className="block text-sm">目标岗位<Input name="targetRole" value={role} onChange={e=>setRole(e.target.value)} required maxLength={120}/></label>
        <label className="block text-sm">JD 文本（手动制作可留空）<Textarea name="jdText" value={jd} onChange={e=>setJd(e.target.value)} rows={10} maxLength={20000}/></label>
        {jd.trim().length>0&&jd.trim().length<30&&<p className="text-xs text-muted-foreground">描述较短，补充职责和要求有助于 AI 理解；也可继续手动制作。</p>}
        <Button disabled={busy}>{saving?'正在保存…':'保存岗位并选材'}</Button><Message state={saveState}/>
      </form>
      {task&&<form action={recommendAction} className="mt-5 space-y-3"><TaskFields task={task}/><p className="text-xs text-muted-foreground">可选：点击后将已保存 JD 和全部正式条目发送给 DeepSeek。已有选择会保留。</p><Button variant="outline" disabled={busy||dirty||!jd.trim()||!entries.length}>AI 推荐条目</Button><Message state={recommendState}/></form>}
    </section>
    <section className="rounded-lg border bg-card p-5">
      <h2 className="mb-4 font-semibold">2 · 选择简历素材</h2>
      {!task ? <p className="text-sm text-muted-foreground">先保存岗位，即可手动选材，无需调用 AI。</p> : <>
        {task.error&&<p className="mb-3 text-sm text-muted-foreground">{task.error}</p>}
        {task.running&&<p role="status" className="mb-3 text-sm">AI 正在处理，稍后刷新可查看结果。</p>}
        {task.recommendations.length>0&&<Button className="mb-3" variant="outline" size="sm" disabled={busy} onClick={()=>setIds(defaultSelectedEntryIds(task.recommendations).filter(id=>entries.some(e=>e.id===id)))}>应用推荐选材</Button>}
        <form action={selectionAction} className="space-y-3"><TaskFields task={task}/><input type="hidden" name="selectedEntryIdsJson" value={JSON.stringify(ids)}/>
          {!entries.length&&<p className="text-sm text-muted-foreground">简历仓库还没有正式条目，请先添加或提取。</p>}
          {entries.map(entry=><label key={entry.id} className="flex gap-3 rounded-md border p-3 text-sm"><input type="checkbox" checked={ids.includes(entry.id)} disabled={busy} onChange={e=>setIds(current=>e.target.checked?[...current,entry.id]:current.filter(id=>id!==entry.id))}/><span><span className="font-medium">{entry.title}</span>{recommendations.has(entry.id)&&<span className="mt-1 block text-xs text-muted-foreground">{{high:'高匹配',medium:'中匹配',low:'低匹配'}[recommendations.get(entry.id)!.level]} · {recommendations.get(entry.id)!.reason}</span>}</span></label>)}
          <Button disabled={busy||dirtyTask}>保存 {ids.length} 条素材</Button><Message state={selectionState}/>
        </form>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <form action={optimizeAction} onSubmit={e=>{if(task.suggestions.length&&!window.confirm('重新优化成功后会替换当前建议及审阅状态，已有草稿和版本不变。继续？'))e.preventDefault();}}><TaskFields task={task}/><Button variant="outline" disabled={busy||dirty||!task.selectedEntryIds.length||!jd.trim()}>优化已选描述</Button></form>
          <Link href={`/resumes/documents/${task.id}`} aria-disabled={busy||dirty||!task.selectedEntryIds.length} onClick={e=>{if(busy||dirty||!task.selectedEntryIds.length)e.preventDefault();}} className={`rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground ${busy||dirty||!task.selectedEntryIds.length?'opacity-40':''}`}>制作简历 →</Link>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">优化仅发送已选素材与 JD，默认最多两次请求（含一次失败修正）。可跳过 AI 直接制作；待处理与忽略的建议保留原文。</p><Message state={optimizeState}/>
        <OptimizationProgress task={task} processing={optimizing} disabled={dirty||saving||selecting||recommending||optimizing||reviewing}/>
      </>}
      {dirty&&<p role="status" className="mt-3 text-sm text-muted-foreground">有未保存的更改，请先保存岗位或选材，再分析或制作。</p>}
    </section>
    {!!task?.suggestions.length&&<section className="rounded-lg border bg-card p-5 xl:col-span-2"><h2 className="mb-4 font-semibold">3 · 审阅描述建议</h2><div className="space-y-4">{task.suggestions.map(suggestion=><article key={suggestion.id} className="rounded-md border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-medium">{suggestion.title}{suggestion.stale?' · 已过期':''}</h3><form action={reviewAction} className="flex items-center gap-2"><input type="hidden" name="suggestionId" value={suggestion.id}/>{suggestion.state==='pending'?<><Button name="state" value="ignored" variant="ghost" size="sm" disabled={busy||suggestion.stale}>忽略</Button><Button name="state" value="accepted" variant="outline" size="sm" disabled={busy||suggestion.stale}>接受</Button></>:<><span className="text-xs text-muted-foreground">{suggestion.state==='accepted'?'已接受':'已忽略'}</span><Button name="state" value="pending" variant="ghost" size="sm" disabled={busy}>撤销</Button></>}</form></div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">{[suggestion.originalContent,suggestion.proposedContent].map((content,index)=><div key={index} className="rounded bg-muted/50 p-3"><p className="mb-2 text-xs font-medium">{index?'优化后':'原描述'}</p>{Object.entries(content).map(([key,value])=><p key={key} className="whitespace-pre-wrap text-sm leading-6"><span className="text-muted-foreground">{fieldLabels[key]??key}：</span>{Array.isArray(value)?(key === 'projects' ? formatExperienceProjects(getExperienceProjects(content)) : value.join('、')):value||'—'}</p>)}</div>)}</div><p className="mt-3 text-xs text-muted-foreground">{suggestion.rationale}</p>
      <SupplementRewrite taskId={task.id} inputRevision={task.inputRevision??1} materialId={suggestion.materialId} disabled={busy||dirty||suggestion.stale}/>
    </article>)}</div><Message state={reviewState}/></section>}
  </div>;
}
