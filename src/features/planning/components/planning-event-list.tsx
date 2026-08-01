"use client";

import { Edit3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PlanningEvent } from "@/db/schema";
import { deletePlanningEventAction } from "@/features/planning/actions";
import { planningEventTypeMeta, planningSourceMeta, planningStatusMeta } from "@/features/planning/constants";
import { cn } from "@/lib/utils";

type PlanningEventListProps = {
  events: PlanningEvent[];
  onSelect: (event: PlanningEvent) => void;
  onEdit: (event: PlanningEvent) => void;
};

export function PlanningEventList({ events, onSelect, onEdit }: PlanningEventListProps) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-base font-semibold">近期节点</h2>
      <div className="mt-4 space-y-3">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">当前筛选下还没有节点。</p>
        ) : events.slice(0, 8).map((event) => {
          const meta = planningEventTypeMeta[event.eventType];
          return (
            <div key={event.id} className="rounded-md border border-border bg-background p-3">
              <button type="button" className="block w-full text-left" onClick={() => onSelect(event)}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("rounded-md border px-2 py-1 text-xs", meta.badgeClassName)}>{meta.label}</span>
                  <span className="text-xs text-muted-foreground">{event.eventDate}</span>
                  <span className="text-xs text-muted-foreground">{planningStatusMeta[event.status].label}</span>
                </div>
                <div className="mt-2 font-medium text-foreground">{event.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{planningSourceMeta[event.source].label}</div>
              </button>
              <div className="mt-3 flex justify-end gap-2">
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
          );
        })}
      </div>
    </section>
  );
}
