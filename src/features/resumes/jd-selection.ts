import type { JdRecommendation } from "@/features/resumes/ai-schema";

export function hasCompleteRecommendationCoverage(
  recommendations: readonly JdRecommendation[],
  expectedEntryIds: readonly number[],
): boolean {
  const returnedIds = new Set(recommendations.map((recommendation) => recommendation.entryId));
  const expectedIds = new Set(expectedEntryIds);
  return returnedIds.size === expectedIds.size
    && [...expectedIds].every((entryId) => returnedIds.has(entryId));
}

export function defaultSelectedEntryIds(recommendations: readonly JdRecommendation[]): number[] {
  const highMatches = recommendations.filter((recommendation) => recommendation.level === "high");
  if (highMatches.length) return highMatches.map((recommendation) => recommendation.entryId);

  const mediumMatches = recommendations.filter((recommendation) => recommendation.level === "medium");
  if (mediumMatches.length) return mediumMatches.map((recommendation) => recommendation.entryId);

  return recommendations.length ? [recommendations[0].entryId] : [];
}

export function reconcileSelectedEntryIds(
  recommendations: readonly JdRecommendation[],
  savedEntryIds: readonly number[],
): number[] {
  if (!savedEntryIds.length) return defaultSelectedEntryIds(recommendations);
  const available = new Set(recommendations.map((recommendation) => recommendation.entryId));
  return savedEntryIds.filter((entryId) => available.has(entryId));
}
