"use client";

import type { PlanningEvent } from "@/db/schema";
import { PlanningEventForm } from "@/features/planning/components/planning-event-form";
import type { PlanningEventType } from "@/features/planning/types";

type PlanningEventDialogProps = {
  event?: PlanningEvent;
  defaultDate: string;
  defaultType: PlanningEventType;
  onClose: () => void;
};

export function PlanningEventDialog({ event, defaultDate, defaultType, onClose }: PlanningEventDialogProps) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/20 px-4 py-8">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-5 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">{event ? "编辑规划节点" : "新增规划节点"}</h2>
        <PlanningEventForm event={event} defaultDate={defaultDate} defaultType={defaultType} onDone={onClose} />
      </div>
    </div>
  );
}
