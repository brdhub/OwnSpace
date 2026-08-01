import { z } from "zod";
import { resumeEntryTypes } from "@/features/resumes/constants";

export const generatedCandidateSchema = z.object({
  type: z.enum(resumeEntryTypes),
  title: z.string().trim().min(1).max(200),
  content: z.record(z.string().trim().min(1).max(80), z.string().trim().min(1).max(4_000))
    .refine((content) => Object.keys(content).length <= 30),
  sourceExcerpt: z.string().trim().min(1).max(2_000),
  similarEntryId: z.number().int().positive().nullable(),
}).strict();

export const generatedCandidateResponseSchema = z.object({
  candidates: z.array(generatedCandidateSchema).max(100),
}).strict();

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

export type GeneratedCandidate = z.infer<typeof generatedCandidateSchema>;
export type JdRecommendation = z.infer<typeof jdRecommendationSchema>;
export type JdRecommendationResponse = z.infer<typeof jdRecommendationResponseSchema>;
