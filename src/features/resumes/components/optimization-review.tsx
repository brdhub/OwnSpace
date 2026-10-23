'use client';

import { useState } from 'react';
import { Check, FileCheck2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { JdTaskView } from '../queries';
import type { ResumeActionState } from '../actions';
import { formatExperienceProjects, getExperienceProjects } from '../experience-projects';
import { SupplementRewrite } from './optimization-progress';
import styles from './optimization-workspace.module.css';

const fieldLabels: Record<string,string> = {projectCategory:'项目分类',techStack:'技术栈',content:'内容',position:'岗位',responsibilities:'个人职责',projects:'负责项目',workContent:'工作内容',degree:'学历',major:'专业',dateRange:'时间',proficiency:'掌握程度',award:'奖项'};

export function OptimizationReview({task, busy, dirty, action, state}: {
  task: JdTaskView | null; busy: boolean; dirty: boolean;
  action: (formData: FormData) => void; state: ResumeActionState;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const suggestion = task?.suggestions.find(item => item.id === selectedId) ?? task?.suggestions[0];
  if (!task || !suggestion) return <div className={`${styles.scroll} h-full`}><div className="flex min-h-full flex-col items-center justify-center px-6 py-6 text-center"><span className="mb-5 rounded-3xl bg-primary/10 p-5 text-primary"><FileCheck2 className="h-9 w-9" /></span><h3 className="text-2xl font-semibold">让每一处修改都有依据</h3><p className="mt-3 max-w-md text-base leading-8 text-muted-foreground">完成优化后，在这里对照原文逐条审阅。接受的建议会用于制作新简历。</p></div></div>;
  const accepted = task.suggestions.filter(item => item.state === 'accepted').length;
  return <div className="grid h-full min-h-0 min-w-0 grid-rows-[100px_minmax(0,1fr)] md:grid-cols-[220px_minmax(0,1fr)] md:grid-rows-1">
    <aside className={`${styles.scroll} border-b bg-muted/25 p-3 md:border-b-0 md:border-r md:p-4`} aria-label="待审阅条目">
      <p className="mb-3 hidden text-sm text-muted-foreground md:block">{accepted} / {task.suggestions.length} 条已接受</p>
      <div className="flex gap-2 md:flex-col">{task.suggestions.map((item, index) => <button key={item.id} type="button" aria-pressed={item.id === suggestion.id} onClick={() => setSelectedId(item.id)} className={`w-52 shrink-0 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:w-full ${item.id === suggestion.id ? 'border-primary/35 bg-primary/10' : 'border-transparent hover:bg-muted'}`}><span className="mb-1 flex items-center justify-between text-sm text-muted-foreground"><span>条目 {index + 1}</span>{item.state === 'accepted' && <Check className="h-4 w-4 text-primary" />}</span><span className="line-clamp-2 text-base font-medium">{item.title}</span></button>)}</div>
    </aside>
    <article className="flex min-h-0 min-w-0 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-4"><h3 className="truncate text-lg font-semibold" title={suggestion.title}>{suggestion.title}</h3><span className="shrink-0 rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">{suggestion.stale ? '建议已过期' : {pending:'待审阅',accepted:'已接受',ignored:'已忽略'}[suggestion.state]}</span></header>
      <div key={suggestion.id} className={`${styles.scroll} ${styles.enter} min-w-0 flex-1 p-4 lg:p-6`}>
        <div className="grid items-start gap-4 lg:grid-cols-2">{[suggestion.originalContent, suggestion.proposedContent].map((content, index) => <section key={index} className={`min-w-0 rounded-2xl border p-5 ${index ? 'border-primary/20 bg-primary/5' : 'bg-muted/30'}`}><h4 className={`mb-4 text-base font-semibold ${index ? 'text-primary' : 'text-muted-foreground'}`}>{index ? '优化建议' : '原始描述'}</h4><dl className="space-y-4">{Object.entries(content).map(([key, value]) => <div key={key}><dt className="mb-1 text-sm text-muted-foreground">{fieldLabels[key] ?? key}</dt><dd className="whitespace-pre-wrap break-words text-base leading-8">{Array.isArray(value) ? key === 'projects' ? formatExperienceProjects(getExperienceProjects(content)) : value.join('、') : value || '—'}</dd></div>)}</dl></section>)}</div>
        <p className="mt-5 rounded-xl bg-muted/40 p-4 text-base leading-7"><span className="mb-1 block text-sm font-medium text-primary">为什么这样改</span>{suggestion.rationale}</p>
        <SupplementRewrite key={suggestion.id} taskId={task.id} inputRevision={task.inputRevision ?? 1} materialId={suggestion.materialId} disabled={busy || dirty || suggestion.stale} />
      </div>
      <footer className="shrink-0 border-t bg-card px-5 py-3">
        <form action={action} className="flex flex-wrap items-center justify-end gap-2"><input type="hidden" name="suggestionId" value={suggestion.id} />{suggestion.state === 'pending' ? <><Button name="state" value="ignored" variant="ghost" disabled={busy || dirty || suggestion.stale}>保留原文</Button><Button name="state" value="accepted" className="rounded-xl" disabled={busy || dirty || suggestion.stale}><Check className="h-4 w-4" />接受这条建议</Button></> : <Button name="state" value="pending" variant="outline" className="rounded-xl" disabled={busy || dirty}><Undo2 className="h-4 w-4" />撤销决定</Button>}</form>
        {state.message && <p role="status" className={`mt-2 max-h-14 overflow-auto text-sm ${state.success ? 'text-muted-foreground' : 'text-destructive'}`}>{state.message}</p>}
      </footer>
    </article>
  </div>;
}
