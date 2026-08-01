"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { resumeAssets, resumeEntries } from "@/db/schema";
import { RESUME_ASSET_DIRECTORY, saveResumePdf } from "@/features/resumes/files";
import { extractPdfText } from "@/features/resumes/pdf";
import { resumeEntrySchema, stringifyResumeEntryContent } from "@/features/resumes/schema";
import { resolve } from "node:path";

export type ResumeActionState = {
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
};

const emptyState: ResumeActionState = { success: false };

function now() {
  return new Date().toISOString();
}

function revalidateResumeWorkspace() {
  revalidatePath("/resumes");
}

function entryPayload(formData: FormData) {
  const content = formData.get("content")?.toString().trim() ?? "";
  const tags = (formData.get("tags")?.toString() ?? "")
    .split(/[，,\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean);

  return {
    type: formData.get("type"),
    title: formData.get("title"),
    content: content ? { description: content } : {},
    tags,
    completeness: formData.get("completeness"),
  };
}

export async function createResumeAssetAction(
  _previousState: ResumeActionState = emptyState,
  formData: FormData,
): Promise<ResumeActionState> {
  void _previousState;
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, errors: { file: ["请选择一份 PDF 简历。"] } };
  }

  try {
    const saved = await saveResumePdf(file);
    const extracted = await extractPdfText(resolve(RESUME_ASSET_DIRECTORY, saved.storageKey));
    await db.insert(resumeAssets).values({
      originalName: file.name,
      storageKey: saved.storageKey,
      mimeType: file.type,
      byteSize: saved.byteSize,
      extractedText: extracted.text,
      parseStatus: extracted.error ? "failed" : "parsed",
      parseError: extracted.error ?? null,
      createdAt: now(),
      updatedAt: now(),
    });
    revalidateResumeWorkspace();
    return {
      success: true,
      message: extracted.error ? "PDF 已保存，但文本提取失败。" : "PDF 简历已保存。",
    };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "上传失败，请重试。" };
  }
}

export async function createResumeEntryAction(
  _previousState: ResumeActionState = emptyState,
  formData: FormData,
): Promise<ResumeActionState> {
  void _previousState;
  const parsed = resumeEntrySchema.safeParse(entryPayload(formData));
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  await db.insert(resumeEntries).values({
    type: parsed.data.type,
    title: parsed.data.title,
    contentJson: stringifyResumeEntryContent(parsed.data.content),
    tagsJson: JSON.stringify(parsed.data.tags),
    completeness: parsed.data.completeness,
    createdAt: now(),
    updatedAt: now(),
  });
  revalidateResumeWorkspace();
  return { success: true, message: "简历条目已保存。" };
}

export async function updateResumeEntryAction(
  _previousState: ResumeActionState = emptyState,
  formData: FormData,
): Promise<ResumeActionState> {
  void _previousState;
  const id = Number(formData.get("id"));
  const parsed = resumeEntrySchema.safeParse(entryPayload(formData));
  if (!Number.isInteger(id) || id <= 0) {
    return { success: false, message: "未找到要更新的简历条目。" };
  }
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  await db.update(resumeEntries).set({
    type: parsed.data.type,
    title: parsed.data.title,
    contentJson: stringifyResumeEntryContent(parsed.data.content),
    tagsJson: JSON.stringify(parsed.data.tags),
    completeness: parsed.data.completeness,
    updatedAt: now(),
  }).where(eq(resumeEntries.id, id));
  revalidateResumeWorkspace();
  return { success: true, message: "简历条目已更新。" };
}
