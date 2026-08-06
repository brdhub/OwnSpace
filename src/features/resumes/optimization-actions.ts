"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  resumeEntries,
  resumeOptimizationMaterials,
  resumeOptimizationSuggestions,
  resumeOptimizationTasks,
} from "@/db/schema";
import type { ResumeActionState } from "@/features/resumes/actions";
import { optimizeEntriesForJd, recommendEntriesForJd } from "@/features/resumes/deepseek";
import {
  parseResumeMaterialSnapshot,
  parseResumeEntryContent,
  parseResumeEntryTags,
  runEntryOptimizationSchema,
  runJdRecommendationSchema,
  saveJdSelectionSchema,
  stringifyResumeMaterialSnapshot,
  updateOptimizationSuggestionStateSchema,
} from "@/features/resumes/schema";

const emptyState: ResumeActionState = { success: false };

function now() {
  return new Date().toISOString();
}

function revalidateResumeWorkspace() {
  revalidatePath("/resumes");
}

function formalEntryRows() {
  return db.select().from(resumeEntries).all();
}

export async function runJdRecommendationAction(
  _previousState: ResumeActionState = emptyState,
  formData: FormData,
): Promise<ResumeActionState> {
  void _previousState;
  const parsed = runJdRecommendationSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors };

  const entries = formalEntryRows();
  if (!entries.length) return { success: false, message: "请先确认至少一条正式简历条目，再进行 JD 匹配。" };

  const timestamp = now();
  let taskId = parsed.data.taskId;
  if (taskId) {
    const existingTask = db.select({ id: resumeOptimizationTasks.id })
      .from(resumeOptimizationTasks)
      .where(eq(resumeOptimizationTasks.id, taskId))
      .get();
    if (!existingTask) return { success: false, message: "未找到要重试的 JD 匹配任务。" };
    db.update(resumeOptimizationTasks).set({
      jdSource: "text",
      jdImageStorageKey: null,
      jdText: parsed.data.jdText,
      targetRole: parsed.data.targetRole,
      status: "processing",
      aiOutputJson: null,
      updatedAt: timestamp,
    }).where(eq(resumeOptimizationTasks.id, taskId)).run();
  } else {
    taskId = db.insert(resumeOptimizationTasks).values({
      jdSource: "text",
      jdText: parsed.data.jdText,
      targetRole: parsed.data.targetRole,
      status: "processing",
      createdAt: timestamp,
      updatedAt: timestamp,
    }).returning({ id: resumeOptimizationTasks.id }).get().id;
  }

  revalidateResumeWorkspace();
  try {
    const recommendations = await recommendEntriesForJd({
      targetRole: parsed.data.targetRole,
      jdText: parsed.data.jdText,
      formalEntries: entries.map((entry) => ({
        id: entry.id,
        type: entry.type,
        title: entry.title,
        content: parseResumeEntryContent(entry.contentJson),
        tags: parseResumeEntryTags(entry.tagsJson),
      })),
    });
    db.update(resumeOptimizationTasks).set({
      status: "completed",
      aiOutputJson: JSON.stringify({ recommendations }),
      updatedAt: now(),
    }).where(eq(resumeOptimizationTasks.id, taskId)).run();
    revalidateResumeWorkspace();
    return { success: true, taskId, message: `AI 已推荐 ${recommendations.length} 条可用素材。` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "JD 匹配失败，请重试。";
    db.update(resumeOptimizationTasks).set({
      status: "failed",
      aiOutputJson: JSON.stringify({ error: message }),
      updatedAt: now(),
    }).where(eq(resumeOptimizationTasks.id, taskId)).run();
    revalidateResumeWorkspace();
    return { success: false, taskId, message };
  }
}

export async function saveJdMaterialSelectionAction(
  _previousState: ResumeActionState = emptyState,
  formData: FormData,
): Promise<ResumeActionState> {
  void _previousState;
  const parsed = saveJdSelectionSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors };

  const task = db.select({ id: resumeOptimizationTasks.id })
    .from(resumeOptimizationTasks)
    .where(eq(resumeOptimizationTasks.id, parsed.data.taskId))
    .get();
  if (!task) return { success: false, message: "未找到 JD 匹配任务。" };

  const entries = formalEntryRows();
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  if (parsed.data.selectedEntryIds.some((entryId) => !entryById.has(entryId))) {
    return { success: false, message: "所选条目中包含已删除或不存在的内容，请刷新后重试。" };
  }

  db.transaction((transaction) => {
    transaction.delete(resumeOptimizationMaterials).where(and(
      eq(resumeOptimizationMaterials.taskId, task.id),
      eq(resumeOptimizationMaterials.kind, "entry"),
    )).run();

    if (parsed.data.selectedEntryIds.length) {
      transaction.insert(resumeOptimizationMaterials).values(parsed.data.selectedEntryIds.map((entryId) => {
        const entry = entryById.get(entryId)!;
        const tags = parseResumeEntryTags(entry.tagsJson);
        return {
          taskId: task.id,
          kind: "entry" as const,
          resumeEntryId: entry.id,
          snapshotJson: stringifyResumeMaterialSnapshot({
            kind: "entry",
            entry: {
              id: entry.id,
              type: entry.type,
              title: entry.title,
              content: parseResumeEntryContent(entry.contentJson),
              tags,
            },
          }),
          createdAt: now(),
        };
      })).run();
    }
  });

  revalidateResumeWorkspace();
  return { success: true, taskId: task.id, message: `已保存 ${parsed.data.selectedEntryIds.length} 条岗位素材快照。` };
}

export async function runEntryDescriptionOptimizationAction(
  _previousState: ResumeActionState = emptyState,
  formData: FormData,
): Promise<ResumeActionState> {
  void _previousState;
  const parsed = runEntryOptimizationSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors };

  const task = db.select().from(resumeOptimizationTasks)
    .where(eq(resumeOptimizationTasks.id, parsed.data.taskId))
    .get();
  if (!task) return { success: false, message: "未找到 JD 匹配任务。" };

  const materials = db.select().from(resumeOptimizationMaterials)
    .where(and(
      eq(resumeOptimizationMaterials.taskId, task.id),
      eq(resumeOptimizationMaterials.kind, "entry"),
    ))
    .all();
  if (!materials.length) return { success: false, taskId: task.id, message: "请先保存至少一条岗位素材，再优化描述。" };

  try {
    const entries = materials.map((material) => {
      const snapshot = parseResumeMaterialSnapshot(material.snapshotJson);
      if (snapshot.kind !== "entry") throw new Error("岗位素材快照格式异常，请重新保存选材。");
      return { material, entry: snapshot.entry };
    });
    const suggestions = await optimizeEntriesForJd({
      targetRole: task.targetRole,
      jdText: task.jdText,
      materials: entries.map(({ material, entry }) => ({
        materialId: material.id,
        type: entry.type,
        title: entry.title,
        content: entry.content,
        tags: entry.tags,
      })),
    });
    const originalByMaterialId = new Map(entries.map(({ material, entry }) => [material.id, entry.content]));

    db.transaction((transaction) => {
      transaction.delete(resumeOptimizationSuggestions)
        .where(eq(resumeOptimizationSuggestions.taskId, task.id))
        .run();
      transaction.insert(resumeOptimizationSuggestions).values(suggestions.map((suggestion, index) => ({
        taskId: task.id,
        materialId: suggestion.materialId,
        originalText: JSON.stringify(originalByMaterialId.get(suggestion.materialId) ?? {}),
        proposedText: JSON.stringify(suggestion.proposedContent),
        rationale: suggestion.rationale,
        sortOrder: index,
        createdAt: now(),
        updatedAt: now(),
      }))).run();
    });

    revalidateResumeWorkspace();
    return { success: true, taskId: task.id, message: `已生成 ${suggestions.length} 条描述优化建议。` };
  } catch (error) {
    return {
      success: false,
      taskId: task.id,
      message: error instanceof Error ? error.message : "描述优化失败，请重试。",
    };
  }
}

export async function updateOptimizationSuggestionStateAction(
  _previousState: ResumeActionState = emptyState,
  formData: FormData,
): Promise<ResumeActionState> {
  void _previousState;
  const parsed = updateOptimizationSuggestionStateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors };

  const suggestion = db.select({ id: resumeOptimizationSuggestions.id, taskId: resumeOptimizationSuggestions.taskId })
    .from(resumeOptimizationSuggestions)
    .where(eq(resumeOptimizationSuggestions.id, parsed.data.suggestionId))
    .get();
  if (!suggestion) return { success: false, message: "未找到这条优化建议。" };

  db.update(resumeOptimizationSuggestions).set({
    state: parsed.data.state,
    updatedAt: now(),
  }).where(eq(resumeOptimizationSuggestions.id, suggestion.id)).run();
  revalidateResumeWorkspace();
  return {
    success: true,
    taskId: suggestion.taskId,
    message: parsed.data.state === "accepted" ? "已接受这条建议。" : "已忽略这条建议。",
  };
}
