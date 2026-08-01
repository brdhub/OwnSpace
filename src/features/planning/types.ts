import type { PlanningEvent } from "@/db/schema";
import type { planningDensityMeta, planningEventSources, planningEventStatuses, planningEventTypes } from "@/features/planning/constants";

export type PlanningEventType = (typeof planningEventTypes)[number];
export type PlanningEventStatus = (typeof planningEventStatuses)[number];
export type PlanningEventSource = (typeof planningEventSources)[number];
export type PlanningDensity = keyof typeof planningDensityMeta;
export type PlanningFilter = "all" | PlanningEventType;
export type PlanningEventRow = PlanningEvent;
