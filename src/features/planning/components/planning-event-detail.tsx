"use client";

import { Edit3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PlanningEvent } from "@/db/schema";
import { deletePlanningEventAction } from "@/features/planning/actions";
import { planningEventTypeMeta, planningSourceMeta, planningStatusMeta } from "@/features/planning/constants";
import { cn } from "@/lib/utils";

type PlanningEventDetailProps = {
  event: PlanningEvent | null;
  onEdit: (event: PlanningEvent) => void;
};

export function PlanningEventDetail({ event, onEdit }: PlanningEventDetailProps) {
  if (!event) {
    return (
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold">节点详情</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">先在时间线上放下一个小节点，之后可以慢慢调整。规划不是用来制造压力，而是帮你知道下一步在哪。</p>
      </section>
    );
  }

  const meta = planningEventTypeMeta[event.eventType];

  return (
    <section className={cn("rounded-lg border p-5", meta.cardClassName)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{event.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{event.eventDate}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="icon" onClick={() => onEdit(event)} aria-label="编辑规划节点"><Edit3 className="h-4 w-4" /></Button>
          <form action={deletePlanningEventAction} onSubmit={(submitEvent) => {
            const message = event.source === "system" ? "这是系统预置规划节点，删除后不会影响其他数据。确定删除吗？" : "确定删除这个规划节点吗？";
            if (!window.confirm(message)) {
              submitEvent.preventDefault();
            }
          }}>
            <input type="hidden" name="id" value={event.id} />
            <Button type="submit" variant="ghost" size="icon" aria-label="删除规划节点"><Trash2 className="h-4 w-4" /></Button>
          </form>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className={cn("rounded-md border px-2 py-1", meta.badgeClassName)}>{meta.label}</span>
        <span className="rounded-md border border-border bg-background px-2 py-1 text-muted-foreground">{planningStatusMeta[event.status].label}</span>
        <span className="rounded-md border border-border bg-background px-2 py-1 text-muted-foreground">{planningSourceMeta[event.source].label}</span>
      </div>
      {event.description ? <p className="mt-4 text-sm leading-6 text-muted-foreground">{event.description}</p> : <p className="mt-4 text-sm text-muted-foreground">还没有补充说明。</p>}
    </section>
  );
}
