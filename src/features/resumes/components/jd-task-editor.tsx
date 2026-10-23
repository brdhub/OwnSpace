'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, FileCheck2, Layers3, Loader2, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { ApplicationJdContext } from '@/features/applications/jd-context';
import type { ResumeActionState } from '../actions';
import type { JdTaskView, ResumeEntryView } from '../queries';
import { defaultSelectedEntryIds } from '../jd-selection';
import { OptimizationProgress } from './optimization-progress';
import { OptimizationReview } from './optimization-review';
import { saveJdTaskAction, saveJdMaterialSelectionAction, runJdRecommendationAction, runEntryDescriptionOptimizationAction, updateOptimizationSuggestionStateAction } from '../optimization-actions';
import styles from './optimization-workspace.module.css';

const initial: ResumeActionState = {success: false};
const panels = [{id:'prepare', label:'准备素材', Icon:Layers3}, {id:'optimize', label:'开始优化', Icon:Sparkles}, {id:'review', label:'审阅建议', Icon:FileCheck2}] as const;
export type OptimizationPanel = (typeof panels)[number]['id'];
function Message({state}: {state: ResumeActionState}) { return state.message ? <p role="status" className={`text-base leading-7 ${state.success ? 'text-muted-foreground' : 'text-destructive'}`}>{state.message}</p> : null; }
function TaskFields({task}: {task: JdTaskView}) { return <><input type="hidden" name="taskId" value={task.id}/><input type="hidden" name="inputRevision" value={task.inputRevision ?? 1}/></>; }

export function JdTaskEditor({task, entries, context, contextError, onSaved, panel, onPanelChange, onDirtyChange, taskSelector}: {
  task: JdTaskView | null; entries: ResumeEntryView[]; context: ApplicationJdContext | null; contextError?: string;
  onSaved: (id: number) => void; panel: OptimizationPanel; onPanelChange: (panel: OptimizationPanel) => void; onDirtyChange: (dirty: boolean) => void;
  taskSelector: ReactNode;
}) {
  const router = useRouter();
  const [role, setRole] = useState(task?.targetRole ?? context?.role ?? '');
  const [jd, setJd] = useState(task?.jdText ?? context?.jobDescription ?? '');
  const [ids, setIds] = useState<number[]>(task?.selectedEntryIds ?? []);
  const [mode, setMode] = useState<'agent'|'quick'>('agent');
  const [saveState, saveAction, saving] = useActionState(saveJdTaskAction, initial);
  const [selectionState, selectionAction, selecting] = useActionState(saveJdMaterialSelectionAction, initial);
  const [recommendState, recommendAction, recommending] = useActionState(runJdRecommendationAction, initial);
  const [optimizeState, optimizeAction, optimizing] = useActionState(runEntryDescriptionOptimizationAction, initial);
  const [reviewState, reviewAction, reviewing] = useActionState(updateOptimizationSuggestionStateAction, initial);
  const dirtyTask = role !== (task?.targetRole ?? context?.role ?? '') || jd !== (task?.jdText ?? context?.jobDescription ?? '');
  const dirtySelection = JSON.stringify([...ids].sort((a,b)=>a-b)) !== JSON.stringify([...(task?.selectedEntryIds ?? [])].sort((a,b)=>a-b));
  const dirty = dirtyTask || dirtySelection;
  const busy = Boolean(saving || selecting || recommending || optimizing || reviewing || task?.running);
  useEffect(()=>{onDirtyChange(dirty);},[dirty,onDirtyChange]);
  useEffect(()=>{if(saveState.success && saveState.taskId){onSaved(saveState.taskId);router.refresh();}},[saveState,onSaved,router]);
  useEffect(()=>{if(selectionState.success || recommendState.success || optimizeState.success || reviewState.success)router.refresh();},[selectionState,recommendState,optimizeState,reviewState,router]);
  useEffect(()=>{
    if(!dirty)return;
    const before=(event:BeforeUnloadEvent)=>{event.preventDefault();};
    const click=(event:MouseEvent)=>{const element=event.target as HTMLElement;if(element.closest('a[href]')&&!window.confirm('有未保存的输入，确认离开？')){event.preventDefault();event.stopPropagation();}};
    window.addEventListener('beforeunload',before);document.addEventListener('click',click,true);
    return()=>{window.removeEventListener('beforeunload',before);document.removeEventListener('click',click,true);};
  },[dirty]);
  const recommendations = new Map(task?.recommendations.map(item=>[item.entryId,item]));
  const ready = Boolean(task?.selectedEntryIds.length && !dirty);
  const panelClass = (id: OptimizationPanel) => panel === id ? `${styles.enter} flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden` : 'hidden';
  return <section className={styles.workspace} aria-label="简历优化工作台">
    <header className={`${styles.surface} shrink-0 border-b px-4 pt-4 sm:px-6`}>
      <div className="mb-3 flex items-center justify-between gap-3"><div className="min-w-0"><h2 className="whitespace-nowrap text-xl font-semibold tracking-tight sm:text-2xl">简历优化</h2><p className="mt-1 hidden truncate text-sm text-muted-foreground sm:block">{contextError ?? (context ? `来自 ${context.company} · ${context.role}` : `已选 ${ids.length} 条素材 · 让经历更贴近目标岗位`)}</p></div>{taskSelector}</div>
      <nav className="flex gap-1" aria-label="简历优化阶段">{panels.map(({id,label,Icon},index)=><button key={id} type="button" aria-current={panel===id?'step':undefined} aria-controls={`optimization-panel-${id}`} onClick={()=>onPanelChange(id)} className={`relative flex min-w-0 flex-1 items-center justify-center gap-2 rounded-t-xl px-2 py-3.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${panel===id?'bg-primary/10 text-primary':'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}><Icon className="hidden h-5 w-5 sm:block"/><span className="whitespace-nowrap"><span className="hidden sm:inline">{index+1}. </span>{label}</span>{panel===id&&<span className="absolute inset-x-4 bottom-0 h-[3px] rounded-t-full bg-primary"/>}</button>)}</nav>
    </header>

    <div id="optimization-panel-prepare" className={panelClass('prepare')}>
      <div className={`${styles.scroll} grid flex-1 grid-rows-[max-content_minmax(360px,1fr)] gap-0 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:grid-rows-1 md:overflow-hidden`}>
        <section className={`${styles.scroll} space-y-5 border-b p-5 md:border-b-0 md:border-r lg:p-6`}>
          <div><h3 className="text-lg font-semibold">你想投递什么岗位？</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">保存岗位后，再选择想用于这份简历的经历。</p></div>
          <form action={saveAction} className="space-y-4">
            {task?<TaskFields task={task}/>:context?<input type="hidden" name="applicationId" value={context.id}/>:null}
            <label className="block space-y-2 font-medium">目标岗位<Input name="targetRole" value={role} onChange={event=>setRole(event.target.value)} required maxLength={120} className="h-12 rounded-xl" placeholder="例如：Agent 开发工程师"/></label>
            <label className="block space-y-2 font-medium">岗位描述 <span className="text-sm font-normal text-muted-foreground">手动制作可留空</span><Textarea name="jdText" value={jd} onChange={event=>setJd(event.target.value)} rows={8} maxLength={20000} className="h-56 rounded-xl font-normal leading-8" placeholder="粘贴岗位职责与任职要求…"/></label>
            <div className="flex items-center justify-between gap-2"><span className="text-sm text-muted-foreground">{jd.length.toLocaleString()} / 20,000 字</span><Button className="rounded-xl" disabled={busy}>{saving?'正在保存…':task?'保存岗位':'保存并开始选材'}</Button></div>
            <Message state={saveState}/>{contextError&&<p role="alert" className="text-sm leading-6 text-destructive">{contextError}</p>}
          </form>
          {task&&<form action={recommendAction} className="space-y-3 rounded-2xl bg-muted/45 p-4"><TaskFields task={task}/><Button variant="outline" className="w-full rounded-xl" disabled={busy||dirty||!jd.trim()||!entries.length}><Sparkles className="h-4 w-4"/>{recommending?'正在分析匹配度…':'让 AI 帮我推荐素材'}</Button><p className="text-sm leading-6 text-muted-foreground">点击会将已保存的 JD 和全部正式条目发送给 DeepSeek，保留已有选择。</p><Message state={recommendState}/></form>}
        </section>
        <section className="flex min-h-[360px] min-w-0 flex-col p-5 md:min-h-0 lg:p-6">
          <header className="mb-4 flex shrink-0 items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">挑选你的经历</h3><p className="mt-1 text-sm text-muted-foreground">已选 {ids.length} / {entries.length} 条</p></div>{Boolean(task?.recommendations.length)&&<Button variant="outline" className="rounded-xl" disabled={busy} onClick={()=>setIds(defaultSelectedEntryIds(task!.recommendations).filter(id=>entries.some(entry=>entry.id===id)))}>应用推荐</Button>}</header>
          {!task?<div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed p-6 text-center text-base leading-8 text-muted-foreground">先保存左侧岗位信息，<br/>就可以开始选材。</div>:<form action={selectionAction} className="flex min-h-0 flex-1 flex-col"><TaskFields task={task}/><input type="hidden" name="selectedEntryIdsJson" value={JSON.stringify(ids)}/>
            <div className={`${styles.scroll} flex-1 space-y-3 pr-1`}>
              {task.error&&<p className="rounded-xl bg-muted p-3 text-sm leading-6">{task.error}</p>}
              {!entries.length&&<p className="py-8 text-base leading-8 text-muted-foreground">简历仓库还没有正式条目，请先添加或提取。</p>}
              {entries.map(entry=><label key={entry.id} className={`${styles.choice} flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${ids.includes(entry.id)?'border-primary/35 bg-primary/5':'bg-card hover:border-primary/25'}`}><input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[hsl(var(--primary))]" checked={ids.includes(entry.id)} disabled={busy} onChange={event=>setIds(current=>event.target.checked?[...current,entry.id]:current.filter(id=>id!==entry.id))}/><span className="min-w-0"><span className="block break-words text-base font-medium leading-7">{entry.title}</span>{recommendations.has(entry.id)&&<span className="mt-2 block text-sm leading-6 text-muted-foreground"><span className="font-medium text-primary">{{high:'高匹配',medium:'中匹配',low:'低匹配'}[recommendations.get(entry.id)!.level]}</span> · {recommendations.get(entry.id)!.reason}</span>}</span></label>)}
            </div>
            <footer className="shrink-0 space-y-2 pt-4"><Button className="w-full rounded-xl" disabled={busy||dirtyTask}>{selecting?'正在保存…':`保存 ${ids.length} 条素材`}</Button><div className="max-h-20 overflow-auto"><Message state={selectionState}/></div></footer>
          </form>}
        </section>
      </div>
    </div>

    <div id="optimization-panel-optimize" className={panelClass('optimize')}>
      <div className={`${styles.scroll} grid min-h-0 flex-1 grid-rows-[max-content_minmax(420px,1fr)] md:grid-cols-[280px_minmax(0,1fr)] md:grid-rows-1 md:overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)]`}>
        <aside className={`${styles.scroll} min-w-0 space-y-4 border-b p-5 md:border-b-0 md:border-r lg:p-6`}>
          <div className="shrink-0"><h3 className="text-lg font-semibold">选一种优化方式</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">以已保存的素材为依据，建议由你决定是否采用。</p></div>
          <fieldset className="min-w-0 space-y-3"><legend className="sr-only">优化方式</legend>{([{id:'agent',title:'Agent 协作',description:'先规划，按需追问，再逐条校验修改依据。',budget:'最多 8 次请求',Icon:Sparkles},{id:'quick',title:'快速润色',description:'直接生成描述建议，并进行一次失败修正。',budget:'最多 2 次请求',Icon:Zap}] as const).map(({id,title,description,budget,Icon})=><label key={id} className={`${styles.choice} block cursor-pointer rounded-2xl border p-4 ${mode===id?'border-primary/40 bg-primary/5':'bg-card hover:border-primary/25'}`}><span className="flex items-center gap-2"><Icon className="h-5 w-5 text-primary"/><span className="text-lg font-semibold">{title}</span><input type="radio" name="optimization-mode" value={id} checked={mode===id} disabled={busy} onChange={()=>setMode(id)} className="ml-auto h-4 w-4 accent-[hsl(var(--primary))]"/></span><span className="mt-2 block text-base leading-7 text-muted-foreground">{description}</span><span className="mt-3 inline-block rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">{budget}</span></label>)}</fieldset>
          {task?<form action={optimizeAction} className="shrink-0 space-y-3" onSubmit={event=>{if(task.suggestions.length&&!window.confirm('重新优化成功后会替换当前建议及审阅状态，已有草稿和版本不变。继续？'))event.preventDefault();}}><TaskFields task={task}/><input type="hidden" name="mode" value={mode}/><Button className="h-12 w-full rounded-xl" disabled={busy||!ready||!jd.trim()}>{optimizing?<Loader2 className="h-5 w-5 motion-safe:animate-spin"/>:<Sparkles className="h-5 w-5"/>}{optimizing?'正在优化…':mode==='agent'?'开始 Agent 优化':'开始快速润色'}</Button><p className="text-sm leading-6 text-muted-foreground">点击会将已选素材与 JD 发送至 DeepSeek，{mode==='agent'?'最多 8 次模型请求；补充内容仅用于本次优化。':'最多 2 次模型请求。'}</p><div className="max-h-20 overflow-auto"><Message state={optimizeState}/></div></form>:<p className="text-base leading-7 text-muted-foreground">请先在“准备素材”中保存岗位并选材。</p>}
        </aside>
        <div className="min-h-0 min-w-0">{task?<OptimizationProgress task={task} processing={optimizing} disabled={dirty||saving||selecting||recommending||optimizing||reviewing}/>:<div className={`${styles.surface} flex h-full flex-col items-center justify-center p-6 text-center`}><Sparkles className="mb-4 h-10 w-10 text-primary"/><h3 className="text-2xl font-semibold">从一段真实经历开始</h3><p className="mt-3 text-base leading-8 text-muted-foreground">先保存岗位，选好素材，再开始这次优化。</p></div>}</div>
      </div>
    </div>

    <div id="optimization-panel-review" className={panelClass('review')}><OptimizationReview task={task} busy={busy} dirty={dirty} action={reviewAction} state={reviewState}/></div>
    <footer className="flex h-[76px] shrink-0 items-center justify-between gap-3 border-t bg-muted/25 px-4 sm:px-6">
      <p role="status" className="min-w-0 text-sm leading-6 text-muted-foreground">{dirty?'有未保存的更改，请先保存。':busy?<span className="flex items-center gap-2"><Loader2 className="h-4 w-4 shrink-0 motion-safe:animate-spin"/>正在处理，进度会自动更新</span>:<span className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-primary"/>{task?'已保存到本地':'准备好后，保存岗位即可开始'}</span>}</p>
      {panel==='prepare'?<Button className="shrink-0 rounded-xl" variant="outline" disabled={!ready||busy} onClick={()=>onPanelChange('optimize')}>进入优化<ArrowRight className="h-4 w-4"/></Button>:panel==='optimize'?<Button className="shrink-0 rounded-xl" variant="outline" disabled={!task?.suggestions.length} onClick={()=>onPanelChange('review')}>审阅建议<ArrowRight className="h-4 w-4"/></Button>:task?<Button asChild className="shrink-0 rounded-xl" disabled={!ready||busy}><Link href={`/resumes/documents/${task.id}`} aria-disabled={!ready||busy} tabIndex={!ready||busy?-1:0} onClick={event=>{if(!ready||busy)event.preventDefault();}}>制作简历<ArrowRight className="h-4 w-4"/></Link></Button>:<Button variant="outline" onClick={()=>onPanelChange('prepare')}>先准备素材</Button>}
    </footer>
  </section>;
}
