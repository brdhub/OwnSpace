"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { internshipEntries, internshipRecords } from "@/db/schema";
import {
  internshipDepartureSchema,
  internshipEntrySchema,
  internshipRecordSchema,
} from "@/features/internships/schema";
import { toDateInputValue } from "@/lib/date";

export type InternshipActionState = {
  success: boolean;
  errors?: Record<string, string[]>;
  message?: string;
  recordId?: number;
};

function formDataToRecord(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function now() {
  return new Date().toISOString();
}

export async function createInternshipRecordAction(
  _previousState: InternshipActionState = { success: false },
  formData: FormData,
): Promise<InternshipActionState> {
  void _previousState;
  const parsed = internshipRecordSchema.safeParse(formDataToRecord(formData));

  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  const [record] = await db
    .insert(internshipRecords)
    .values({
      companyName: parsed.data.companyName,
      startDate: parsed.data.startDate,
      createdAt: now(),
      updatedAt: now(),
    })
    .returning({ id: internshipRecords.id });

  revalidatePath("/internships");
  return { success: true, recordId: record.id };
}

export async function createInternshipEntryAction(
  _previousState: InternshipActionState = { success: false },
  formData: FormData,
): Promise<InternshipActionState> {
  void _previousState;
  const parsed = internshipEntrySchema.safeParse(formDataToRecord(formData));

  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  const [record] = await db
    .select({ id: internshipRecords.id })
    .from(internshipRecords)
    .where(eq(internshipRecords.id, parsed.data.internshipRecordId))
    .limit(1);

  if (!record) {
    return { success: false, message: "实习记录不存在，请刷新页面后重试。" };
  }

  await db.insert(internshipEntries).values({
    internshipRecordId: record.id,
    entryDate: parsed.data.entryDate,
    title: parsed.data.title,
    content: parsed.data.content,
    createdAt: now(),
    updatedAt: now(),
  });

  revalidatePath("/internships");
  return { success: true, recordId: record.id };
}

export async function markInternshipDepartureAction(formData: FormData) {
  const parsed = internshipDepartureSchema.safeParse(formDataToRecord(formData));
  if (!parsed.success) {
    return;
  }

  await db
    .update(internshipRecords)
    .set({ endDate: toDateInputValue(), updatedAt: now() })
    .where(eq(internshipRecords.id, parsed.data.id));

  revalidatePath("/internships");
}
