"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { createCandidateMergeService } from './candidate-merge-service';
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { resumeAssets, resumeEntries, resumeEntryCandidates } from "@/db/schema";
import type { ResumeActionState } from "@/features/resumes/actions";
import {
  prepareGeneratedCandidates,
  resolveCandidateAcceptance,
} from "@/features/resumes/candidate-service";
import { generateEntryCandidatesDetailed } from "@/features/resumes/deepseek";
import {
  acceptResumeCandidateSchema,
  generateResumeCandidatesSchema,
  parseResumeEntryContent,
  parseResumeEntryTags,
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
    tags: parseResumeEntryTags(entry.tagsJson),
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
  if (asset.parseStatus === "failed") {
    return { success: false, message: "PDF 文件读取失败，请重新上传可正常打开的 PDF。尚未调用 AI 整理，已有候选已保留。" };
  }
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
    const extraction = await generateEntryCandidatesDetailed({
      extractedText: asset.extractedText,
      formalEntries,
    });
    const prepared = prepareGeneratedCandidates(extraction.candidates, formalEntries);
    const warning = extraction.issues.length
      ? `部分候选未完成整理，本次合格候选已保留。${extraction.issues.slice(0, 5).map(issue => `${issue.path}：${issue.message}`).join("；")}`
      : null;
    const timestamp = now();

    db.transaction((transaction) => {
      if (parsed.data.replacePending && !warning) {
        transaction.delete(resumeEntryCandidates)
          .where(and(eq(resumeEntryCandidates.resumeAssetId, asset.id), eq(resumeEntryCandidates.state, "pending")))
          .run();
      }

      const existing = transaction.select().from(resumeEntryCandidates)
        .where(and(eq(resumeEntryCandidates.resumeAssetId, asset.id), eq(resumeEntryCandidates.state, "pending"))).all();
      const fresh = prepared.candidates.filter(candidate => !existing.some(item =>
        item.type === candidate.type && item.title === candidate.title && item.contentJson === stringifyResumeEntryContent(candidate.content)));
      if (fresh.length) {
        transaction.insert(resumeEntryCandidates).values(fresh.map((candidate) => ({
          resumeAssetId: asset.id,
          type: candidate.type,
          title: candidate.title,
          contentJson: stringifyResumeEntryContent(candidate.content),
          tagsJson: JSON.stringify(candidate.tags),
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
        entryExtractionError: warning,
        entryExtractedAt: timestamp,
        updatedAt: timestamp,
      }).where(eq(resumeAssets.id, asset.id)).run();
    });

    revalidateResumeWorkspace();
    const skippedMessage = prepared.skippedExactCount
      ? `，另有 ${prepared.skippedExactCount} 条与仓库完全重复，已跳过`
      : "";
    return { success: true, message: `已整理 ${prepared.candidates.length} 条合格候选${skippedMessage}。${warning ?? ""}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成候选条目失败，请重试。已有候选已保留。";
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
      tagsJson: JSON.stringify(parsed.data.tags),
      createdAt: timestamp,
      updatedAt: timestamp,
    }).run();
    transaction.update(resumeEntryCandidates).set({
      type: parsed.data.type,
      title: parsed.data.title,
      contentJson: stringifyResumeEntryContent(parsed.data.content),
      tagsJson: JSON.stringify(parsed.data.tags),
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

export async function mergeResumeCandidateAction(_state: ResumeActionState, formData: FormData): Promise<ResumeActionState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = acceptResumeCandidateSchema.safeParse(raw);
  const snapshot = z.string().min(1).max(200_000).safeParse(raw.expectedEntryJson);
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors };
  if (!snapshot.success) return { success: false, message: '条目快照无效，请刷新。' };
  try {
    const { candidateId, ...entry } = parsed.data;
    createCandidateMergeService(db).merge({ candidateId, expectedEntryJson: snapshot.data, entry });
    revalidateResumeWorkspace();
    return { success: true, message: '已补充到原条目，修改前内容已保存，可撤回此次补充。' };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : '补充失败，请重试。' };
  }
}

export async function undoResumeCandidateMergeAction(_state: ResumeActionState, formData: FormData): Promise<ResumeActionState> {
  const id = z.coerce.number().int().positive().safeParse(formData.get('mergeId'));
  if (!id.success) return { success: false, message: '补充记录无效。' };
  try {
    createCandidateMergeService(db).undo(id.data);
    revalidateResumeWorkspace();
    return { success: true, message: '已撤回补充，候选恢复为待确认。' };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : '撤回失败。' };
  }
}
