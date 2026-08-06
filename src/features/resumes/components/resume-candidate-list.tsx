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
import {
  resumeEntryTypeLabels,
  resumeEntryTypes,
  skillProficiencyLevels,
  type ResumeEntryType,
} from "@/features/resumes/constants";
import type { ResumeCandidateView } from "@/features/resumes/queries";
import type { ResumeEntryContent } from "@/features/resumes/schema";

function emptyContent(type: ResumeEntryType): ResumeEntryContent {
  switch (type) {
    case "project": return { projectCategory: "", techStack: [], content: "" };
    case "experience": return { position: "", techStack: [], responsibilities: "", workContent: "" };
    case "education": return { degree: "", major: "", dateRange: "", content: "" };
    case "skill": return { proficiency: "熟悉", content: "" };
    case "honor": return { award: "" };
  }
}

function CandidateCard({ candidate }: { candidate: ResumeCandidateView }) {
  const router = useRouter();
  const [type, setType] = useState(candidate.type);
  const [title, setTitle] = useState(candidate.title);
  const [content, setContent] = useState<ResumeEntryContent>(candidate.content);
  const [tags, setTags] = useState(candidate.tags);
  const [state, action, pending] = useActionState(acceptResumeCandidateAction, { success: false });
  const contentJson = useMemo(() => JSON.stringify(content), [content]);
  const effectiveTags = type === "skill" ? [title.trim()].filter(Boolean) : type === "honor" ? [] : tags;
  const validationError = Object.values(state.errors ?? {}).flat()[0];

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state]);

  function selectType(nextType: ResumeEntryType) {
    setType(nextType);
    setContent(emptyContent(nextType));
    if (nextType === "honor") setTags([]);
  }

  function setText(key: string, value: string | string[]) {
    setContent((current) => ({ ...(current as Record<string, unknown>), [key]: value } as ResumeEntryContent));
  }

  return (
    <article className="rounded-md border border-border bg-background p-4">
      <form action={action} className="space-y-3">
        <input type="hidden" name="candidateId" value={candidate.id} />
        <input type="hidden" name="contentJson" value={contentJson} />
        <input type="hidden" name="tagsJson" value={JSON.stringify(effectiveTags)} />
        <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
          <Select name="type" value={type} onChange={(event) => selectType(event.target.value as ResumeEntryType)} aria-label="候选条目类型">
            {resumeEntryTypes.map((entryType) => <option key={entryType} value={entryType}>{resumeEntryTypeLabels[entryType]}</option>)}
          </Select>
          <Input name="title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={type === "skill" ? 40 : 120} aria-label="候选条目标题" />
        </div>

        <CandidateContentFields type={type} content={content} setText={setText} />

        {type === "project" || type === "experience" || type === "education" ? <label className="block text-sm text-foreground">
          <span className="mb-1 block text-xs text-muted-foreground">标签</span>
          <Input value={tags.join("，")} maxLength={491} onChange={(event) => setTags(event.target.value.split(/[，,]/).map((tag) => tag.trim()).filter(Boolean))} />
        </label> : type === "skill" ? <p className="text-xs text-muted-foreground">标签将自动同步为“{title || "技能名称"}”。</p> : null}

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
        {state.message || validationError ? <p className={`text-xs ${state.success ? "text-muted-foreground" : "text-destructive"}`}>{state.message ?? validationError}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={pending}>{pending ? "正在加入…" : "确认加入条目仓库"}</Button>
          <Button type="submit" size="sm" variant="ghost" formAction={ignoreResumeCandidateAction}>忽略</Button>
        </div>
      </form>
    </article>
  );
}

function CandidateContentFields({
  type,
  content,
  setText,
}: {
  type: ResumeEntryType;
  content: ResumeEntryContent;
  setText: (key: string, value: string | string[]) => void;
}) {
  const values = content as Record<string, unknown>;
  const stringValue = (key: string) => typeof values[key] === "string" ? values[key] as string : "";
  const listValue = (key: string) => Array.isArray(values[key]) ? (values[key] as string[]).join("，") : "";
  const input = (key: string, label: string) => <label className="block text-sm text-foreground">
    <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
    <Input value={stringValue(key)} maxLength={200} onChange={(event) => setText(key, event.target.value)} />
  </label>;
  const textarea = (key: string, label: string) => <label className="block text-sm text-foreground">
    <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
    <Textarea value={stringValue(key)} maxLength={4_000} onChange={(event) => setText(key, event.target.value)} rows={3} />
  </label>;
  const techStack = <label className="block text-sm text-foreground">
    <span className="mb-1 block text-xs text-muted-foreground">技术栈</span>
    <Input value={listValue("techStack")} onChange={(event) => setText("techStack", event.target.value.split(/[，,]/).map((item) => item.trim()).filter(Boolean))} />
  </label>;

  if (type === "project") return <div className="space-y-3">{input("projectCategory", "项目分类")}{techStack}{textarea("content", "项目内容")}</div>;
  if (type === "experience") return <div className="space-y-3">{input("position", "岗位")}{techStack}{textarea("responsibilities", "工作职责")}{textarea("workContent", "工作内容")}</div>;
  if (type === "education") return <div className="space-y-3">{input("degree", "学历")}{input("major", "专业")}{input("dateRange", "就读时间")}{textarea("content", "教育内容")}</div>;
  if (type === "skill") return <div className="space-y-3">
    <label className="block text-sm text-foreground">
      <span className="mb-1 block text-xs text-muted-foreground">掌握程度</span>
      <Select value={stringValue("proficiency")} onChange={(event) => setText("proficiency", event.target.value)}>
        {skillProficiencyLevels.map((level) => <option key={level} value={level}>{level}</option>)}
      </Select>
    </label>
    {textarea("content", "技能内容")}
  </div>;
  return <div className="space-y-3">{input("award", "奖项或等级")}</div>;
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
