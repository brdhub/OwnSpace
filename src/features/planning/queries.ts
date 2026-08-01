import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { planningEvents } from "@/db/schema";
import { planningEndDate, planningStartDate } from "@/features/planning/constants";

export async function getPlanningEvents() {
  return db
    .select()
    .from(planningEvents)
    .where(sql`${planningEvents.eventDate} >= ${planningStartDate} and ${planningEvents.eventDate} <= ${planningEndDate}`)
    .orderBy(asc(planningEvents.eventDate), asc(planningEvents.sortOrder), asc(planningEvents.id));
}

export async function getPlanningEventById(id: number) {
  const [event] = await db.select().from(planningEvents).where(eq(planningEvents.id, id)).limit(1);
  return event ?? null;
}

export async function getDashboardPlanningSummary(today: string) {
  const [nextTask] = await db
    .select()
    .from(planningEvents)
    .where(sql`${planningEvents.eventType} = 'task' and ${planningEvents.status} != 'archived' and ${planningEvents.eventDate} >= ${today}`)
    .orderBy(asc(planningEvents.eventDate), asc(planningEvents.sortOrder), asc(planningEvents.id))
    .limit(1);

  const [latestProgress] = await db
    .select()
    .from(planningEvents)
    .where(eq(planningEvents.eventType, "progress"))
    .orderBy(desc(planningEvents.eventDate), desc(planningEvents.id))
    .limit(1);

  const [{ count: userEventCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(planningEvents)
    .where(eq(planningEvents.source, "user"));

  return {
    nextTask: nextTask ?? null,
    latestProgress: latestProgress ?? null,
    hasUserEvents: Number(userEventCount) > 0,
  };
}

export async function getPlanningRangeEvents(startDate = planningStartDate, endDate = planningEndDate) {
  return db
    .select()
    .from(planningEvents)
    .where(sql`${planningEvents.eventDate} >= ${startDate} and ${planningEvents.eventDate} <= ${endDate}`)
    .orderBy(asc(planningEvents.eventDate), asc(planningEvents.sortOrder), asc(planningEvents.id));
}

