import "server-only";

import { desc } from "drizzle-orm";
import { db } from "@/db";
import { resumeAssets, resumeEntries, type ResumeAsset } from "@/db/schema";
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
  const [assets, entries] = await Promise.all([
    db.select().from(resumeAssets).orderBy(desc(resumeAssets.updatedAt)),
    db.select().from(resumeEntries).orderBy(desc(resumeEntries.updatedAt)),
  ]);

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
  };
}
