"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { applications, interviewNotes, interviewNoteTags, interviewQuestions, interviewTags } from "@/db/schema";
import {
  interviewIdSchema,
  interviewNoteInputSchema,
  updateInterviewNoteInputSchema,
  type InterviewNoteInput,
} from "@/features/interviews/schema";

export type InterviewActionState = {
  success: boolean;
  errors?: Record<string, string[]>;
  message?: string;
};

function revalidateInterviewViews() {
  revalidatePath("/");
  revalidatePath("/interviews");
  revalidatePath("/applications");
}

function now() {
  return new Date().toISOString();
}

function parseJsonArray(formData: FormData, field: string) {
  const raw = formData.get(field);
  if (typeof raw !== "string" || !raw.trim()) {
    return [];
  }
  const parsed = JSON.parse(raw) as unknown;
  return Array.isArray(parsed) ? parsed : [];
}

function parseQuestions(formData: FormData) {
  return parseJsonArray(formData, "questions").filter((item) => {
    if (!item || typeof item !== "object" || !("question" in item)) {
      return false;
    }
    return typeof item.question === "string" && item.question.trim().length > 0;
  });
}

function formDataToPayload(formData: FormData) {
  return {
    id: formData.get("id"),
    applicationId: formData.get("applicationId"),
    round: formData.get("round"),
    interviewDate: formData.get("interviewDate"),
    result: formData.get("result"),
    summary: formData.get("summary"),
    reflection: formData.get("reflection"),
    nextAction: formData.get("nextAction"),
    tagIds: parseJsonArray(formData, "tagIds"),
    questions: parseQuestions(formData),
  };
}

async function validateTagIds(input: InterviewNoteInput) {
  const uniqueIds = Array.from(new Set(input.tagIds));
  if (uniqueIds.length === 0) {
    return true;
  }
  const rows = await db.select({ id: interviewTags.id }).from(interviewTags).where(inArray(interviewTags.id, uniqueIds));
  return rows.length === uniqueIds.length;
}

async function getApplicationSnapshot(applicationId: number) {
  const [application] = await db.select().from(applications).where(eq(applications.id, applicationId)).limit(1);
  return application;
}

async function replaceQuestions(interviewNoteId: number, questions: InterviewNoteInput["questions"]) {
  await db.delete(interviewQuestions).where(eq(interviewQuestions.interviewNoteId, interviewNoteId));
  if (questions.length > 0) {
    await db.insert(interviewQuestions).values(
      questions.map((question, index) => ({
        interviewNoteId,
        question: question.question,
        myAnswer: question.myAnswer ?? "",
        betterAnswer: question.betterAnswer ?? "",
        sortOrder: index,
        createdAt: now(),
        updatedAt: now(),
      })),
    );
  }
}

async function replaceTags(interviewNoteId: number, tagIds: number[]) {
  await db.delete(interviewNoteTags).where(eq(interviewNoteTags.interviewNoteId, interviewNoteId));
  const uniqueTagIds = Array.from(new Set(tagIds));
  if (uniqueTagIds.length > 0) {
    await db.insert(interviewNoteTags).values(
      uniqueTagIds.map((interviewTagId) => ({ interviewNoteId, interviewTagId })),
    );
  }
}

export async function createInterviewAction(_previousState: InterviewActionState, formData: FormData): Promise<InterviewActionState> {
  let payload;
  try {
    payload = formDataToPayload(formData);
  } catch {
    return { success: false, message: "问题或标签数据格式不正确" };
  }
  const parsed = interviewNoteInputSchema.safeParse(payload);
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors };
  const application = await getApplicationSnapshot(parsed.data.applicationId);
  if (!application) return { success: false, errors: { applicationId: ["请选择有效的投递记录"] } };
  if (!(await validateTagIds(parsed.data))) return { success: false, message: "存在无效或重复的技术标签" };

  const [inserted] = await db.insert(interviewNotes).values({
    applicationId: application.id,
    companySnapshot: application.company,
    roleSnapshot: application.role,
    round: parsed.data.round,
    interviewDate: parsed.data.interviewDate,
    result: parsed.data.result,
    summary: parsed.data.summary ?? "",
    reflection: parsed.data.reflection ?? "",
    nextAction: parsed.data.nextAction ?? "",
    createdAt: now(),
    updatedAt: now(),
  }).returning({ id: interviewNotes.id });

  await replaceQuestions(inserted.id, parsed.data.questions);
  await replaceTags(inserted.id, parsed.data.tagIds);
  revalidateInterviewViews();
  return { success: true };
}

export async function updateInterviewAction(_previousState: InterviewActionState, formData: FormData): Promise<InterviewActionState> {
  let payload;
  try {
    payload = formDataToPayload(formData);
  } catch {
    return { success: false, message: "问题或标签数据格式不正确" };
  }
  const parsed = updateInterviewNoteInputSchema.safeParse(payload);
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors };
  const application = await getApplicationSnapshot(parsed.data.applicationId);
  if (!application) return { success: false, errors: { applicationId: ["请选择有效的投递记录"] } };
  if (!(await validateTagIds(parsed.data))) return { success: false, message: "存在无效或重复的技术标签" };

  await db.update(interviewNotes).set({
    applicationId: application.id,
    companySnapshot: application.company,
    roleSnapshot: application.role,
    round: parsed.data.round,
    interviewDate: parsed.data.interviewDate,
    result: parsed.data.result,
    summary: parsed.data.summary ?? "",
    reflection: parsed.data.reflection ?? "",
    nextAction: parsed.data.nextAction ?? "",
    updatedAt: now(),
  }).where(eq(interviewNotes.id, parsed.data.id));

  await replaceQuestions(parsed.data.id, parsed.data.questions);
  await replaceTags(parsed.data.id, parsed.data.tagIds);
  revalidateInterviewViews();
  return { success: true };
}

export async function deleteInterviewAction(formData: FormData) {
  const parsed = interviewIdSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return;
  await db.delete(interviewNotes).where(eq(interviewNotes.id, parsed.data.id));
  revalidateInterviewViews();
}