import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PlanningEvent } from "@/db/schema";
import { planningEventTypeMeta, planningSourceMeta } from "@/features/planning/constants";
import { cn } from "@/lib/utils";

type PlanningSummaryCardProps = {
  nextTask: PlanningEvent | null;
  latestProgress: PlanningEvent | null;
  hasUserEvents: boolean;
};

function SummaryRow({ label, event }: { label: string; event: PlanningEvent | null }) {
  if (!event) {
    return <p className="text-sm text-muted-foreground">{label}：还没有记录。</p>;
  }

  const meta = planningEventTypeMeta[event.eventType];
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Badge variant="outline" className={cn("border", meta.badgeClassName)}>{meta.label}</Badge>
        <span className="text-xs text-muted-foreground">{event.eventDate}</span>
      </div>
      <p className="mt-2 text-sm font-medium text-foreground">{event.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{planningSourceMeta[event.source].label}</p>
    </div>
  );
}

export function PlanningSummaryCard({ nextTask, latestProgress, hasUserEvents }: PlanningSummaryCardProps) {
  return (
    <details className="group rounded-lg border border-border bg-card p-5">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <div>
          <h2 className="text-base font-semibold">长期规划</h2>
          <p className="mt-1 text-sm text-muted-foreground">把接下来一年的节点放在同一条线上。</p>
        </div>
        <ChevronDown
          className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="mt-4 border-t border-border pt-4">
        <div className="space-y-3">
          <SummaryRow label="下一项任务" event={nextTask} />
          <SummaryRow label="最近进度" event={latestProgress} />
        </div>
        {!hasUserEvents ? <p className="mt-3 text-sm text-muted-foreground">目前先显示系统预置的常见节奏，你可以慢慢添自己的节点。</p> : null}
        <div className="mt-4 flex justify-end">
          <Button asChild variant="ghost" size="sm">
            <Link href="/planning">进入长期规划<ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </div>
    </details>
  );
}
