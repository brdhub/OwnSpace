import { z } from "zod";
import {
  optimizationMaterialKinds,
  optimizationTaskSources,
  optimizationTaskStatuses,
  resumeEntryCompleteness,
  resumeEntryTypes,
} from "@/features/resumes/constants";

export const resumeEntrySchema = z.object({
  type: z.enum(resumeEntryTypes),
  title: z.string().trim().min(1).max(120),
  content: z.record(z.string().trim().max(4_000)).refine((content) => Object.keys(content).length <= 30),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  completeness: z.enum(resumeEntryCompleteness).default("incomplete"),
});

export const optimizationTaskInputSchema = z.object({
  jdSource: z.enum(optimizationTaskSources),
  jdImageStorageKey: z.string().trim().min(1).max(512).nullable().optional(),
  jdText: z.string().trim().max(20_000).default(""),
  targetRole: z.string().trim().min(1).max(120),
  status: z.enum(optimizationTaskStatuses).default("draft"),
  materials: z.array(z.object({
    kind: z.enum(optimizationMaterialKinds),
    sourceId: z.coerce.number().int().positive(),
  })).default([]),
}).superRefine((task, context) => {
  if (task.jdSource === "text" && !task.jdText) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["jdText"], message: "JD text is required for text input." });
  }

  if (task.jdSource === "image" && !task.jdImageStorageKey) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["jdImageStorageKey"], message: "An image key is required for image input." });
  }
});

const aiOptimizationSuggestionSchema = z.object({
  materialId: z.coerce.number().int().positive(),
  originalText: z.string().trim().min(1).max(4_000),
  proposedText: z.string().trim().min(1).max(4_000),
  rationale: z.string().trim().min(1).max(1_000),
});

export const aiOptimizationResponseSchema = z.object({
  summary: z.string().trim().max(4_000).default(""),
  questions: z.array(z.string().trim().min(1).max(1_000)).max(10).default([]),
  suggestions: z.array(aiOptimizationSuggestionSchema).max(50).default([]),
});

export type ResumeEntryInput = z.infer<typeof resumeEntrySchema>;
export type OptimizationTaskInput = z.infer<typeof optimizationTaskInputSchema>;
export type AiOptimizationResponse = z.infer<typeof aiOptimizationResponseSchema>;
