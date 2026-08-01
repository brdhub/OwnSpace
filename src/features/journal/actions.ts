"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { journalEntries } from "@/db/schema";
import { journalEntryDeleteSchema, journalEntryFormSchema } from "@/features/journal/schema";

export type JournalActionState = {
  success: boolean;
  errors?: Record<string, string[]>;
  message?: string;
};

function formDataToRecord(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function now() {
  return new Date().toISOString();
}

export async function saveJournalEntryAction(
  _previousState: JournalActionState = { success: false },
  formData: FormData,
): Promise<JournalActionState> {
  void _previousState;
  const parsed = journalEntryFormSchema.safeParse(formDataToRecord(formData));

  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  const existing = await db
    .select({ id: journalEntries.id })
    .from(journalEntries)
    .where(eq(journalEntries.entryDate, parsed.data.entryDate))
    .limit(1);

  const values = {
    content: parsed.data.content,
    mood: parsed.data.mood ?? null,
    energyLevel: parsed.data.energyLevel ?? null,
    completedToday: parsed.data.completedToday ?? "",
    tomorrowMinimumAction: parsed.data.tomorrowMinimumAction ?? "",
    updatedAt: now(),
  };

  if (existing.length) {
    await db.update(journalEntries).set(values).where(eq(journalEntries.entryDate, parsed.data.entryDate));
  } else {
    await db.insert(journalEntries).values({
      entryDate: parsed.data.entryDate,
      ...values,
      createdAt: now(),
    });
  }

  revalidatePath("/");
  revalidatePath("/journal");
  revalidatePath("/internships");
  return { success: true, message: "已保存" };
}

export async function deleteJournalEntryAction(formData: FormData) {
  const parsed = journalEntryDeleteSchema.safeParse(formDataToRecord(formData));
  if (!parsed.success) {
    return;
  }

  await db.delete(journalEntries).where(eq(journalEntries.entryDate, parsed.data.entryDate));
  revalidatePath("/");
  revalidatePath("/journal");
  revalidatePath("/internships");
}
