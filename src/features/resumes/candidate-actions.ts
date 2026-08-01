"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { resumeAssets, resumeEntries, resumeEntryCandidates } from "@/db/schema";
import type { ResumeActionState } from "@/features/resumes/actions";
import {
  prepareGeneratedCandidates,
  resolveCandidateAcceptance,
} from "@/features/resumes/candidate-service";
import { generateEntryCandidates } from "@/features/resumes/deepseek";
import {
  acceptResumeCandidateSchema,
  generateResumeCandidatesSchema,
  parseResumeEntryContent,
  resumeCandidateIdSchema,
  stringifyResumeEntryContent,
} from "@/features/resumes/schema";

const emptyState: ResumeActionState = { success: false };

function now() {
  return new Date().toISOString();
}

function revalidateResumeWorkspace() {
  revalidatePath("/resumes");
}

function getFormalEntries() {
  return db.select().from(resumeEntries).all().map((entry) => ({
    id: entry.id,
    type: entry.type,
    title: entry.title,
    content: parseResumeEntryContent(entry.contentJson),
  }));
}

export async function generateResumeCandidatesAction(
  _previousState: ResumeActionState = emptyState,
  formData: FormData,
): Promise<ResumeActionState> {
  void _previousState;
  const parsed = generateResumeCandidatesSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  const asset = db.select().from(resumeAssets).where(eq(resumeAssets.id, parsed.data.assetId)).get();
  if (!asset) return { success: false, message: "未找到这份 PDF 简历。" };
  if (asset.parseStatus !== "parsed" || !asset.extractedText.trim()) {
    return { success: false, message: "这份 PDF 没有可用文本；当前版本暂不支持 PDF OCR。" };
  }

  const pending = db.select({ id: resumeEntryCandidates.id })
    .from(resumeEntryCandidates)
    .where(and(eq(resumeEntryCandidates.resumeAssetId, asset.id), eq(resumeEntryCandidates.state, "pending")))
    .all();
  if (pending.length && !parsed.data.replacePending) {
    return { success: false, message: "这份 PDF 仍有待处理候选；请先处理，或确认重新生成并替换待处理候选。" };
  }

  db.update(resumeAssets).set({
    entryExtractionStatus: "processing",
    entryExtractionError: null,
    updatedAt: now(),
  }).where(eq(resumeAssets.id, asset.id)).run();
  revalidateResumeWorkspace();

  try {
    const formalEntries = getFormalEntries();
    const generated = await generateEntryCandidates({
      extractedText: asset.extractedText,
      formalEntries,
    });
    const prepared = prepareGeneratedCandidates(generated, formalEntries);
    const timestamp = now();

    db.transaction((transaction) => {
      if (parsed.data.replacePending) {
        transaction.delete(resumeEntryCandidates)
          .where(and(eq(resumeEntryCandidates.resumeAssetId, asset.id), eq(resumeEntryCandidates.state, "pending")))
          .run();
      }

      if (prepared.candidates.length) {
        transaction.insert(resumeEntryCandidates).values(prepared.candidates.map((candidate) => ({
          resumeAssetId: asset.id,
          type: candidate.type,
          title: candidate.title,
          contentJson: stringifyResumeEntryContent(candidate.content),
          sourceExcerpt: candidate.sourceExcerpt,
          duplicateEntryId: candidate.duplicateEntryId,
          duplicateKind: candidate.duplicateKind,
          state: "pending" as const,
          createdAt: timestamp,
          updatedAt: timestamp,
        }))).run();
      }

      transaction.update(resumeAssets).set({
        entryExtractionStatus: "completed",
        entryExtractionError: null,
        entryExtractedAt: timestamp,
        updatedAt: timestamp,
      }).where(eq(resumeAssets.id, asset.id)).run();
    });

    revalidateResumeWorkspace();
    const skippedMessage = prepared.skippedExactCount
      ? `，另有 ${prepared.skippedExactCount} 条与仓库完全重复，已跳过`
      : "";
    return { success: true, message: `已生成 ${prepared.candidates.length} 条待确认候选${skippedMessage}。` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成候选条目失败，请重试。";
    db.update(resumeAssets).set({
      entryExtractionStatus: "failed",
      entryExtractionError: message,
      updatedAt: now(),
    }).where(eq(resumeAssets.id, asset.id)).run();
    revalidateResumeWorkspace();
    return { success: false, message };
  }
}

export async function acceptResumeCandidateAction(
  _previousState: ResumeActionState = emptyState,
  formData: FormData,
): Promise<ResumeActionState> {
  void _previousState;
  const parsed = acceptResumeCandidateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors };

  const candidate = db.select().from(resumeEntryCandidates)
    .where(and(eq(resumeEntryCandidates.id, parsed.data.candidateId), eq(resumeEntryCandidates.state, "pending")))
    .get();
  if (!candidate) return { success: false, message: "候选条目不存在或已处理。" };

  const formalEntries = getFormalEntries();
  const resolution = resolveCandidateAcceptance(parsed.data, formalEntries);
  if (!resolution.accepted) {
    db.update(resumeEntryCandidates).set({
      duplicateEntryId: resolution.duplicateEntryId,
      duplicateKind: "exact",
      updatedAt: now(),
    }).where(eq(resumeEntryCandidates.id, candidate.id)).run();
    revalidateResumeWorkspace();
    return { success: false, message: "条目仓库中已存在完全相同的内容，未重复添加。" };
  }

  const timestamp = now();
  db.transaction((transaction) => {
    transaction.insert(resumeEntries).values({
      type: parsed.data.type,
      title: parsed.data.title,
      contentJson: stringifyResumeEntryContent(parsed.data.content),
      tagsJson: "[]",
      completeness: "complete",
      createdAt: timestamp,
      updatedAt: timestamp,
    }).run();
    transaction.update(resumeEntryCandidates).set({
      type: parsed.data.type,
      title: parsed.data.title,
      contentJson: stringifyResumeEntryContent(parsed.data.content),
      state: "accepted",
      updatedAt: timestamp,
    }).where(and(eq(resumeEntryCandidates.id, candidate.id), eq(resumeEntryCandidates.state, "pending"))).run();
  });

  revalidateResumeWorkspace();
  return { success: true, message: "候选条目已加入正式条目仓库。" };
}

export async function ignoreResumeCandidateAction(formData: FormData) {
  const parsed = resumeCandidateIdSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return;
  db.update(resumeEntryCandidates).set({ state: "ignored", updatedAt: now() })
    .where(and(eq(resumeEntryCandidates.id, parsed.data.candidateId), eq(resumeEntryCandidates.state, "pending")))
    .run();
  revalidateResumeWorkspace();
}
