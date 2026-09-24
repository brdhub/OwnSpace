"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2, MessagesSquare, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { deleteInterviewSessionAction, retryInterviewEvaluationAction, startInterviewAction, submitInterviewAnswerAction } from "../interview-actions";
import { buildInterviewReport } from "../interview-model";
import type { getInterviewSession, getInterviewSessions, getInterviewSetup } from "../interview-queries";

type Props = {
  setup: Awaited<ReturnType<typeof getInterviewSetup>>;
  sessions: Awaited<ReturnType<typeof getInterviewSessions>>;
  session: Awaited<ReturnType<typeof getInterviewSession>>;
  contextError?: string;
};

export function InterviewSimulator({ setup, sessions, session, contextError }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const defaultResumeId = setup.assets.find(asset => asset.id === setup.application?.resumeAssetId)?.id ?? setup.assets[0]?.id ?? 0;
  const [resumeAssetId, setResumeAssetId] = useState(defaultResumeId);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { setAnswer(""); }, [session?.id, session?.currentIndex, session?.phase]);
  useEffect(() => { setResumeAssetId(defaultResumeId); }, [setup.application?.id, defaultResumeId]);

  const openSession = (id: number, applicationId?: number | null) => {
    const query = new URLSearchParams({ sessionId: String(id) });
    if (applicationId) query.set("applicationId", String(applicationId));
    router.push(`/ai-hub?${query.toString()}#interview-simulator`);
    router.refresh();
  };
  const begin = () => {
    if (!setup.application || !resumeAssetId) return;
    setError("");
    startTransition(async () => {
      const result = await startInterviewAction(setup.application!.id, resumeAssetId);
      if (result.success && result.sessionId) openSession(result.sessionId, setup.application!.id);
      else setError(result.message ?? "开始失败，请重试。");
    });
  };
  const submit = () => {
    if (!session || !answer.trim()) return;
    setError("");
    startTransition(async () => {
      const result = await submitInterviewAnswerAction(session.id, answer);
      if (result.success) router.refresh();
      else { setError(result.message ?? "提交失败，请重试。"); router.refresh(); }
    });
  };
  const retry = () => {
    if (!session) return;
    setError("");
    startTransition(async () => {
      const result = await retryInterviewEvaluationAction(session.id);
      if (!result.success) setError(result.message ?? "重试失败，请稍后再试。");
      router.refresh();
    });
  };
  const remove = () => {
    if (!session || !window.confirm("确定删除这次模拟面试及所有回答和复盘吗？此操作无法撤销。")) return;
    setError("");
    startTransition(async () => {
      const result = await deleteInterviewSessionAction(session.id);
      if (result.success) router.push("/ai-hub#interview-simulator");
      else setError(result.message ?? "删除失败，请重试。");
      router.refresh();
    });
  };

  const current = session?.questions[session.currentIndex];
  const followup = session?.phase === "followup_answer" || session?.phase === "evaluating_followup";
  const evaluating = session?.phase === "evaluating_main" || session?.phase === "evaluating_followup";

  return <section id="interview-simulator" className="scroll-mt-6 space-y-4">
    <div className="flex items-center gap-2"><h2 className="text-sm font-semibold text-muted-foreground">面试准备</h2><span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">文字模拟</span></div>
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
      <CardHeader className="flex flex-row items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><MessagesSquare className="h-5 w-5" /></div>
        <div><CardTitle>基于 JD 的面试模拟</CardTitle><p className="mt-2 text-sm leading-6 text-muted-foreground">从真实岗位要求出发，回答 5 道问题，最多每题追问一次，结束后查看复盘。</p></div>
      </CardHeader>
      <CardContent className="space-y-5">
        {contextError && <p className="rounded-md border p-3 text-sm text-muted-foreground">{contextError}</p>}
        {setup.application && <div className="rounded-lg border bg-background/80 p-4">
          <p className="font-medium">{setup.application.company} · {setup.application.role}</p>
          <p className="mt-1 text-sm text-muted-foreground">{setup.application.hasJd ? "已关联 JD" : "这条投递尚未填写 JD，请先在投递记录中补充。"}</p>
          {!setup.application.hasJd && <a href="/applications" className="mt-1 inline-block text-sm text-primary underline underline-offset-2">前往投递记录</a>}
          <label htmlFor="interview-resume" className="mt-4 block text-sm font-medium">本次使用的简历</label>
          <select id="interview-resume" className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={resumeAssetId} onChange={event => setResumeAssetId(Number(event.target.value))}>
            <option value={0}>请选择已提取文本的简历</option>
            {setup.assets.map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
          </select>
          {setup.assets.length === 0 && <a href="/resumes" className="mt-2 inline-block text-sm text-primary underline underline-offset-2">还没有可用简历，前往简历模块上传并提取文本</a>}
          <p className="mt-2 text-xs leading-5 text-muted-foreground">点击开始后，当前 JD 和所选简历文本会发送给已配置的 DeepSeek；题目与回答保存在本机。每次提交回答会再发起一次评估请求。</p>
          <Button className="mt-3" type="button" onClick={begin} disabled={pending || !setup.application.hasJd || !resumeAssetId}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}开始新模拟
          </Button>
        </div>}
        {!setup.application && !session && <p className="rounded-md border bg-background p-4 text-sm text-muted-foreground">从带有 JD 的投递记录进入，选择简历后即可开始。已有会话可在下方继续。</p>}
        {session && <div className="space-y-5 rounded-xl border bg-background p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
            <div><p className="text-xs uppercase tracking-widest text-primary">Interview session</p><h3 className="mt-1 text-lg font-semibold">{session.company} · {session.role}</h3><p className="text-xs text-muted-foreground">简历快照：{session.resumeName} · {session.model} · {session.phase === "complete" ? "已完成" : `第 ${session.currentIndex + 1} / 5 题`}</p></div>
            <Button type="button" variant="outline" size="sm" className="text-red-700 hover:text-red-800" onClick={remove} disabled={pending}><Trash2 className="mr-1 h-4 w-4" />删除</Button>
          </div>
          {session.questions.slice(0, session.phase === "complete" ? 5 : session.currentIndex + 1).map((question, index) => <div key={index} className="space-y-2 rounded-lg border p-4">
            <div className="flex items-center gap-2"><span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">{String(index + 1).padStart(2, "0")}</span><span className="text-xs text-muted-foreground">{question.category}</span></div>
            <p className="font-medium leading-7">{question.prompt}</p><p className="text-xs text-muted-foreground">JD 依据：{question.jdBasis}</p>
            {question.answer && <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">你的回答：{question.answer}</p>}
            {question.feedback && <div className="space-y-1 border-l-2 border-emerald-300 pl-3 text-sm"><p><strong>做得好：</strong>{question.feedback.strength}</p><p><strong>可补充：</strong>{question.feedback.gap}</p><p><strong>下次试试：</strong>{question.feedback.suggestion}</p></div>}
            {question.feedback?.followup && <p className="text-sm font-medium">追问：{question.feedback.followup}</p>}
            {question.followupAnswer && <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">追问回答：{question.followupAnswer}</p>}
            {question.followupFeedback && <div className="space-y-1 border-l-2 border-sky-300 pl-3 text-sm"><p><strong>追问反馈：</strong>{question.followupFeedback.strength}</p><p>{question.followupFeedback.gap}</p><p>{question.followupFeedback.suggestion}</p></div>}
          </div>)}
          {current && !evaluating && session.phase !== "complete" && <div className="space-y-3">
            <label htmlFor="interview-answer" className="block text-sm font-medium">{followup ? "回答追问" : "回答当前问题"}</label>
            <Textarea id="interview-answer" rows={6} maxLength={5000} value={answer} onChange={event => setAnswer(event.target.value)} placeholder="用自己的经历和思路作答；不确定时也可以说明。" />
            <Button type="button" onClick={submit} disabled={pending || answer.trim().length < 2}>{pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}提交并查看反馈</Button>
          </div>}
          {evaluating && <div className="rounded-lg border bg-muted/30 p-4 text-sm"><p>{session.busy || pending ? "正在评估回答…若页面刷新后仍停在这里，请稍后恢复。" : "回答已保存，评估尚未完成。"}</p><Button className="mt-3" type="button" variant="outline" onClick={retry} disabled={pending}><RotateCcw className="mr-2 h-4 w-4" />重试或恢复评估</Button></div>}
          {session.phase === "complete" && <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4"><h4 className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5 text-emerald-700" />本次复盘</h4><p className="mt-1 text-xs text-muted-foreground">以下内容根据每题反馈整理，供下一次练习参考，不代表真实面试结果。</p><ol className="mt-3 space-y-3">{buildInterviewReport(session.questions).map(item => <li key={item.number} className="text-sm"><strong>{item.number}. {item.category}</strong><p className="mt-1">改进重点：{item.gap}</p><p>行动建议：{item.suggestion}</p></li>)}</ol></div>}
        </div>}
        {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      </CardContent>
    </Card>
    {sessions.length > 0 && <Card><CardHeader><CardTitle className="text-base">最近的模拟</CardTitle></CardHeader><CardContent className="space-y-2">{sessions.map(item => <button key={item.id} type="button" onClick={() => openSession(item.id, item.applicationId)} className="flex w-full items-center justify-between rounded-md border px-3 py-3 text-left text-sm transition-colors hover:bg-muted/60"><span>{item.company} · {item.role}<span className="ml-2 text-xs text-muted-foreground">{item.createdAt.slice(0, 10)}</span></span><span className="text-xs text-muted-foreground">{item.phase === "complete" ? "查看复盘" : "继续"} →</span></button>)}</CardContent></Card>}
  </section>;
}
