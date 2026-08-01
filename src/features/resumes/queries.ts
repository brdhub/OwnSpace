import "server-only";

import { desc } from "drizzle-orm";
import { db } from "@/db";
import { resumeAssets, resumeEntries, resumeEntryCandidates, type ResumeAsset } from "@/db/schema";
import {
  parseResumeEntryContent,
  type ResumeEntryInput,
} from "@/features/resumes/schema";

export type ResumeEntryView = Pick<ResumeEntryInput, "type" | "title" | "content" | "tags" | "completeness"> & {
  id: number;
  createdAt: string;
  updatedAt: string;
};

export type ResumeWorkspaceData = {
  assets: ResumeAsset[];
  entries: ResumeEntryView[];
  candidates: ResumeCandidateView[];
};

export type ResumeCandidateView = {
  id: number;
  resumeAssetId: number;
  type: ResumeEntryInput["type"];
  title: string;
  content: Record<string, string>;
  sourceExcerpt: string;
  duplicateEntryId: number | null;
  duplicateEntryTitle: string | null;
  duplicateKind: "none" | "exact" | "similar";
  state: "pending" | "accepted" | "ignored";
  createdAt: string;
  updatedAt: string;
};

function parseTags(tagsJson: string) {
  try {
    const tags = JSON.parse(tagsJson);
    return Array.isArray(tags) && tags.every((tag) => typeof tag === "string") ? tags : [];
  } catch {
    return [];
  }
}

export async function getResumeWorkspaceData(): Promise<ResumeWorkspaceData> {
  const [assets, entries, candidates] = await Promise.all([
    db.select().from(resumeAssets).orderBy(desc(resumeAssets.updatedAt)),
    db.select().from(resumeEntries).orderBy(desc(resumeEntries.updatedAt)),
    db.select().from(resumeEntryCandidates).orderBy(desc(resumeEntryCandidates.updatedAt)),
  ]);

  const entryTitleById = new Map(entries.map((entry) => [entry.id, entry.title]));

  return {
    assets,
    entries: entries.map((entry) => ({
      id: entry.id,
      type: entry.type,
      title: entry.title,
      content: parseResumeEntryContent(entry.contentJson),
      tags: parseTags(entry.tagsJson),
      completeness: entry.completeness,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    })),
    candidates: candidates.map((candidate) => ({
      id: candidate.id,
      resumeAssetId: candidate.resumeAssetId,
      type: candidate.type,
      title: candidate.title,
      content: parseResumeEntryContent(candidate.contentJson),
      sourceExcerpt: candidate.sourceExcerpt,
      duplicateEntryId: candidate.duplicateEntryId,
      duplicateEntryTitle: candidate.duplicateEntryId ? entryTitleById.get(candidate.duplicateEntryId) ?? null : null,
      duplicateKind: candidate.duplicateKind,
      state: candidate.state,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
    })),
  };
}
