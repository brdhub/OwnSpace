"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { planningEvents } from "@/db/schema";
import { planningEventFormSchema, planningEventIdSchema, updatePlanningEventSchema } from "@/features/planning/schema";

export type PlanningActionState = {
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
};

const emptyState: PlanningActionState = { success: false };

function formDataToRecord(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function now() {
  return new Date().toISOString();
}

async function getNextSortOrder(eventDate: string) {
  const rows = await db.select({ sortOrder: planningEvents.sortOrder }).from(planningEvents).where(eq(planningEvents.eventDate, eventDate));
  return rows.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1;
}

export async function createPlanningEventAction(
  _previousState: PlanningActionState = emptyState,
  formData: FormData,
): Promise<PlanningActionState> {
  void _previousState;
  const parsed = planningEventFormSchema.safeParse(formDataToRecord(formData));

  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  await db.insert(planningEvents).values({
    ...parsed.data,
    source: "user",
    sortOrder: await getNextSortOrder(parsed.data.eventDate),
    createdAt: now(),
    updatedAt: now(),
  });

  revalidatePath("/");
  revalidatePath("/planning");
  return { success: true, message: "规划节点已新增" };
}

export async function updatePlanningEventAction(
  _previousState: PlanningActionState = emptyState,
  formData: FormData,
): Promise<PlanningActionState> {
  void _previousState;
  const parsed = updatePlanningEventSchema.safeParse(formDataToRecord(formData));

  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  const { id, ...values } = parsed.data;
  await db
    .update(planningEvents)
    .set({ ...values, description: values.description ?? "", updatedAt: now() })
    .where(eq(planningEvents.id, id));

  revalidatePath("/");
  revalidatePath("/planning");
  return { success: true, message: "规划节点已更新" };
}

export async function deletePlanningEventAction(formData: FormData) {
  const parsed = planningEventIdSchema.safeParse(formDataToRecord(formData));
  if (!parsed.success) {
    return;
  }

  await db.delete(planningEvents).where(eq(planningEvents.id, parsed.data.id));
  revalidatePath("/");
  revalidatePath("/planning");
}
