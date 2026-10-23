'use client';

import { useState } from 'react';
import { Check, Circle, ListChecks, Quote, Route } from 'lucide-react';
import type { AgentTrace } from '../agent/contracts';
import styles from './optimization-workspace.module.css';

const views = [{id: 'plan', label: '行动计划', Icon: ListChecks}, {id: 'events', label: '执行记录', Icon: Route}, {id: 'evidence', label: '修改依据', Icon: Quote}] as const;
const labels = {pending: '待处理', in_progress: '进行中', completed: '已完成'};

export function AgentProgress({trace}: {trace: AgentTrace}) {
  const [view, setView] = useState<(typeof views)[number]['id']>('plan');
  return <div className="space-y-5">
    <div className="flex flex-wrap gap-1 rounded-2xl bg-muted/60 p-1" aria-label="执行信息视图">
      {views.map(({id, label, Icon}) => <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)} className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${view === id ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}><Icon className="hidden h-4 w-4 sm:block" />{label}</button>)}
    </div>
    <div key={view} className={styles.enter}>
      {view === 'plan' && <>
        {trace.plan.length ? <ol className="space-y-3">{trace.plan.map((step, index) => <li key={index} className={`flex items-start gap-3 rounded-2xl border p-4 ${step.status === 'in_progress' ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'}`}>
          <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${step.status === 'completed' ? 'bg-primary text-primary-foreground' : 'bg-muted text-primary'}`}>{step.status === 'completed' ? <Check className="h-4 w-4" /> : index + 1}</span>
          <div className="min-w-0"><p className="break-words text-base font-medium leading-7">{step.title}</p><p className="mt-1 text-sm text-muted-foreground">{labels[step.status]}</p></div>
        </li>)}</ol> : <p className="rounded-2xl bg-muted/50 p-5 text-base leading-7 text-muted-foreground">行动计划会在生成后显示在这里。</p>}
        <p className="mt-4 text-sm leading-6 text-muted-foreground">计划由模型维护，实际完成的动作可在执行记录中查看。</p>
      </>}
      {view === 'events' && (trace.events.length ? <ol className="space-y-4">{trace.events.map((event, index) => <li key={index} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm text-primary">{index + 1}</span><p className="min-w-0 break-words text-base leading-7">{event}</p></li>)}</ol> : <p className="p-5 text-base text-muted-foreground">执行后会记录每一步操作。</p>)}
      {view === 'evidence' && <>
        <p className="mb-4 text-sm leading-6 text-muted-foreground">引用已核对出处，改写后的职责和成果仍需要你确认。</p>
        {trace.evidence.length ? <ul className="space-y-3">{trace.evidence.map((ref, index) => <li key={index} className="rounded-2xl border border-primary/15 bg-primary/5 p-5"><p className="mb-2 text-sm font-medium text-primary">素材 #{ref.materialId} · {ref.source === 'material' ? '原文依据' : '你的补充'}</p><blockquote className="whitespace-pre-wrap break-words text-base leading-8">{ref.quote}</blockquote></li>)}</ul> : <div className="flex gap-3 rounded-2xl bg-muted/50 p-5 text-base leading-7 text-muted-foreground"><Circle className="mt-1 h-5 w-5 shrink-0" />提交修改建议后，引用依据会显示在这里。</div>}
      </>}
    </div>
    {trace.stopReason && <p className="rounded-xl bg-muted/50 p-4 text-base leading-7">{trace.stopReason}</p>}
  </div>;
}
