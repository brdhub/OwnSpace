"use client";

import { useActionState, useOptimistic, useState } from "react";
import { useFormStatus } from "react-dom";
import { BookOpen, Check, ChevronDown, ExternalLink, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { StudyCheckin } from "@/db/schema";
import { deleteStudyCheckinAction, saveStudyCheckinAction, toggleStudyCheckinAction, type StudyActionState } from "@/features/study/actions";
import { studyCategoryMeta, type StudyCategory } from "@/features/study/constants";
import { cn } from "@/lib/utils";

type StudyCheckinCardProps = {
  date: string;
  category: StudyCategory;
  entry?: StudyCheckin;
};

function fieldError(state: StudyActionState, name: string) {
  return state.errors?.[name]?.[0];
}

function StudyToggle({ checked }: { checked: boolean }) {
  const { pending } = useFormStatus();

  return (
    <label className={cn("group relative block h-9 w-9", pending ? "cursor-wait opacity-70" : "cursor-pointer")}>
      <input
        name="isCompleted"
        type="checkbox"
        checked={checked}
        disabled={pending}
        aria-busy={pending}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="peer sr-only"
      />
      <span className="absolute inset-0 rounded-full border border-border bg-background transition-all duration-300 peer-checked:scale-110 peer-checked:border-emerald-500 peer-checked:bg-emerald-500 peer-checked:shadow-[0_0_0_6px_rgba(16,185,129,0.12)]" />
      <Check className="absolute left-2 top-2 h-5 w-5 scale-50 text-white opacity-0 transition-all duration-300 peer-checked:scale-100 peer-checked:opacity-100" />
      {pending ? <span className="sr-only">保存中</span> : null}
    </label>
  );
}

export function StudyCheckinCard({ date, category, entry }: StudyCheckinCardProps) {
  const meta = studyCategoryMeta[category];
  const [state, formAction, pending] = useActionState(saveStudyCheckinAction, { success: false });
  const [expanded, setExpanded] = useState(Boolean(entry?.title || entry?.notes || entry?.durationMinutes || entry?.quantity || entry?.sourceUrl));
  const [toggleError, setToggleError] = useState("");
  const [checked, updateOptimisticChecked] = useOptimistic(
    entry?.isCompleted ?? false,
    (_currentChecked, nextChecked: boolean) => nextChecked,
  );

  async function handleToggle(formData: FormData) {
    const nextChecked = formData.get("isCompleted") === "on";
    setToggleError("");
    updateOptimisticChecked(nextChecked);

    try {
      const result = await toggleStudyCheckinAction(formData);
      if (!result.success) {
        setToggleError(result.message ?? "学习状态更新失败，请重试。");
      }
    } catch {
      setToggleError("学习状态更新失败，请重试。");
    }
  }

  return (
    <Card className={cn("h-full overflow-hidden transition-all duration-300", checked ? "border-emerald-200 bg-emerald-50/40 shadow-sm" : "bg-card") }>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <form action={handleToggle} className="pt-0.5">
            <input type="hidden" name="checkinDate" value={date} />
            <input type="hidden" name="category" value={category} />
            <StudyToggle checked={checked} />
          </form>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>{meta.name}</CardTitle>
                <CardDescription className="mt-1">{meta.description}</CardDescription>
              </div>
              <span className={cn("shrink-0 rounded-md px-2 py-1 text-xs font-medium", checked ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground") }>
                {checked ? "已勾选" : "未勾选"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              {expanded ? "收起细节" : "展开补充"}
              <ChevronDown className={cn("h-4 w-4 transition-transform", expanded ? "rotate-180" : "rotate-0")} />
            </button>
            {toggleError ? <p className="mt-2 text-xs text-destructive" role="alert">{toggleError}</p> : null}
          </div>
        </div>
      </CardHeader>

      {expanded ? (
        <CardContent className="space-y-4 border-t border-border bg-background/70 pt-4">
          {meta.resource ? (
            <Button asChild variant="outline" size="sm" className="w-fit">
              <a href={meta.resource.url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                {meta.resource.name}
              </a>
            </Button>
          ) : null}

          {meta.prompts ? (
            <div className="flex flex-wrap gap-2">
              {meta.prompts.map((prompt) => (
                <span key={prompt} className="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
                  {prompt}
                </span>
              ))}
            </div>
          ) : null}

          <form action={formAction} className="space-y-4">
            <input type="hidden" name="checkinDate" value={date} />
            <input type="hidden" name="category" value={category} />

            <label className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
              <input key={checked ? "completed" : "incomplete"} name="isCompleted" type="checkbox" defaultChecked={checked} className="h-4 w-4" />
              今天这个方向有一点进展
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`${category}-duration`}>投入时间（分钟）</Label>
                <Input id={`${category}-duration`} name="durationMinutes" type="number" min="0" defaultValue={entry?.durationMinutes ?? ""} />
                {fieldError(state, "durationMinutes") ? <p className="text-sm text-destructive">{fieldError(state, "durationMinutes")}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${category}-quantity`}>{meta.quantityLabel}</Label>
                <Input id={`${category}-quantity`} name="quantity" type="number" min="0" defaultValue={entry?.quantity ?? ""} />
                {fieldError(state, "quantity") ? <p className="text-sm text-destructive">{fieldError(state, "quantity")}</p> : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${category}-title`}>今天看的主题</Label>
              <Input id={`${category}-title`} name="title" defaultValue={entry?.title ?? ""} placeholder="例如：复盘二分边界、整理 JVM 内存模型" />
              {fieldError(state, "title") ? <p className="text-sm text-destructive">{fieldError(state, "title")}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${category}-sourceUrl`}>来源链接</Label>
              <Input id={`${category}-sourceUrl`} name="sourceUrl" type="url" defaultValue={entry?.sourceUrl ?? ""} placeholder="https://..." />
              {fieldError(state, "sourceUrl") ? <p className="text-sm text-destructive">{fieldError(state, "sourceUrl")}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${category}-notes`}>简短笔记</Label>
              <Textarea id={`${category}-notes`} name="notes" rows={4} defaultValue={entry?.notes ?? ""} placeholder="写一句也可以，例如今天卡在哪里、想通了什么。" />
              {fieldError(state, "notes") ? <p className="text-sm text-destructive">{fieldError(state, "notes")}</p> : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={pending}>
                <Save className="h-4 w-4" />
                {pending ? "保存中" : "保存细节"}
              </Button>
              {state.success ? <span className="text-sm text-emerald-700">{state.message}</span> : null}
            </div>
          </form>

          {entry ? (
            <form action={deleteStudyCheckinAction}>
              <input type="hidden" name="checkinDate" value={date} />
              <input type="hidden" name="category" value={category} />
              <Button type="submit" variant="ghost" size="sm">
                <RotateCcw className="h-4 w-4" />
                清空这个方向
              </Button>
            </form>
          ) : (
            <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              <BookOpen className="h-4 w-4" />
              细节可以稍后再补，先勾上也算开始。
            </div>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}
