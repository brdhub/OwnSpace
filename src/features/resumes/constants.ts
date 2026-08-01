export const resumeEntryTypes = ["profile", "education", "experience", "project", "skill"] as const;
export const resumeEntryCompleteness = ["incomplete", "complete"] as const;
export const resumeAssetParseStatuses = ["pending", "parsed", "failed"] as const;
export const optimizationTaskSources = ["text", "image"] as const;
export const optimizationTaskStatuses = ["draft", "ready", "processing", "completed", "failed"] as const;
export const optimizationMaterialKinds = ["asset", "entry"] as const;
export const optimizationSuggestionStates = ["pending", "accepted", "ignored"] as const;

export type ResumeEntryType = (typeof resumeEntryTypes)[number];
export type ResumeEntryCompleteness = (typeof resumeEntryCompleteness)[number];
export type ResumeAssetParseStatus = (typeof resumeAssetParseStatuses)[number];
export type OptimizationTaskSource = (typeof optimizationTaskSources)[number];
export type OptimizationTaskStatus = (typeof optimizationTaskStatuses)[number];
export type OptimizationMaterialKind = (typeof optimizationMaterialKinds)[number];
export type OptimizationSuggestionState = (typeof optimizationSuggestionStates)[number];
