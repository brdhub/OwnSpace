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
      className="absolute top-1/2 z-10 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ left: `${position * 100}%` }}
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onSelect(event);
      }}
      aria-label={`编辑 ${event.title}`}
    >
      <span className={cn("block h-7 w-7 rounded-full border-2 shadow-sm ring-4 ring-card", meta.dotClassName)} />
      <span
        className={cn("absolute left-1/2 block w-44 -translate-x-1/2 rounded-md border p-2 text-left shadow-sm transition hover:shadow", meta.cardClassName)}
        style={{ top: cardOffset }}
      >
        <span className="block truncate text-sm font-medium text-foreground">{event.title}</span>
        <span className="mt-1 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
          <span>{event.eventDate}</span>
          <span>{planningStatusMeta[event.status].label}</span>
          <span>{planningSourceMeta[event.source].label}</span>
        </span>
      </span>
    </button>
  );
}
