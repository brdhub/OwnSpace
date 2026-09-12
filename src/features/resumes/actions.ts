"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { resumeAssets, resumeEntries } from "@/db/schema";
import { deleteResumePdf, RESUME_ASSET_DIRECTORY, saveResumePdf } from "@/features/resumes/files";
import { saveResumeAssetWithExtraction } from "@/features/resumes/asset-upload";
import { extractPdfText } from "@/features/resumes/pdf";
import { resumeAssetIdSchema, resumeEntrySchema, stringifyResumeEntryContent } from "@/features/resumes/schema";
import { resolve } from "node:path";

export type ResumeActionState = {
  success: boolean;
  taskId?: number;
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

function splitList(value: FormDataEntryValue | null) {
  return (value?.toString() ?? "")
    .split(/[，,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function textValue(formData: FormData, name: string) {
  return formData.get(name)?.toString().trim() ?? "";
}

function entryPayload(formData: FormData) {
  const type = textValue(formData, "type");
  const common = {
    type,
    title: textValue(formData, "title"),
    tags: splitList(formData.get("tags")),
  };

  switch (type) {
    case "project":
      return { ...common, content: { projectCategory: textValue(formData, "projectCategory"), techStack: splitList(formData.get("techStack")), content: textValue(formData, "content"), responsibilities: textValue(formData, "responsibilities") } };
    case "experience":
      return { ...common, content: { position: textValue(formData, "position"), techStack: splitList(formData.get("techStack")), responsibilities: textValue(formData, "responsibilities"), workContent: textValue(formData, "workContent"), projects: formData.getAll("projectName").map((name, index) => ({ name: name.toString(), content: formData.getAll("projectContent")[index]?.toString() ?? "", responsibilities: formData.getAll("projectResponsibilities")[index]?.toString() ?? "" })) } };
    case "education":
      return { ...common, content: { degree: textValue(formData, "degree"), major: textValue(formData, "major"), dateRange: textValue(formData, "dateRange"), content: textValue(formData, "content") } };
    case "skill":
      return { ...common, content: { proficiency: textValue(formData, "proficiency"), content: textValue(formData, "content") } };
    case "honor":
      return { ...common, content: { award: textValue(formData, "award") } };
    default:
      return { ...common, content: {} };
  }
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
    const asset = await saveResumeAssetWithExtraction(file, {
      savePdf: saveResumePdf,
      extractText: extractPdfText,
      toStoragePath: (storageKey) => resolve(RESUME_ASSET_DIRECTORY, storageKey),
      insertAsset: async (values) => {
        await db.insert(resumeAssets).values(values);
      },
      now,
    });
    revalidateResumeWorkspace();
    return {
      success: true,
      message: asset.parseStatus === "failed" ? "PDF 已保存，但文本提取失败。" : "PDF 简历已保存。",
    };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "上传失败，请重试。" };
  }
}

export async function deleteResumeAssetAction(formData: FormData) {
  const parsed = resumeAssetIdSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return;
  }

  const [asset] = await db
    .select({ storageKey: resumeAssets.storageKey })
    .from(resumeAssets)
    .where(eq(resumeAssets.id, parsed.data.id))
    .limit(1);
  if (!asset) {
    return;
  }

  await deleteResumePdf(asset.storageKey);
  await db.delete(resumeAssets).where(eq(resumeAssets.id, parsed.data.id));
  revalidateResumeWorkspace();
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
    updatedAt: now(),
  }).where(eq(resumeEntries.id, id));
  revalidateResumeWorkspace();
  return { success: true, message: "简历条目已更新。" };
}
