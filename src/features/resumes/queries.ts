import "server-only";

import { desc } from "drizzle-orm";
import { db } from "@/db";
import {
  resumeAssets,
  resumeEntries,
  resumeEntryCandidates,
  resumeOptimizationMaterials,
  resumeOptimizationTasks,
  type ResumeAsset,
  type ResumeOptimizationTask,
} from "@/db/schema";
import { jdRecommendationResponseSchema, type JdRecommendation } from "@/features/resumes/ai-schema";
import {
  parseResumeEntryContent,
  type ResumeEntryInput,
} from "@/features/resumes/schema";

export type ResumeEntryView = Pick<ResumeEntryInput, "type" | "title" | "content" | "tags" | "completeness"> & {
  id: number;
  createdAt: string;
  updatedAt: string;
};

export type ResumeWorkspaceData = {
  assets: ResumeAsset[];
  entries: ResumeEntryView[];
  candidates: ResumeCandidateView[];
  jdTasks: JdTaskView[];
};

export type JdTaskView = {
  id: number;
  targetRole: string;
  jdText: string;
  status: ResumeOptimizationTask["status"];
  recommendations: JdRecommendation[];
  selectedEntryIds: number[];
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ResumeCandidateView = {
  id: number;
  resumeAssetId: number;
  type: ResumeEntryInput["type"];
  title: string;
  content: Record<string, string>;
  sourceExcerpt: string;
  duplicateEntryId: number | null;
  duplicateEntryTitle: string | null;
  duplicateKind: "none" | "exact" | "similar";
  state: "pending" | "accepted" | "ignored";
  createdAt: string;
  updatedAt: string;
};

function parseTags(tagsJson: string) {
  try {
    const tags = JSON.parse(tagsJson);
    return Array.isArray(tags) && tags.every((tag) => typeof tag === "string") ? tags : [];
  } catch {
    return [];
  }
}

export async function getResumeWorkspaceData(): Promise<ResumeWorkspaceData> {
  const [assets, entries, candidates, jdTasks, optimizationMaterials] = await Promise.all([
    db.select().from(resumeAssets).orderBy(desc(resumeAssets.updatedAt)),
    db.select().from(resumeEntries).orderBy(desc(resumeEntries.updatedAt)),
    db.select().from(resumeEntryCandidates).orderBy(desc(resumeEntryCandidates.updatedAt)),
    db.select().from(resumeOptimizationTasks).orderBy(desc(resumeOptimizationTasks.updatedAt)),
    db.select().from(resumeOptimizationMaterials),
  ]);

  const entryTitleById = new Map(entries.map((entry) => [entry.id, entry.title]));
  const selectedEntryIdsByTask = new Map<number, number[]>();
  optimizationMaterials.forEach((material) => {
    if (material.kind !== "entry" || !material.resumeEntryId) return;
    const selected = selectedEntryIdsByTask.get(material.taskId) ?? [];
    selected.push(material.resumeEntryId);
    selectedEntryIdsByTask.set(material.taskId, selected);
  });

  return {
    assets,
    entries: entries.map((entry) => ({
      id: entry.id,
      type: entry.type,
      title: entry.title,
      content: parseResumeEntryContent(entry.contentJson),
      tags: parseTags(entry.tagsJson),
      completeness: entry.completeness,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    })),
    candidates: candidates.map((candidate) => ({
      id: candidate.id,
      resumeAssetId: candidate.resumeAssetId,
      type: candidate.type,
      title: candidate.title,
      content: parseResumeEntryContent(candidate.contentJson),
      sourceExcerpt: candidate.sourceExcerpt,
      duplicateEntryId: candidate.duplicateEntryId,
      duplicateEntryTitle: candidate.duplicateEntryId ? entryTitleById.get(candidate.duplicateEntryId) ?? null : null,
      duplicateKind: candidate.duplicateKind,
      state: candidate.state,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
    })),
    jdTasks: jdTasks.map((task) => {
      let rawOutput: unknown = null;
      try {
        rawOutput = task.aiOutputJson ? JSON.parse(task.aiOutputJson) : null;
      } catch {
        rawOutput = null;
      }
      const recommendations = jdRecommendationResponseSchema.safeParse(rawOutput);
      const error = rawOutput && typeof rawOutput === "object" && "error" in rawOutput && typeof rawOutput.error === "string"
        ? rawOutput.error
        : null;
      return {
        id: task.id,
        targetRole: task.targetRole,
        jdText: task.jdText,
        status: task.status,
        recommendations: recommendations.success ? recommendations.data.recommendations : [],
        selectedEntryIds: selectedEntryIdsByTask.get(task.id) ?? [],
        error,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      };
    }),
  };
}
