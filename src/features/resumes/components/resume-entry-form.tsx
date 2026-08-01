"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createResumeEntryAction, type ResumeActionState, updateResumeEntryAction } from "@/features/resumes/actions";
import { resumeEntryTypes, type ResumeEntryType } from "@/features/resumes/constants";
import type { ResumeEntryView } from "@/features/resumes/queries";

const typeLabels: Record<ResumeEntryType, string> = {
  profile: "个人信息",
  education: "教育经历",
  experience: "工作经历",
  project: "项目经历",
  skill: "技能",
};

const initialState: ResumeActionState = { success: false };

function firstContentValue(content: Record<string, string>) {
  return content.description ?? Object.values(content).join("\n");
}

export function ResumeEntryForm({ entry, onDone }: { entry?: ResumeEntryView; onDone: () => void }) {
  const action = entry ? updateResumeEntryAction : createResumeEntryAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) onDone();
  }, [onDone, state.success]);

  return (
    <form action={formAction} className="space-y-4">
      {entry ? <input type="hidden" name="id" value={entry.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="resume-entry-type">类型</Label>
          <Select id="resume-entry-type" name="type" defaultValue={entry?.type ?? "project"}>
            {resumeEntryTypes.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}
          </Select>
          {state.errors?.type?.[0] ? <p className="text-sm text-destructive">{state.errors.type[0]}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="resume-entry-completeness">完成度</Label>
          <Select id="resume-entry-completeness" name="completeness" defaultValue={entry?.completeness ?? "incomplete"}>
            <option value="incomplete">待补充</option>
            <option value="complete">已整理</option>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="resume-entry-title">标题</Label>
        <Input id="resume-entry-title" name="title" defaultValue={entry?.title ?? ""} maxLength={120} required />
        {state.errors?.title?.[0] ? <p className="text-sm text-destructive">{state.errors.title[0]}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="resume-entry-content">内容</Label>
        <Textarea id="resume-entry-content" name="content" defaultValue={entry ? firstContentValue(entry.content) : ""} maxLength={4_000} placeholder="只记录已有的职责、过程或结果；不确定的信息可以先留空。" />
        {state.errors?.content?.[0] ? <p className="text-sm text-destructive">{state.errors.content[0]}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="resume-entry-tags">标签</Label>
        <Input id="resume-entry-tags" name="tags" defaultValue={entry?.tags.join("，") ?? ""} placeholder="例如：后端，评测（用逗号分隔）" />
        {state.errors?.tags?.[0] ? <p className="text-sm text-destructive">{state.errors.tags[0]}</p> : null}
      </div>
      {state.message ? <p className="text-sm text-destructive">{state.message}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>取消</Button>
        <Button disabled={pending}>{pending ? "保存中…" : entry ? "保存修改" : "添加条目"}</Button>
      </div>
    </form>
  );
}
