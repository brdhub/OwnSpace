import { formatExperienceProjects, getExperienceProjects } from "../experience-projects";
import { z } from "zod";

import { resumeEntryTypes, resumeEntryTypeLabels, type ResumeEntryType } from "@/features/resumes/constants";
import {
  educationEntryContentSchema,
  experienceEntryContentSchema,
  honorEntryContentSchema,
  parseResumeMaterialSnapshot,
  projectEntryContentSchema,
  resumeEntryContentSchema,
  skillEntryContentSchema,
} from "@/features/resumes/schema";

const documentTextSchema = z.string().max(20_000);
const itemTextSchema = z.string().max(10_000);
// One experience can contain 20 projects plus its own responsibilities and work content.
const itemBodySchema = z.string().max(200_000);

export const resumeDocumentItemSchema = z.object({
  id: z.string().trim().min(1).max(120),
  title: itemTextSchema,
  organization: itemTextSchema,
  role: itemTextSchema,
  dateRange: itemTextSchema,
  link: itemTextSchema,
  body: itemBodySchema,
  hidden: z.boolean(),
  sourceEntryId: z.number().int().positive().nullable(),
  sourceSuggestionId: z.number().int().positive().nullable(),
}).strict();

export const resumeDocumentSectionSchema = z.object({
  id: z.string().trim().min(1).max(120),
  type: z.enum(resumeEntryTypes),
  title: z.string().trim().min(1).max(120),
  hidden: z.boolean(),
  items: z.array(resumeDocumentItemSchema).max(200),
}).strict();

export const resumeDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  templateVersion: z.literal("classic-v1"),
  targetRole: z.string().max(120),
  jdText: documentTextSchema,
  profile: z.object({
    name: z.string().max(120),
    phone: z.string().max(80),
    email: z.string().max(320),
    city: z.string().max(120),
    link: z.string().max(2_000),
  }).strict(),
  sections: z.array(resumeDocumentSectionSchema).max(50),
}).strict().superRefine((document, context) => {
  const sectionIds = new Set<string>();
  const itemIds = new Set<string>();
  document.sections.forEach((section, sectionIndex) => {
    if (sectionIds.has(section.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sections", sectionIndex, "id"],
        message: "Section IDs must be unique.",
      });
    }
    sectionIds.add(section.id);
    section.items.forEach((item, itemIndex) => {
      if (itemIds.has(item.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sections", sectionIndex, "items", itemIndex, "id"],
          message: "Item IDs must be unique.",
        });
      }
      itemIds.add(item.id);
    });
  });
});

export type ResumeDocument = z.infer<typeof resumeDocumentSchema>;
export type ResumeDocumentSection = ResumeDocument["sections"][number];
export type ResumeDocumentItem = ResumeDocumentSection["items"][number];

export type BuildResumeDocumentInput = {
  task: {
    targetRole: string;
    jdText: string;
    inputRevision: number;
  };
  materials: Array<{
    id: number;
    snapshotJson: string;
  }>;
  suggestions: Array<{
    id: number;
    materialId: number;
    inputRevision: number;
    state: "pending" | "accepted" | "ignored";
    proposedText: string;
  }>;
};

const sectionOrder: ResumeEntryType[] = ["education", "skill", "project", "experience", "honor"];

function joinLines(...values: Array<string | undefined>) {
  return values.map((value) => value?.trim() ?? "").filter(Boolean).join("\n");
}

function techStackLine(values: string[]) {
  return values.length ? `技术栈：${values.join("、")}` : "";
}

function documentItem(
  entry: ReturnType<typeof parseResumeMaterialSnapshot> & { kind: "entry" },
  sourceSuggestionId: number | null,
): ResumeDocumentItem {
  const { id, type, title } = entry.entry;
  const common = {
    id: `entry-${id}`,
    title,
    organization: "",
    role: "",
    dateRange: "",
    link: "",
    body: "",
    hidden: false,
    sourceEntryId: id,
    sourceSuggestionId,
  } satisfies ResumeDocumentItem;

  switch (type) {
    case "project": {
      const content = projectEntryContentSchema.parse(entry.entry.content);
      return { ...common, role: content.projectCategory, body: joinLines(techStackLine(content.techStack), content.content && `项目内容：${content.content}`, content.responsibilities && `个人职责：${content.responsibilities}`) };
    }
    case "experience": {
      const content = experienceEntryContentSchema.parse(entry.entry.content);
      return {
        ...common,
        organization: title,
        role: content.position,
        body: joinLines(techStackLine(content.techStack), content.responsibilities, content.workContent, formatExperienceProjects(getExperienceProjects(content))),
      };
    }
    case "education": {
      const content = educationEntryContentSchema.parse(entry.entry.content);
      return {
        ...common,
        organization: title,
        role: [content.degree, content.major].filter(Boolean).join(" · "),
        dateRange: content.dateRange,
        body: content.content,
      };
    }
    case "skill": {
      const content = skillEntryContentSchema.parse(entry.entry.content);
      return { ...common, role: content.proficiency, body: content.content };
    }
    case "honor": {
      const content = honorEntryContentSchema.parse(entry.entry.content);
      return { ...common, body: content.award };
    }
  }
}

export function buildResumeDocument(input: BuildResumeDocumentInput): ResumeDocument {
  const acceptedByMaterialId = new Map(
    input.suggestions
      .filter((suggestion) => suggestion.state === "accepted" && suggestion.inputRevision === input.task.inputRevision)
      .map((suggestion) => [suggestion.materialId, suggestion]),
  );
  const itemsByType = new Map<ResumeEntryType, ResumeDocumentItem[]>();

  input.materials.forEach((material) => {
    const snapshot = parseResumeMaterialSnapshot(material.snapshotJson);
    if (snapshot.kind !== "entry") return;

    const accepted = acceptedByMaterialId.get(material.id);
    const acceptedContent = accepted
      ? resumeEntryContentSchema.parse(JSON.parse(accepted.proposedText))
      : null;
    const effectiveSnapshot = acceptedContent
      ? { ...snapshot, entry: { ...snapshot.entry, content: acceptedContent } }
      : snapshot;
    const items = itemsByType.get(snapshot.entry.type) ?? [];
    items.push(documentItem(effectiveSnapshot, accepted?.id ?? null));
    itemsByType.set(snapshot.entry.type, items);
  });

  return resumeDocumentSchema.parse({
    schemaVersion: 1,
    templateVersion: "classic-v1",
    targetRole: input.task.targetRole,
    jdText: input.task.jdText,
    profile: { name: "", phone: "", email: "", city: "", link: "" },
    sections: sectionOrder.map((type) => ({
      id: `section-${type}`,
      type,
      title: resumeEntryTypeLabels[type],
      hidden: false,
      items: itemsByType.get(type) ?? [],
    })),
  });
}

const legacyAcceptedContentSchema = z.object({
  suggestions: z.array(z.object({
    materialId: z.number().int().positive(),
    proposedText: z.string(),
  }).passthrough()).min(1),
}).passthrough();

export function readResumeDocument(
  contentJson: string,
  legacyContext: { targetRole?: string; jdText?: string } = {},
): ResumeDocument {
  const raw: unknown = JSON.parse(contentJson);
  const current = resumeDocumentSchema.safeParse(raw);
  if (current.success) return current.data;

  const legacy = legacyAcceptedContentSchema.safeParse(raw);
  if (!legacy.success) throw current.error;

  return resumeDocumentSchema.parse({
    schemaVersion: 1,
    templateVersion: "classic-v1",
    targetRole: legacyContext.targetRole ?? "",
    jdText: legacyContext.jdText ?? "",
    profile: { name: "", phone: "", email: "", city: "", link: "" },
    sections: [{
      id: "section-legacy",
      type: "project",
      title: "历史简历内容",
      hidden: false,
      items: legacy.data.suggestions.map((suggestion) => ({
        id: `legacy-material-${suggestion.materialId}`,
        title: `历史素材 ${suggestion.materialId}`,
        organization: "",
        role: "",
        dateRange: "",
        link: "",
        body: suggestion.proposedText,
        hidden: false,
        sourceEntryId: null,
        sourceSuggestionId: null,
      })),
    }],
  });
}
