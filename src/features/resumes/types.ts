import type {
  ResumeAsset,
  ResumeEntry,
  ResumeEntryCandidate,
  ResumeOptimizationMaterial,
  ResumeOptimizationSuggestion,
  ResumeOptimizationTask,
  ResumeVersion,
} from "@/db/schema";

export type ResumeAssetRecord = ResumeAsset;
export type ResumeEntryRecord = ResumeEntry;
export type ResumeEntryCandidateRecord = ResumeEntryCandidate;
export type OptimizationTaskRecord = ResumeOptimizationTask;
export type OptimizationMaterialRecord = ResumeOptimizationMaterial;
export type OptimizationSuggestionRecord = ResumeOptimizationSuggestion;
export type ResumeVersionRecord = ResumeVersion;
