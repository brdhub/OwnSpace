'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Github, Loader2, ExternalLink, FileCheck2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { startGithubAction, resumeGithubAction, acceptGithubAction, type GithubActionState } from './actions';
import { MAX_FILES, MAX_MODEL_CALLS, sourceUrl, type GithubInput, type GithubView } from './contracts';
import type { GithubRun } from './store';
import styles from '../components/optimization-workspace.module.css';

export type GithubRunView = Omit<GithubRun, 'inputJson' | 'viewJson' | 'leaseToken'> & {input: GithubInput; view: GithubView};
const initial: GithubActionState = {success: false};
const statuses = {ready: '准备读取', running: '正在分析', waiting: '等待补充', completed: '待审阅', failed: '暂未完成', accepted: '已入库'};
function Message({state}: {state: GithubActionState}) {return state.message ? <p role="status" className={`text-sm leading-6 ${state.success ? 'text-primary' : 'text-destructive'}`}>{state.message}</p> : null;}
function Consent({children}: {children: React.ReactNode}) {return <label className="flex items-start gap-2 text-sm leading-6"><input className="mt-1 h-4 w-4 shrink-0" type="checkbox" name="consent" required />{children}</label>;}

export function GithubWorkspace({runs}: {runs: GithubRunView[]}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [state, action, pending] = useActionState(startGithubAction, initial);
  const router = useRouter();
  const run = runs.find(item => item.id === selected) ?? runs[0];
  useEffect(() => {if (state.runId) {setSelected(state.runId); router.refresh();}}, [state, router]);
  useEffect(() => {
    if (!pending && !runs.some(item => item.status === 'running' && item.leaseUntil > Date.now())) return;
    const timer = window.setInterval(() => router.refresh(), 3000);
    return () => window.clearInterval(timer);
  }, [pending, runs, router]);
  return <section className={styles.workspace} aria-label="GitHub 项目解析">
    <header className={`${styles.surface} flex shrink-0 flex-wrap items-center justify-between gap-3 border-b p-5`}>
      <div><h2 className="flex items-center gap-2 text-xl font-semibold"><Github className="h-5 w-5"/>从代码到项目经历</h2><p className="mt-1 text-sm text-muted-foreground">按目标岗位寻找代码依据，由你确认实际贡献。</p></div>
      {runs.length > 0 && <label className="text-sm">分析记录<Select className="mt-1 max-w-[240px]" value={run?.id} disabled={pending} onChange={event => setSelected(event.target.value)}>{runs.map(item => <option key={item.id} value={item.id}>{item.input.targetRole} · {statuses[item.status]}</option>)}</Select></label>}
    </header>
    <div className={`${styles.scroll} grid min-h-0 flex-1 grid-rows-[max-content_minmax(420px,1fr)] md:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)] md:grid-rows-1`}>
      <form action={action} onSubmit={() => setSelected(null)} className={`${styles.scroll} space-y-4 border-b p-5 md:border-b-0 md:border-r`}>
        <label className="block space-y-2 font-medium">公开仓库链接<Input name="repositoryUrl" type="url" required maxLength={300} placeholder="https://github.com/作者/项目" /></label>
        <label className="block space-y-2 font-medium">目标岗位<Input name="targetRole" required maxLength={120} placeholder="例如：Agent 开发工程师" /></label>
        <label className="block space-y-2 font-medium">目标 JD <span className="text-sm text-muted-foreground">可选</span><Textarea name="jdText" maxLength={20000} rows={5} className="h-40 leading-7" placeholder="填写职责和要求，让分析更有侧重。" /></label>
        <div className="rounded-xl bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">仅分析公开仓库，固定到一个提交版本。最多读取 {MAX_FILES} 个文本文件、80,000 字符，最多 {MAX_MODEL_CALLS} 次模型请求。不会运行仓库代码。</div>
        <Consent>同意读取此仓库，并将目录、选定代码、目标岗位和 JD 发送至本机配置的 DeepSeek；我有权使用这些材料。</Consent>
        <Button className="h-11 w-full rounded-xl" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin"/>}{pending ? '正在分析…' : '新建项目分析'}</Button>
        <Message state={state}/>
      </form>
      <div className="flex min-h-0 min-w-0 flex-col">
        {run ? <RunPanel key={run.id} run={run} busy={pending}/> : <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center"><FileCheck2 className="h-10 w-10 text-primary"/><h3 className="text-xl font-semibold">让项目描述有据可查</h3><p className="max-w-md text-base leading-8 text-muted-foreground">填写链接和目标岗位，Agent 会选择关键文件进行分析，再请你补充个人贡献。生成的草稿可修改，确认后进入简历仓库。</p></div>}
      </div>
    </div>
  </section>;
}

function RunPanel({run, busy}: {run: GithubRunView; busy: boolean}) {
  const [state, action, pending] = useActionState(resumeGithubAction, initial);
  const router = useRouter();
  const view = run.view;
  useEffect(() => {if (state.runId) router.refresh();}, [state, router]);
  const running = run.status === 'running' && run.leaseUntil > Date.now();
  const canResume = !running && ['ready', 'running', 'waiting', 'failed'].includes(run.status);
  return <>
    <header className="shrink-0 border-b px-5 py-4"><h3 role="status" className="text-lg font-semibold">{run.status === 'running' && !running ? '执行已中断，可继续' : statuses[run.status]}</h3><p className="mt-1 text-sm text-muted-foreground">模型请求 {run.callCount}/{MAX_MODEL_CALLS} · 已读 {view.files.length}/{MAX_FILES} 个文件</p></header>
    <div className={`${styles.scroll} flex-1 space-y-5 p-5`}>
      {run.error && <p role="alert" className="rounded-xl bg-destructive/5 p-3 text-sm leading-6 text-destructive">{run.error}</p>}
      {view.repository && <p className="break-all text-sm text-muted-foreground"><a href={`${view.repository.url}/tree/${view.repository.commit}`} target="_blank" rel="noreferrer" className="text-primary underline">{view.repository.owner}/{view.repository.repo} · {view.repository.commit.slice(0, 8)}</a><span className="mt-1 block">目录中有 {view.repository.omitted} 个文件因类型或大小限制未纳入分析。</span></p>}
      {view.question && <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4"><label className="block text-base leading-7">{view.question}<Textarea form={`github-resume-${run.id}`} name="facts" maxLength={Math.max(0, 4000 - view.facts.length - (view.facts ? 1 : 0))} className="mt-3 h-32 bg-card leading-7" placeholder="说明你负责的模块、技术决策与可确认成果；留空表示暂不确认个人贡献。" /></label><p className="mt-2 text-sm leading-6 text-muted-foreground">代码只能证明项目实现，不能证明由你完成。补充内容会发送给模型。</p></div>}
      {view.draft && <DraftReview run={run}/>}
      {view.plan.length > 0 && <details open={!view.draft && !view.question}><summary className="cursor-pointer font-medium">行动计划</summary><ol className="mt-3 list-inside list-decimal space-y-2 text-base leading-7">{view.plan.map((step, index) => <li key={index}>{step}</li>)}</ol></details>}
      {view.files.length > 0 && <details><summary className="cursor-pointer font-medium">已读取的文件</summary><ul className="mt-3 space-y-2 text-sm">{view.files.map(file => <li key={file.path} className="break-all">{file.path}</li>)}</ul></details>}
      {view.events.length > 0 && <details><summary className="cursor-pointer font-medium">执行记录</summary><ol className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">{view.events.map((item, index) => <li key={index}>{item}</li>)}</ol></details>}
      <Message state={state}/>
    </div>
    {canResume && <form id={`github-resume-${run.id}`} action={action} className="shrink-0 space-y-2 border-t p-4"><input type="hidden" name="id" value={run.id}/><Consent>继续可能读取代码并调用 DeepSeek，累计额度不重置。</Consent><Button disabled={busy || pending || run.callCount >= MAX_MODEL_CALLS} className="rounded-xl">{pending ? '正在继续…' : view.question ? '提交补充并继续（可留空）' : '从存档继续'}</Button></form>}
    {run.status === 'accepted' && <footer className="shrink-0 border-t p-4"><Button asChild variant="outline"><Link href="/resumes">前往简历仓库</Link></Button></footer>}
  </>;
}

function DraftReview({run}: {run: GithubRunView}) {
  const [state, action, pending] = useActionState(acceptGithubAction, initial);
  const router = useRouter();
  useEffect(() => {if (state.success) router.refresh();}, [state, router]);
  const draft = run.view.draft!;
  const accepted = run.status === 'accepted';
  return <div className="space-y-4">
    <div><h3 className="text-xl font-semibold">项目经历草稿</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">引用校验不代表语义与个人贡献已核实。请对照代码核对技术栈、描述与实际职责，再确认入库。</p></div>
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={run.id}/>
      <fieldset disabled={accepted || pending} className="min-w-0 space-y-4">
        <label className="block space-y-2">项目名称<Input name="title" required maxLength={120} defaultValue={draft.title}/></label>
        <label className="block space-y-2">项目分类<Input name="projectCategory" maxLength={200} defaultValue={draft.projectCategory}/></label>
        <label className="block space-y-2">技术栈（逗号分隔）<Input name="techStack" maxLength={2000} defaultValue={draft.techStack.join('、').replaceAll('、', ', ')}/></label>
        <label className="block space-y-2">项目描述<Textarea name="content" required maxLength={4000} className="h-56 leading-7" defaultValue={draft.bullets.map(item => item.text).join('\n')}/></label>
        <label className="block space-y-2">个人职责（保留你补充的原话，可编辑）<Textarea name="responsibilities" maxLength={4000} className="h-32 leading-7" defaultValue={run.view.facts}/></label>
        {!accepted && <><label className="flex items-start gap-2 text-sm leading-6"><input type="checkbox" name="confirmed" required className="mt-1 h-4 w-4"/>我已核实描述与个人贡献，同意保存为正式项目条目。</label><Button className="rounded-xl" disabled={pending}>{pending ? '正在保存…' : '确认入库'}</Button></>}
      </fieldset>
      <Message state={state}/>
    </form>
    <div className="rounded-2xl border p-4"><h4 className="font-semibold">生成依据</h4><p className="mt-2 text-sm leading-6 text-muted-foreground">{draft.rationale} 以下证据对应生成时的草稿，你手动修改后的内容需自行核对。</p>{draft.bullets.map((bullet, index) => <details key={index} className="mt-4"><summary className="cursor-pointer text-base leading-7">第 {index + 1} 条：{bullet.text}</summary>{bullet.evidence.map((ref, i) => <div key={i} className="mt-3 rounded-xl bg-muted/40 p-3"><a className="flex items-start gap-1 break-all text-sm text-primary underline" target="_blank" rel="noreferrer" href={sourceUrl(run.view.repository!, ref.path, ref.startLine, ref.endLine)}>{ref.path}:{ref.startLine}–{ref.endLine}<ExternalLink className="h-4 w-4 shrink-0"/></a><pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-sm leading-6">{ref.quote}</pre></div>)}</details>)}</div>
  </div>;
}
