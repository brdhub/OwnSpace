export const resumeEntryTypes = ["project", "experience", "education", "skill", "honor"] as const;
export const skillProficiencyLevels = ["了解", "熟悉", "熟练", "精通"] as const;
export const resumeAssetParseStatuses = ["pending", "parsed", "failed"] as const;
export const resumeEntryExtractionStatuses = ["idle", "processing", "completed", "failed"] as const;
export const resumeCandidateDuplicateKinds = ["none", "exact", "similar"] as const;
export const resumeCandidateStates = ["pending", "accepted", "ignored"] as const;
export const jdRecommendationLevels = ["high", "medium", "low"] as const;
export const optimizationTaskSources = ["text", "image"] as const;
export const optimizationTaskStatuses = ["draft", "ready", "processing", "completed", "failed"] as const;
export const optimizationMaterialKinds = ["asset", "entry"] as const;
export const optimizationSuggestionStates = ["pending", "accepted", "ignored"] as const;

export type ResumeEntryType = (typeof resumeEntryTypes)[number];
export type SkillProficiencyLevel = (typeof skillProficiencyLevels)[number];
export type ResumeAssetParseStatus = (typeof resumeAssetParseStatuses)[number];
export type ResumeEntryExtractionStatus = (typeof resumeEntryExtractionStatuses)[number];
export type ResumeCandidateDuplicateKind = (typeof resumeCandidateDuplicateKinds)[number];
export type ResumeCandidateState = (typeof resumeCandidateStates)[number];
export type JdRecommendationLevel = (typeof jdRecommendationLevels)[number];
export type OptimizationTaskSource = (typeof optimizationTaskSources)[number];
export type OptimizationTaskStatus = (typeof optimizationTaskStatuses)[number];
export type OptimizationMaterialKind = (typeof optimizationMaterialKinds)[number];
export type OptimizationSuggestionState = (typeof optimizationSuggestionStates)[number];

export const resumeEntryTypeLabels: Record<ResumeEntryType, string> = {
  project: "项目经历",
  experience: "实习经历",
  education: "教育背景",
  skill: "专业技能",
  honor: "荣誉认证",
};
