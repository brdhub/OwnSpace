"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { readResumeDocument, type ResumeDocument } from "@/features/resumes/documents/model";
import {
  DocumentServiceError,
  createResumeDocumentService,
} from "@/features/resumes/documents/service";

export type DocumentActionState = {
  success: boolean;
  message: string;
  taskId?: number;
  revision?: number;
  versionId?: number;
  document?: ResumeDocument;
};

const documentService = createResumeDocumentService(db);
const positiveInteger = z.coerce.number().int().positive();
const optionalPositiveInteger = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? undefined : value,
  positiveInteger.optional(),
);
const createDraftInputSchema = z.object({
  taskId: positiveInteger,
  expectedRevision: optionalPositiveInteger,
});
const saveDraftInputSchema = z.object({
  taskId: positiveInteger,
  revision: positiveInteger,
  contentJson: z.string().min(1).max(2_000_000),
});
const saveVersionInputSchema = z.object({
  taskId: positiveInteger,
  revision: positiveInteger,
  idempotencyKey: z.string().trim().min(1).max(200),
  name: z.string().trim().max(120),
});
const copyVersionInputSchema = z.object({
  versionId: positiveInteger,
  targetTaskId: optionalPositiveInteger,
  expectedRevision: optionalPositiveInteger,
});

function failure(message: string): DocumentActionState {
  return { success: false, message };
}

function validationFailure() {
  return failure("提交内容无效，请检查后重试。");
}

function serviceFailure(error: unknown) {
  return failure(error instanceof DocumentServiceError ? error.message : "操作失败，请重试。");
}

function revalidateDocuments(taskId: number) {
  revalidatePath("/resumes");
  revalidatePath(`/resumes/documents/${taskId}`);
  revalidatePath("/resumes/versions");
}

export async function createDraftAction(
  _previousState: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  const parsed = createDraftInputSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return validationFailure();
  try {
    const draft = documentService.createDraft(parsed.data);
    revalidateDocuments(draft.taskId);
    return {
      success: true,
      message: parsed.data.expectedRevision === undefined ? "简历草稿已生成。" : "简历草稿已重新生成。",
      taskId: draft.taskId,
      revision: draft.revision,
      document: draft.document,
    };
  } catch (error) {
    return serviceFailure(error);
  }
}

export async function saveDraftAction(
  _previousState: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  const parsed = saveDraftInputSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return validationFailure();
  let document: ResumeDocument;
  try {
    document = readResumeDocument(parsed.data.contentJson);
  } catch {
    return failure("简历内容格式无效，请检查后重试。");
  }
  try {
    const draft = documentService.saveDraft({ ...parsed.data, document });
    revalidateDocuments(draft.taskId);
    return {
      success: true,
      message: "简历草稿已保存。",
      taskId: draft.taskId,
      revision: draft.revision,
      document: draft.document,
    };
  } catch (error) {
    return serviceFailure(error);
  }
}

export async function saveVersionAction(
  _previousState: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  const parsed = saveVersionInputSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return validationFailure();
  try {
    const version = documentService.saveVersion(parsed.data);
    revalidateDocuments(parsed.data.taskId);
    revalidatePath(`/resumes/versions/${version.id}`);
    return {
      success: true,
      message: "简历版本已保存。",
      taskId: parsed.data.taskId,
      revision: parsed.data.revision,
      versionId: version.id,
      document: version.document,
    };
  } catch (error) {
    return serviceFailure(error);
  }
}

export async function copyVersionAction(
  _previousState: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  const parsed = copyVersionInputSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return validationFailure();
  try {
    const draft = documentService.copyVersion(parsed.data);
    revalidateDocuments(draft.taskId);
    return {
      success: true,
      message: "历史版本已复制为草稿。",
      taskId: draft.taskId,
      revision: draft.revision,
      versionId: parsed.data.versionId,
      document: draft.document,
    };
  } catch (error) {
    return serviceFailure(error);
  }
}
