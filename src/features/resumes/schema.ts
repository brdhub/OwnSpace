import { z } from "zod";
import {
  optimizationMaterialKinds,
  optimizationTaskSources,
  optimizationTaskStatuses,
  resumeEntryTypes,
  skillProficiencyLevels,
} from "@/features/resumes/constants";

const titleSchema = z.string().trim().min(1).max(120);
export const skillTitleSchema = z.string().trim().min(1).max(40);
const textSchema = z.string().trim().max(4_000);
const shortTextSchema = z.string().trim().max(200);
const tagsSchema = z.array(z.string().trim().min(1).max(40)).max(12).default([])
  .transform((tags) => [...new Set(tags)]);
export const resumeEntryTagsSchema = tagsSchema;
const techStackSchema = z.array(z.string().trim().min(1).max(80)).max(30)
  .transform((items) => [...new Set(items)]);

export const projectEntryContentSchema = z.object({
  projectCategory: shortTextSchema,
  techStack: techStackSchema,
  content: textSchema,
}).strict();

export const experienceEntryContentSchema = z.object({
  position: shortTextSchema,
  techStack: techStackSchema,
  responsibilities: textSchema,
  workContent: textSchema,
}).strict();

export const educationEntryContentSchema = z.object({
  degree: shortTextSchema,
  major: shortTextSchema,
  dateRange: shortTextSchema,
  content: textSchema,
}).strict();

export const skillEntryContentSchema = z.object({
  proficiency: z.enum(skillProficiencyLevels),
  content: textSchema,
}).strict();

export const honorEntryContentSchema = z.object({
  award: shortTextSchema,
}).strict();

export const resumeEntryContentSchema = z.union([
  projectEntryContentSchema,
  experienceEntryContentSchema,
  educationEntryContentSchema,
  skillEntryContentSchema,
  honorEntryContentSchema,
]);

export const resumeEntrySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("project"), title: titleSchema, content: projectEntryContentSchema, tags: tagsSchema }).strict(),
  z.object({ type: z.literal("experience"), title: titleSchema, content: experienceEntryContentSchema, tags: tagsSchema }).strict(),
  z.object({ type: z.literal("education"), title: titleSchema, content: educationEntryContentSchema, tags: tagsSchema }).strict(),
  z.object({ type: z.literal("skill"), title: skillTitleSchema, content: skillEntryContentSchema, tags: tagsSchema }).strict(),
  z.object({ type: z.literal("honor"), title: titleSchema, content: honorEntryContentSchema, tags: tagsSchema }).strict(),
]).transform((entry) => ({
  ...entry,
  tags: entry.type === "skill" ? [entry.title] : entry.type === "honor" ? [] : entry.tags,
}));

export const resumeAssetIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const generateResumeCandidatesSchema = z.object({
  assetId: z.coerce.number().int().positive(),
  replacePending: z.enum(["true", "false"]).transform((value) => value === "true"),
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
export type ResumeEntryContent = z.infer<typeof resumeEntryContentSchema>;
export type OptimizationTaskInput = z.infer<typeof optimizationTaskInputSchema>;
export type AiOptimizationResponse = z.infer<typeof aiOptimizationResponseSchema>;

export const stringifyResumeEntryContent = (content: unknown) => JSON.stringify(resumeEntryContentSchema.parse(content));
export const parseResumeEntryContent = (contentJson: string) => resumeEntryContentSchema.parse(JSON.parse(contentJson));
export function parseResumeEntryTags(tagsJson: string) {
  try {
    const parsed = resumeEntryTagsSchema.safeParse(JSON.parse(tagsJson));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export const acceptResumeCandidateSchema = z.object({
  candidateId: z.coerce.number().int().positive(),
  type: z.enum(resumeEntryTypes),
  title: z.string().trim().min(1).max(120),
  contentJson: z.string().transform((value, context) => {
    try {
      return JSON.parse(value);
    } catch {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "候选条目内容格式无效。" });
      return z.NEVER;
    }
  }).pipe(resumeEntryContentSchema),
  tagsJson: z.string().transform((value, context) => {
    try {
      return JSON.parse(value);
    } catch {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "候选条目标签格式无效。" });
      return z.NEVER;
    }
  }).pipe(tagsSchema),
}).transform(({ candidateId, contentJson, tagsJson, ...candidate }) => ({
  candidateId,
  entry: {
    ...candidate,
    content: contentJson,
    tags: tagsJson,
  },
})).pipe(z.object({
  candidateId: z.number().int().positive(),
  entry: resumeEntrySchema,
})).transform(({ candidateId, entry }) => ({ candidateId, ...entry }));

export const resumeCandidateIdSchema = z.object({
  candidateId: z.coerce.number().int().positive(),
});

export const runJdRecommendationSchema = z.object({
  taskId: z.coerce.number().int().positive().optional(),
  applicationId: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.coerce.number().int().positive().optional(),
  ),
  targetRole: z.string().trim().min(1).max(120),
  jdText: z.string().trim().min(1).max(20_000),
});

const selectedEntryIdsJsonSchema = z.string().transform((value, context) => {
  try {
    return JSON.parse(value);
  } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "所选条目格式无效。" });
    return z.NEVER;
  }
}).pipe(z.array(z.number().int().positive()).max(200)).refine(
  (ids) => new Set(ids).size === ids.length,
  "所选条目不能重复。",
);

export const saveJdSelectionSchema = z.object({
  taskId: z.coerce.number().int().positive(),
  selectedEntryIdsJson: selectedEntryIdsJsonSchema,
}).transform(({ selectedEntryIdsJson, ...value }) => ({ ...value, selectedEntryIds: selectedEntryIdsJson }));

export const runEntryOptimizationSchema = z.object({
  taskId: z.coerce.number().int().positive(),
});

export const updateOptimizationSuggestionStateSchema = z.object({
  suggestionId: z.coerce.number().int().positive(),
  state: z.enum(["accepted", "ignored"]),
});

const resumeAssetSnapshotSchema = z.object({
  kind: z.literal("asset"),
  asset: z.object({ id: z.number().int().positive(), originalName: z.string().min(1), storageKey: z.string().min(1), mimeType: z.string().min(1), byteSize: z.number().int().nonnegative(), extractedText: z.string() }),
});
const resumeEntrySnapshotSchema = z.object({
  kind: z.literal("entry"),
  entry: z.object({ id: z.number().int().positive(), type: z.enum(resumeEntryTypes), title: z.string().min(1), content: resumeEntryContentSchema, tags: z.array(z.string()) }),
});
export const resumeMaterialSnapshotSchema = z.discriminatedUnion("kind", [resumeAssetSnapshotSchema, resumeEntrySnapshotSchema]);
export const stringifyResumeMaterialSnapshot = (snapshot: unknown) => JSON.stringify(resumeMaterialSnapshotSchema.parse(snapshot));
export const parseResumeMaterialSnapshot = (snapshotJson: string) => resumeMaterialSnapshotSchema.parse(JSON.parse(snapshotJson));

export const acceptedVersionContentSchema = z.object({ suggestions: z.array(z.object({ materialId: z.number().int().positive(), proposedText: z.string().trim().min(1).max(4_000) })).min(1) });
export const stringifyAcceptedVersionContent = (content: unknown) => JSON.stringify(acceptedVersionContentSchema.parse(content));
export const parseAcceptedVersionContent = (contentJson: string) => acceptedVersionContentSchema.parse(JSON.parse(contentJson));

export const optimizationMaterialInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("asset"), resumeAssetId: z.coerce.number().int().positive(), resumeEntryId: z.never().optional(), snapshot: resumeAssetSnapshotSchema }).strict(),
  z.object({ kind: z.literal("entry"), resumeAssetId: z.never().optional(), resumeEntryId: z.coerce.number().int().positive(), snapshot: resumeEntrySnapshotSchema }).strict(),
]).superRefine((value, ctx) => {
  const sourceId = value.kind === "asset" ? value.resumeAssetId : value.resumeEntryId;
  const snapshotId = value.kind === "asset" ? value.snapshot.asset.id : value.snapshot.entry.id;
  if (sourceId !== snapshotId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["snapshot"], message: "Material source and snapshot IDs must match." });
});
export const optimizationSuggestionInputSchema = z.object({ materialId: z.coerce.number().int().positive(), originalText: z.string().trim().min(1).max(4_000), proposedText: z.string().trim().min(1).max(4_000), rationale: z.string().trim().min(1).max(1_000) }).strict();
