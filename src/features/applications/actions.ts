"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { applications, interviewNotes } from "@/db/schema";
import {
  applicationFormSchema,
  applicationIdSchema,
  updateApplicationSchema,
  updateApplicationStatusSchema,
} from "@/features/applications/schemas";

export type ApplicationActionState = {
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
};

export type UpdateApplicationStatusResult = {
  success: boolean;
  message?: string;
};

const emptyState: ApplicationActionState = { success: false };

function formDataToRecord(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function now() {
  return new Date().toISOString();
}

export async function createApplicationAction(
  _previousState: ApplicationActionState = emptyState,
  formData: FormData,
): Promise<ApplicationActionState> {
  void _previousState;
  const parsed = applicationFormSchema.safeParse(formDataToRecord(formData));

  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  await db.insert(applications).values({
    ...parsed.data,
    interviewTime: parsed.data.interviewTime ?? null,
    applicationUrl: parsed.data.applicationUrl ?? null,
    jobDescription: parsed.data.jobDescription ?? "",
    notes: parsed.data.notes ?? "",
    createdAt: now(),
    updatedAt: now(),
  });

  revalidatePath("/");
  revalidatePath("/applications");
  revalidatePath("/applications/opportunities");
  return { success: true, message: "投递记录已新增" };
}

export async function updateApplicationAction(
  _previousState: ApplicationActionState = emptyState,
  formData: FormData,
): Promise<ApplicationActionState> {
  void _previousState;
  const parsed = updateApplicationSchema.safeParse(formDataToRecord(formData));

  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  const { id, ...values } = parsed.data;
  await db
    .update(applications)
    .set({
      ...values,
      interviewTime: values.interviewTime ?? null,
      applicationUrl: values.applicationUrl ?? null,
      jobDescription: values.jobDescription ?? "",
      notes: values.notes ?? "",
      updatedAt: now(),
    })
    .where(eq(applications.id, id));

  revalidatePath("/");
  revalidatePath("/applications");
  revalidatePath("/applications/opportunities");
  return { success: true, message: "投递记录已更新" };
}

export async function deleteApplicationAction(formData: FormData) {
  const parsed = applicationIdSchema.safeParse(formDataToRecord(formData));
  if (!parsed.success) {
    return;
  }

  await db.update(interviewNotes).set({ applicationId: null, updatedAt: now() }).where(eq(interviewNotes.applicationId, parsed.data.id));
  await db.delete(applications).where(eq(applications.id, parsed.data.id));
  revalidatePath("/");
  revalidatePath("/applications");
  revalidatePath("/interviews");
}

export async function updateApplicationStatusAction(formData: FormData): Promise<UpdateApplicationStatusResult> {
  const parsed = updateApplicationStatusSchema.safeParse(formDataToRecord(formData));
  if (!parsed.success) {
    return { success: false, message: "状态更新失败，请重试。" };
  }

  await db
    .update(applications)
    .set({ status: parsed.data.status, updatedAt: now() })
    .where(eq(applications.id, parsed.data.id));

  revalidatePath("/");
  revalidatePath("/applications");
  return { success: true };
}
