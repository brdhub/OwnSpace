"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { studyCheckins } from "@/db/schema";
import { studyCheckinDeleteSchema, studyCheckinSchema, studyQuickToggleSchema } from "@/features/study/schema";

export type StudyActionState = {
  success: boolean;
  errors?: Record<string, string[]>;
  message?: string;
};

export type StudyToggleResult = {
  success: boolean;
  message?: string;
};

function formDataToRecord(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function now() {
  return new Date().toISOString();
}

function revalidateStudyViews() {
  revalidatePath("/");
  revalidatePath("/study");
}

export async function saveStudyCheckinAction(
  _previousState: StudyActionState = { success: false },
  formData: FormData,
): Promise<StudyActionState> {
  void _previousState;
  const parsed = studyCheckinSchema.safeParse(formDataToRecord(formData));

  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  const existing = await db
    .select({ id: studyCheckins.id })
    .from(studyCheckins)
    .where(and(eq(studyCheckins.checkinDate, parsed.data.checkinDate), eq(studyCheckins.category, parsed.data.category)))
    .limit(1);

  const values = {
    isCompleted: parsed.data.isCompleted,
    durationMinutes: parsed.data.durationMinutes ?? null,
    quantity: parsed.data.quantity ?? null,
    title: parsed.data.title ?? "",
    notes: parsed.data.notes ?? "",
    sourceUrl: parsed.data.sourceUrl ?? null,
    updatedAt: now(),
  };

  if (existing.length) {
    await db
      .update(studyCheckins)
      .set(values)
      .where(and(eq(studyCheckins.checkinDate, parsed.data.checkinDate), eq(studyCheckins.category, parsed.data.category)));
  } else {
    await db.insert(studyCheckins).values({
      checkinDate: parsed.data.checkinDate,
      category: parsed.data.category,
      ...values,
      createdAt: now(),
    });
  }

  revalidateStudyViews();
  return { success: true, message: "已保存" };
}

export async function toggleStudyCheckinAction(formData: FormData): Promise<StudyToggleResult> {
  const parsed = studyQuickToggleSchema.safeParse(formDataToRecord(formData));
  if (!parsed.success) {
    return { success: false, message: "学习状态更新失败，请重试。" };
  }

  const existing = await db
    .select({ id: studyCheckins.id })
    .from(studyCheckins)
    .where(and(eq(studyCheckins.checkinDate, parsed.data.checkinDate), eq(studyCheckins.category, parsed.data.category)))
    .limit(1);

  if (existing.length) {
    await db
      .update(studyCheckins)
      .set({ isCompleted: parsed.data.isCompleted, updatedAt: now() })
      .where(and(eq(studyCheckins.checkinDate, parsed.data.checkinDate), eq(studyCheckins.category, parsed.data.category)));
  } else if (parsed.data.isCompleted) {
    await db.insert(studyCheckins).values({
      checkinDate: parsed.data.checkinDate,
      category: parsed.data.category,
      isCompleted: true,
      durationMinutes: null,
      quantity: null,
      title: "",
      notes: "",
      sourceUrl: null,
      createdAt: now(),
      updatedAt: now(),
    });
  }

  revalidateStudyViews();
  return { success: true };
}

export async function deleteStudyCheckinAction(formData: FormData) {
  const parsed = studyCheckinDeleteSchema.safeParse(formDataToRecord(formData));
  if (!parsed.success) {
    return;
  }

  await db
    .delete(studyCheckins)
    .where(and(eq(studyCheckins.checkinDate, parsed.data.checkinDate), eq(studyCheckins.category, parsed.data.category)));

  revalidateStudyViews();
}
