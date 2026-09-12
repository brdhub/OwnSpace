import "server-only";

import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  resumeAssets,
  resumeEntries,
  resumeEntryCandidates,
  resumeEntryMerges,
  resumeOptimizationMaterials,
  resumeOptimizationSuggestions,
  resumeOptimizationTasks,
  resumeAiRuns,
  type ResumeAsset,
  type ResumeOptimizationTask,
} from "@/db/schema";
import { jdRecommendationResponseSchema, type JdRecommendation } from "@/features/resumes/ai-schema";
import { hasCompleteRecommendationCoverage } from "@/features/resumes/jd-selection";
import { createTaskService } from './workflow/task-service';
import {
  parseResumeEntryContent,
  parseResumeEntryTags,
  parseResumeMaterialSnapshot,
  resumeEntryContentSchema,
  type ResumeEntryInput,
} from "@/features/resumes/schema";

export type ResumeEntryView = Pick<ResumeEntryInput, "type" | "title" | "content" | "tags"> & {
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
  inputRevision?: number;
  running?: boolean;
  optimizationRun?: {id:string;status:string;stage:string;callCount:number;inputTokens:number|null;outputTokens:number|null;durationMs:number;fallbackCount:number;canResume:boolean;canClear:boolean;errorCode:string|null};
  applicationId: number | null;
  targetRole: string;
  jdText: string;
  status: ResumeOptimizationTask["status"];
  recommendations: JdRecommendation[];
  selectedEntryIds: number[];
  suggestions: OptimizationSuggestionView[];
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OptimizationSuggestionView = {
  id: number;
  materialId: number;
  title: string;
  originalContent: Record<string, string | string[]>;
  proposedContent: Record<string, string | string[]>;
  rationale: string;
  state: "pending" | "accepted" | "ignored";
  stale?: boolean;
};

export type ResumeCandidateView = {
  id: number;
  resumeAssetId: number;
  type: ResumeEntryInput["type"];
  title: string;
  content: ResumeEntryInput["content"];
  tags: string[];
  sourceExcerpt: string;
  duplicateEntryId: number | null;
  duplicateEntryTitle: string | null;
  duplicateEntry?: ResumeEntryView;
  duplicateEntrySnapshot?: string;
  mergeId?: number;
  duplicateKind: "none" | "exact" | "similar";
  state: "pending" | "accepted" | "ignored";
  createdAt: string;
  updatedAt: string;
};

function parseSuggestionContent(contentJson: string) {
  try {
    return resumeEntryContentSchema.parse(JSON.parse(contentJson)) as Record<string, string | string[]>;
  } catch {
    return {};
  }
}

export async function getResumeWorkspaceData(): Promise<ResumeWorkspaceData> {
  createTaskService(db).expireRuns();
  const aiRuns = db.select().from(resumeAiRuns).orderBy(desc(resumeAiRuns.startedAt)).all();
  const [assets, entries, candidates, jdTasks, optimizationMaterials, optimizationSuggestions] = await Promise.all([
    db.select().from(resumeAssets).orderBy(desc(resumeAssets.updatedAt)),
    db.select().from(resumeEntries).orderBy(desc(resumeEntries.updatedAt)),
    db.select().from(resumeEntryCandidates).orderBy(desc(resumeEntryCandidates.updatedAt)),
    db.select().from(resumeOptimizationTasks).orderBy(desc(resumeOptimizationTasks.updatedAt)),
    db.select().from(resumeOptimizationMaterials),
    db.select().from(resumeOptimizationSuggestions).orderBy(asc(resumeOptimizationSuggestions.sortOrder)),
  ]);

  const entryTitleById = new Map(entries.map((entry) => [entry.id, entry.title]));
  const merges = db.select().from(resumeEntryMerges).orderBy(desc(resumeEntryMerges.id)).all();
  const selectedEntryIdsByTask = new Map<number, number[]>();
  const materialTitleById = new Map<number, string>();
  optimizationMaterials.forEach((material) => {
    if (material.kind !== "entry" || !material.resumeEntryId) return;
    const selected = selectedEntryIdsByTask.get(material.taskId) ?? [];
    selected.push(material.resumeEntryId);
    selectedEntryIdsByTask.set(material.taskId, selected);
    try {
      const snapshot = parseResumeMaterialSnapshot(material.snapshotJson);
      if (snapshot.kind === "entry") materialTitleById.set(material.id, snapshot.entry.title);
    } catch {
      materialTitleById.set(material.id, "结构化条目");
    }
  });
  const suggestionsByTask = new Map<number, OptimizationSuggestionView[]>();
  optimizationSuggestions.forEach((suggestion) => {
    const taskSuggestions = suggestionsByTask.get(suggestion.taskId) ?? [];
    taskSuggestions.push({
      id: suggestion.id,
      materialId: suggestion.materialId,
      title: materialTitleById.get(suggestion.materialId) ?? "结构化条目",
      originalContent: parseSuggestionContent(suggestion.originalText),
      proposedContent: parseSuggestionContent(suggestion.proposedText),
      rationale: suggestion.rationale,
      state: suggestion.state,
      stale: suggestion.inputRevision !== jdTasks.find(task => task.id === suggestion.taskId)?.inputRevision,
    });
    suggestionsByTask.set(suggestion.taskId, taskSuggestions);
  });

  return {
    assets,
    entries: entries.map((entry) => ({
      id: entry.id,
      type: entry.type,
      title: entry.title,
      content: parseResumeEntryContent(entry.contentJson),
      tags: parseResumeEntryTags(entry.tagsJson),
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    })),
    candidates: candidates.map((candidate) => ({
      id: candidate.id,
      resumeAssetId: candidate.resumeAssetId,
      type: candidate.type,
      title: candidate.title,
      content: parseResumeEntryContent(candidate.contentJson),
      tags: parseResumeEntryTags(candidate.tagsJson),
      sourceExcerpt: candidate.sourceExcerpt,
      duplicateEntryId: candidate.duplicateEntryId,
      duplicateEntryTitle: candidate.duplicateEntryId ? entryTitleById.get(candidate.duplicateEntryId) ?? null : null,
      ...(() => {
        const entry = entries.find(entry => entry.id === candidate.duplicateEntryId);
        const merge = merges.find(merge => merge.candidateId === candidate.id && !merge.undoneAt);
        return {
          duplicateEntry: entry ? { ...entry, content: parseResumeEntryContent(entry.contentJson), tags: parseResumeEntryTags(entry.tagsJson) } : undefined,
          duplicateEntrySnapshot: entry ? JSON.stringify(entry) : undefined,
          mergeId: merge?.id,
        };
      })(),
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
      const parsedRecommendations = jdRecommendationResponseSchema.safeParse(rawOutput);
      const recommendations = parsedRecommendations.success ? parsedRecommendations.data.recommendations : [];
      const storedError = rawOutput && typeof rawOutput === "object" && "error" in rawOutput && typeof rawOutput.error === "string"
        ? rawOutput.error
        : null;
      const incompleteResult = task.status === "completed"
        && !hasCompleteRecommendationCoverage(recommendations, entries.map((entry) => entry.id));
      return {
        id: task.id,
        inputRevision: task.inputRevision,
        running: aiRuns.some(run => run.taskId === task.id && run.status === 'running'),
        optimizationRun: (()=>{
          const run=aiRuns.find(run=>run.taskId===task.id&&run.operation==='optimization'&&run.promptVersion==='resume-recovery-v1');
          if(!run)return undefined;
          return {id:run.id,status:run.status,stage:run.stage,callCount:run.callCount,inputTokens:run.inputTokens,outputTokens:run.outputTokens,durationMs:run.durationMs,fallbackCount:run.fallbackCount,errorCode:run.errorCode,canResume:!run.checkpointsCleared&&run.inputRevision===task.inputRevision&&['waiting','failed','interrupted'].includes(run.status),canClear:!run.checkpointsCleared&&!['waiting','running'].includes(run.status)};
        })(),
        applicationId: task.applicationId,
        targetRole: task.targetRole,
        jdText: task.jdText,
        status: incompleteResult ? "failed" as const : task.status,
        recommendations,
        selectedEntryIds: selectedEntryIdsByTask.get(task.id) ?? [],
        suggestions: suggestionsByTask.get(task.id) ?? [],
        error: (() => {
          const recent = aiRuns.find(run => run.taskId === task.id && run.inputRevision === task.inputRevision);
          if (recent?.status === 'interrupted') return '上次 AI 请求已中断，可手动重试；已保存的内容不受影响。';
          if (recent?.status === 'failed') return '上次 AI 请求失败，可手动重试；已保存的内容不受影响。';
          return incompleteResult ? "此历史任务的匹配结果不完整，可重新推荐或继续手动选材。" : storedError;
        })(),
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      };
    }),
  };
}
