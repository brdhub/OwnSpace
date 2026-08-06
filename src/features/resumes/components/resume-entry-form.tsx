"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createResumeEntryAction, type ResumeActionState, updateResumeEntryAction } from "@/features/resumes/actions";
import {
  resumeEntryTypeLabels,
  resumeEntryTypes,
  skillProficiencyLevels,
  type ResumeEntryType,
} from "@/features/resumes/constants";
import type { ResumeEntryView } from "@/features/resumes/queries";

const initialState: ResumeActionState = { success: false };

const titleLabels: Record<ResumeEntryType, string> = {
  project: "项目名称",
  experience: "公司或组织名称",
  education: "学校名称",
  skill: "技能名称",
  honor: "荣誉或认证名称",
};

function contentValue(entry: ResumeEntryView | undefined, key: string) {
  const value = entry ? (entry.content as Record<string, unknown>)[key] : undefined;
  return typeof value === "string" ? value : "";
}

function listValue(entry: ResumeEntryView | undefined, key: string) {
  const value = entry ? (entry.content as Record<string, unknown>)[key] : undefined;
  return Array.isArray(value) ? value.join("，") : "";
}

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.[0] ? <p className="text-sm text-destructive">{errors[0]}</p> : null;
}

export function ResumeEntryForm({ entry, onDone }: { entry?: ResumeEntryView; onDone: () => void }) {
  const action = entry ? updateResumeEntryAction : createResumeEntryAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [type, setType] = useState<ResumeEntryType>(entry?.type ?? "project");

  useEffect(() => {
    if (state.success) onDone();
  }, [onDone, state.success]);

  return (
    <form action={formAction} className="space-y-4">
      {entry ? <input type="hidden" name="id" value={entry.id} /> : null}
      <div className="space-y-2">
        <Label htmlFor="resume-entry-type">类型</Label>
        <Select id="resume-entry-type" name="type" value={type} onChange={(event) => setType(event.target.value as ResumeEntryType)}>
          {resumeEntryTypes.map((entryType) => <option key={entryType} value={entryType}>{resumeEntryTypeLabels[entryType]}</option>)}
        </Select>
        <FieldError errors={state.errors?.type} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="resume-entry-title">{titleLabels[type]}</Label>
        <Input id="resume-entry-title" name="title" defaultValue={entry?.title ?? ""} maxLength={type === "skill" ? 40 : 120} required />
        <FieldError errors={state.errors?.title} />
      </div>

      {type === "project" ? <>
        <div className="space-y-2">
          <Label htmlFor="resume-entry-project-category">项目分类</Label>
          <Input id="resume-entry-project-category" name="projectCategory" defaultValue={contentValue(entry, "projectCategory")} placeholder="例如：后端项目、AI Agent、数据分析" />
        </div>
        <TechStackField entry={entry} />
        <ContentField entry={entry} label="项目内容" />
      </> : null}

      {type === "experience" ? <>
        <div className="space-y-2">
          <Label htmlFor="resume-entry-position">岗位</Label>
          <Input id="resume-entry-position" name="position" defaultValue={contentValue(entry, "position")} />
        </div>
        <TechStackField entry={entry} />
        <div className="space-y-2">
          <Label htmlFor="resume-entry-responsibilities">工作职责</Label>
          <Textarea id="resume-entry-responsibilities" name="responsibilities" defaultValue={contentValue(entry, "responsibilities")} maxLength={4_000} rows={3} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="resume-entry-work-content">工作内容</Label>
          <Textarea id="resume-entry-work-content" name="workContent" defaultValue={contentValue(entry, "workContent")} maxLength={4_000} rows={4} />
        </div>
      </> : null}

      {type === "education" ? <>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="resume-entry-degree">学历</Label>
            <Input id="resume-entry-degree" name="degree" defaultValue={contentValue(entry, "degree")} placeholder="例如：硕士" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="resume-entry-major">专业</Label>
            <Input id="resume-entry-major" name="major" defaultValue={contentValue(entry, "major")} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="resume-entry-date-range">就读时间</Label>
          <Input id="resume-entry-date-range" name="dateRange" defaultValue={contentValue(entry, "dateRange")} placeholder="例如：2024.09 - 2027.06" />
        </div>
        <ContentField entry={entry} label="教育内容" />
      </> : null}

      {type === "skill" ? <>
        <div className="space-y-2">
          <Label htmlFor="resume-entry-proficiency">掌握程度</Label>
          <Select id="resume-entry-proficiency" name="proficiency" defaultValue={contentValue(entry, "proficiency") || "熟悉"}>
            {skillProficiencyLevels.map((level) => <option key={level} value={level}>{level}</option>)}
          </Select>
        </div>
        <ContentField entry={entry} label="技能内容" />
        <p className="text-xs text-muted-foreground">标签会自动与技能名称保持一致。</p>
      </> : null}

      {type === "honor" ? <div className="space-y-2">
        <Label htmlFor="resume-entry-award">奖项或等级</Label>
        <Input id="resume-entry-award" name="award" defaultValue={contentValue(entry, "award")} placeholder="例如：二等奖、优秀认证" />
      </div> : null}

      {type === "project" || type === "experience" || type === "education" ? <div className="space-y-2">
        <Label htmlFor="resume-entry-tags">标签</Label>
        <Input id="resume-entry-tags" name="tags" defaultValue={entry?.tags.join("，") ?? ""} placeholder="用逗号分隔；AI 导入时可自动总结" />
        <FieldError errors={state.errors?.tags} />
      </div> : null}

      <FieldError errors={state.errors?.content} />
      {state.message ? <p className="text-sm text-destructive">{state.message}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>取消</Button>
        <Button disabled={pending}>{pending ? "保存中…" : entry ? "保存修改" : "添加条目"}</Button>
      </div>
    </form>
  );
}

function TechStackField({ entry }: { entry?: ResumeEntryView }) {
  return <div className="space-y-2">
    <Label htmlFor="resume-entry-tech-stack">技术栈</Label>
    <Input id="resume-entry-tech-stack" name="techStack" defaultValue={listValue(entry, "techStack")} placeholder="例如：Java，Spring Boot，MySQL" />
  </div>;
}

function ContentField({ entry, label }: { entry?: ResumeEntryView; label: string }) {
  return <div className="space-y-2">
    <Label htmlFor="resume-entry-content">{label}</Label>
    <Textarea id="resume-entry-content" name="content" defaultValue={contentValue(entry, "content")} maxLength={4_000} rows={4} placeholder="只记录已有事实；不确定的信息可以留空。" />
  </div>;
}
