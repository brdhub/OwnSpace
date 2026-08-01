import type { JdRecommendation } from "@/features/resumes/ai-schema";

export function defaultSelectedEntryIds(recommendations: readonly JdRecommendation[]): number[] {
  return recommendations.filter((recommendation) => recommendation.level === "high").map((recommendation) => recommendation.entryId);
}

export function reconcileSelectedEntryIds(
  recommendations: readonly JdRecommendation[],
  savedEntryIds: readonly number[],
): number[] {
  if (!savedEntryIds.length) return defaultSelectedEntryIds(recommendations);
  const available = new Set(recommendations.map((recommendation) => recommendation.entryId));
  return savedEntryIds.filter((entryId) => available.has(entryId));
}
