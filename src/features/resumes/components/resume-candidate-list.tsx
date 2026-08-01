"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  acceptResumeCandidateAction,
  ignoreResumeCandidateAction,
} from "@/features/resumes/candidate-actions";
import { resumeEntryTypes, type ResumeEntryType } from "@/features/resumes/constants";
import type { ResumeCandidateView } from "@/features/resumes/queries";

const typeLabels: Record<ResumeEntryType, string> = {
  profile: "个人信息",
  education: "教育经历",
  experience: "工作/实习经历",
  project: "项目经历",
  skill: "技能",
};

function CandidateCard({ candidate }: { candidate: ResumeCandidateView }) {
  const router = useRouter();
  const [type, setType] = useState(candidate.type);
  const [title, setTitle] = useState(candidate.title);
  const [content, setContent] = useState(candidate.content);
  const [state, action, pending] = useActionState(acceptResumeCandidateAction, { success: false });
  const contentJson = useMemo(() => JSON.stringify(content), [content]);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state]);

  return (
    <article className="rounded-md border border-border bg-background p-4">
      <form action={action} className="space-y-3">
        <input type="hidden" name="candidateId" value={candidate.id} />
        <input type="hidden" name="contentJson" value={contentJson} />
        <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
          <Select name="type" value={type} onChange={(event) => setType(event.target.value as ResumeEntryType)} aria-label="候选条目类型">
            {resumeEntryTypes.map((entryType) => <option key={entryType} value={entryType}>{typeLabels[entryType]}</option>)}
          </Select>
          <Input name="title" value={title} onChange={(event) => setTitle(event.target.value)} aria-label="候选条目标题" />
        </div>
        <div className="space-y-3">
          {Object.entries(content).map(([key, value]) => (
            <label key={key} className="block text-sm text-foreground">
              <span className="mb-1 block text-xs text-muted-foreground">{key}</span>
              <Textarea
                value={value}
                onChange={(event) => setContent((current) => ({ ...current, [key]: event.target.value }))}
                rows={2}
              />
            </label>
          ))}
        </div>
        <div className="rounded-md bg-muted/60 p-3">
          <p className="text-xs font-medium text-foreground">原文依据</p>
          <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{candidate.sourceExcerpt}</p>
        </div>
        {candidate.duplicateKind !== "none" ? (
          <p className="text-xs text-amber-700">
            {candidate.duplicateKind === "exact" ? "发现完全相同的正式条目" : "AI 判断可能与已有条目语义重复"}
            {candidate.duplicateEntryTitle ? `：“${candidate.duplicateEntryTitle}”` : ""}。请核对后决定。
          </p>
        ) : null}
        {state.message ? <p className={`text-xs ${state.success ? "text-muted-foreground" : "text-destructive"}`}>{state.message}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={pending}>{pending ? "正在加入…" : "确认加入条目仓库"}</Button>
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            formAction={ignoreResumeCandidateAction}
          >
            忽略
          </Button>
        </div>
      </form>
    </article>
  );
}

export function ResumeCandidateList({ candidates }: { candidates: ResumeCandidateView[] }) {
  const pendingCandidates = candidates.filter((candidate) => candidate.state === "pending");
  if (!pendingCandidates.length) {
    return <p className="rounded-md border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">暂无待确认候选。可在已解析的 PDF 下点击“生成结构化条目”。</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{pendingCandidates.length} 条待确认</Badge>
        <span className="text-xs text-muted-foreground">AI 结果不会自动进入正式条目仓库。</span>
      </div>
      {pendingCandidates.map((candidate) => <CandidateCard key={candidate.id} candidate={candidate} />)}
    </div>
  );
}
