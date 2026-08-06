import { z } from "zod";
import {
  educationEntryContentSchema,
  experienceEntryContentSchema,
  honorEntryContentSchema,
  projectEntryContentSchema,
  resumeEntryContentSchema,
  skillTitleSchema,
  skillEntryContentSchema,
} from "@/features/resumes/schema";

const candidateFields = {
  title: z.string().trim().min(1).max(120),
  tags: z.array(z.string().trim().min(1).max(40)).max(12),
  sourceExcerpt: z.string().trim().min(1).max(2_000),
  similarEntryId: z.number().int().positive().nullable(),
};

export const generatedCandidateSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("project"), ...candidateFields, content: projectEntryContentSchema.strip() }).strip(),
  z.object({ type: z.literal("experience"), ...candidateFields, content: experienceEntryContentSchema.strip() }).strip(),
  z.object({ type: z.literal("education"), ...candidateFields, content: educationEntryContentSchema.strip() }).strip(),
  z.object({ type: z.literal("skill"), ...candidateFields, title: skillTitleSchema, content: skillEntryContentSchema.strip() }).strip(),
  z.object({ type: z.literal("honor"), ...candidateFields, content: honorEntryContentSchema.strip() }).strip(),
]).transform((candidate) => ({
  ...candidate,
  tags: candidate.type === "skill" ? [candidate.title] : candidate.type === "honor" ? [] : [...new Set(candidate.tags)],
}));

export const generatedCandidateResponseSchema = z.object({
  candidates: z.array(generatedCandidateSchema).max(100),
}).strip();

export const jdRecommendationSchema = z.object({
  entryId: z.number().int().positive(),
  level: z.enum(["high", "medium", "low"]),
  reason: z.string().trim().min(1).max(500),
}).strict();

export const jdRecommendationResponseSchema = z.object({
  recommendations: z.array(jdRecommendationSchema).max(200),
}).strict().superRefine((value, context) => {
  const seen = new Set<number>();
  value.recommendations.forEach((recommendation, index) => {
    if (seen.has(recommendation.entryId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recommendations", index, "entryId"],
        message: "Recommendation entry IDs must be unique.",
      });
    }
    seen.add(recommendation.entryId);
  });
});

export const entryOptimizationSuggestionSchema = z.object({
  materialId: z.number().int().positive(),
  proposedContent: resumeEntryContentSchema,
  rationale: z.string().trim().min(1).max(1_000),
}).strict();

export const entryOptimizationResponseSchema = z.object({
  suggestions: z.array(entryOptimizationSuggestionSchema).max(200),
}).strict().superRefine((value, context) => {
  const seen = new Set<number>();
  value.suggestions.forEach((suggestion, index) => {
    if (seen.has(suggestion.materialId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["suggestions", index, "materialId"],
        message: "Suggestion material IDs must be unique.",
      });
    }
    seen.add(suggestion.materialId);
  });
});

export type GeneratedCandidate = z.infer<typeof generatedCandidateSchema>;
export type JdRecommendation = z.infer<typeof jdRecommendationSchema>;
export type JdRecommendationResponse = z.infer<typeof jdRecommendationResponseSchema>;
export type EntryOptimizationSuggestion = z.infer<typeof entryOptimizationSuggestionSchema>;
