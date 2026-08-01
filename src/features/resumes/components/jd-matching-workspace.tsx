"use client";

import { Sparkles } from "lucide-react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ResumeActionState } from "@/features/resumes/actions";
import { reconcileSelectedEntryIds } from "@/features/resumes/jd-selection";
import {
  runJdRecommendationAction,
  saveJdMaterialSelectionAction,
} from "@/features/resumes/optimization-actions";
import type { JdTaskView, ResumeEntryView } from "@/features/resumes/queries";

const initialState: ResumeActionState = { success: false };
const levelLabels = { high: "高匹配", medium: "中匹配", low: "低匹配" } as const;

export function JdMatchingWorkspace({ entries, tasks }: { entries: ResumeEntryView[]; tasks: JdTaskView[] }) {
  const router = useRouter();
  const [activeTaskId, setActiveTaskId] = useState<number | null>(tasks[0]?.id ?? null);
  const activeTask = tasks.find((task) => task.id === activeTaskId) ?? null;
  const [targetRole, setTargetRole] = useState(activeTask?.targetRole ?? "");
  const [jdText, setJdText] = useState(activeTask?.jdText ?? "");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set(
    activeTask ? reconcileSelectedEntryIds(activeTask.recommendations, activeTask.selectedEntryIds) : [],
  ));
  const [runState, runAction, running] = useActionState(runJdRecommendationAction, initialState);
  const [saveState, saveAction, saving] = useActionState(saveJdMaterialSelectionAction, initialState);

  useEffect(() => {
    if (runState.taskId) {
      setActiveTaskId(runState.taskId);
      router.refresh();
    }
  }, [router, runState]);
  useEffect(() => {
    if (saveState.success) router.refresh();
  }, [router, saveState]);
  useEffect(() => {
    if (!activeTask) return;
    setTargetRole(activeTask.targetRole);
    setJdText(activeTask.jdText);
    setSelectedIds(new Set(reconcileSelectedEntryIds(activeTask.recommendations, activeTask.selectedEntryIds)));
  }, [activeTask]);

  const recommendationByEntryId = useMemo(
    () => new Map(activeTask?.recommendations.map((recommendation) => [recommendation.entryId, recommendation]) ?? []),
    [activeTask],
  );
  const orderedEntries = useMemo(() => [...entries].sort((left, right) => {
    const order = { high: 0, medium: 1, low: 2 } as const;
    const leftLevel = recommendationByEntryId.get(left.id)?.level;
    const rightLevel = recommendationByEntryId.get(right.id)?.level;
    return (leftLevel ? order[leftLevel] : 3) - (rightLevel ? order[rightLevel] : 3);
  }), [entries, recommendationByEntryId]);

  const selectTask = (taskId: number | null) => {
    setActiveTaskId(taskId);
    if (taskId === null) {
      setTargetRole("");
      setJdText("");
      setSelectedIds(new Set());
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <section className="rounded-lg border border-border bg-card p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-foreground">JD 匹配</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">粘贴岗位描述，由 AI 从正式条目仓库中筛选素材。</p>
          </div>
          {tasks.length ? <Button type="button" size="sm" variant="outline" onClick={() => selectTask(null)}>新建匹配</Button> : null}
        </div>
        {tasks.length ? (
          <label className="mb-4 block text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">历史任务</span>
            <Select value={activeTaskId ?? "new"} onChange={(event) => selectTask(event.target.value === "new" ? null : Number(event.target.value))}>
              <option value="new">新建匹配</option>
              {tasks.map((task) => <option key={task.id} value={task.id}>{task.targetRole} · {task.status}</option>)}
            </Select>
          </label>
        ) : null}
        <form action={runAction} className="space-y-4">
          {activeTask?.status === "failed" ? <input type="hidden" name="taskId" value={activeTask.id} /> : null}
          <label className="block text-sm">
            <span className="mb-1 block">目标岗位</span>
            <Input name="targetRole" value={targetRole} onChange={(event) => setTargetRole(event.target.value)} placeholder="例如：产品经理" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block">JD 文本</span>
            <Textarea name="jdText" value={jdText} onChange={(event) => setJdText(event.target.value)} rows={12} placeholder="粘贴完整岗位描述" />
          </label>
          <p className="rounded-md bg-muted/60 p-3 text-xs leading-5 text-muted-foreground">点击后会把已确认的 JD 和当前正式结构化条目发送给 DeepSeek；不会发送 PDF 原文或待确认候选。</p>
          <Button type="submit" disabled={running || !entries.length}>
            <Sparkles className="h-4 w-4" />{running ? "正在匹配…" : activeTask?.status === "failed" ? "重试 AI 推荐" : "AI 推荐条目"}
          </Button>
          {runState.message ? <p className={`text-sm ${runState.success ? "text-muted-foreground" : "text-destructive"}`}>{runState.message}</p> : null}
        </form>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-foreground">推荐与选材</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">高匹配条目默认选中，也可以手动增删其他正式条目。</p>
          </div>
          <Button type="button" size="sm" disabled title="后续开放">优化条目描述 · 后续开放</Button>
        </div>
        {activeTask?.status === "failed" ? <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{activeTask.error || "匹配失败，请保留当前输入并重试。"}</p> : null}
        {activeTask?.status === "processing" ? <p className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">AI 正在分析 JD 与正式条目…</p> : null}
        {activeTask?.status === "completed" ? (
          <form action={saveAction} className="space-y-3">
            <input type="hidden" name="taskId" value={activeTask.id} />
            <input type="hidden" name="selectedEntryIdsJson" value={JSON.stringify([...selectedIds])} />
            {orderedEntries.map((entry) => {
              const recommendation = recommendationByEntryId.get(entry.id);
              return (
                <label key={entry.id} className="flex cursor-pointer gap-3 rounded-md border border-border bg-background p-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={selectedIds.has(entry.id)}
                    onChange={(event) => setSelectedIds((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(entry.id); else next.delete(entry.id);
                      return next;
                    })}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{entry.title}</span>
                      {recommendation ? <Badge variant="secondary">{levelLabels[recommendation.level]}</Badge> : <Badge variant="outline">手动可选</Badge>}
                    </span>
                    {recommendation ? <span className="mt-1 block text-xs leading-5 text-muted-foreground">{recommendation.reason}</span> : null}
                  </span>
                </label>
              );
            })}
            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={saving}>{saving ? "正在保存…" : `保存 ${selectedIds.size} 条素材`}</Button>
              {saveState.message ? <span className={`text-sm ${saveState.success ? "text-muted-foreground" : "text-destructive"}`}>{saveState.message}</span> : null}
            </div>
          </form>
        ) : activeTask?.status !== "processing" ? (
          <p className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">提交 JD 后，这里会显示 AI 匹配等级、理由和所有可手动选择的正式条目。</p>
        ) : null}
      </section>
    </div>
  );
}
