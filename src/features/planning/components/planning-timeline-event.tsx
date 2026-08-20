"use client";

import type { PlanningEvent } from "@/db/schema";
import { planningEventTypeMeta, planningSourceMeta, planningStatusMeta } from "@/features/planning/constants";
import { getSameDayLane } from "@/features/planning/utils";
import { cn } from "@/lib/utils";

type PlanningTimelineEventProps = {
  event: PlanningEvent;
  position: number;
  sameDayIndex: number;
  onSelect: (event: PlanningEvent) => void;
};

export function PlanningTimelineEvent({ event, position, sameDayIndex, onSelect }: PlanningTimelineEventProps) {
  const lane = getSameDayLane(sameDayIndex);
  const meta = planningEventTypeMeta[event.eventType];
  const cardOffset = lane % 2 === 0 ? 26 + lane * 12 : -104 - (lane - 1) * 12;

  return (
    <button
      type="button"
      className="group absolute top-1/2 z-10 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      style={{ left: `${position * 100}%` }}
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onSelect(event);
      }}
      aria-label={`编辑 ${event.title}`}
    >
      <span className={cn("absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 ring-1 transition-all duration-200 group-hover:scale-125 group-hover:opacity-30 group-focus-visible:scale-125 group-focus-visible:opacity-30", meta.dotClassName)} />
      <span className={cn("absolute left-1/2 top-1/2 block h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-sm ring-2 ring-card transition-all duration-200 group-hover:scale-150 group-hover:shadow-lg group-hover:ring-4 group-focus-visible:scale-150 group-focus-visible:ring-4", meta.dotClassName)} />
      <span
        className={cn("absolute left-1/2 block w-44 -translate-x-1/2 rounded-lg border p-2.5 text-left shadow-sm backdrop-blur-sm transition-all duration-200 group-hover:-translate-y-1 group-hover:border-primary/40 group-hover:shadow-lg group-focus-visible:-translate-y-1 group-focus-visible:border-primary/40 group-focus-visible:shadow-lg", meta.cardClassName)}
        style={{ top: cardOffset }}
      >
        <span className="block truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">{event.title}</span>
        <span className="mt-1 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
          <span>{event.eventDate}</span>
          <span>{planningStatusMeta[event.status].label}</span>
          <span>{planningSourceMeta[event.source].label}</span>
        </span>
      </span>
    </button>
  );
}
