import { asc, desc, eq } from "drizzle-orm";
import { applicationStatuses, type ApplicationStatus } from "@/config/application-status";
import { db } from "@/db";
import { applications, interviewNotes, interviewNoteTags, interviewQuestions, interviewTags } from "@/db/schema";
import { interviewResults, interviewRounds, type InterviewResult, type InterviewRound } from "@/features/interviews/constants";
import type { InterviewFormOptions, InterviewNoteView } from "@/features/interviews/types";

export type InterviewFilters = { query?: string; round?: string; result?: string; tagId?: string; applicationId?: string };

export async function getInterviewTags() {
  return db.select().from(interviewTags).orderBy(asc(interviewTags.category), asc(interviewTags.sortOrder));
}

export async function getInterviewFormOptions(): Promise<InterviewFormOptions> {
  const [applicationRows, tagRows] = await Promise.all([
    db.select().from(applications).orderBy(desc(applications.appliedDate), desc(applications.updatedAt)),
    getInterviewTags(),
  ]);
  return { applications: applicationRows, tags: tagRows };
}

export async function getInterviewNotes(filters: InterviewFilters): Promise<InterviewNoteView[]> {
  const [noteRows, questionRows, tagRows] = await Promise.all([
    db.select().from(interviewNotes).orderBy(desc(interviewNotes.interviewDate), desc(interviewNotes.updatedAt)),
    db.select().from(interviewQuestions).orderBy(asc(interviewQuestions.sortOrder), asc(interviewQuestions.id)),
    db.select({ noteId: interviewNoteTags.interviewNoteId, tag: interviewTags })
      .from(interviewNoteTags)
      .innerJoin(interviewTags, eq(interviewNoteTags.interviewTagId, interviewTags.id))
      .orderBy(asc(interviewTags.sortOrder)),
  ]);

  const tagsByNote = new Map<number, typeof interviewTags.$inferSelect[]>();
  for (const row of tagRows) {
    const current = tagsByNote.get(row.noteId) ?? [];
    current.push(row.tag);
    tagsByNote.set(row.noteId, current);
  }

  const questionsByNote = new Map<number, InterviewNoteView["questions"]>();
  for (const question of questionRows) {
    const current = questionsByNote.get(question.interviewNoteId) ?? [];
    current.push(question);
    questionsByNote.set(question.interviewNoteId, current);
  }

  const query = filters.query?.trim().toLowerCase();
  const round = interviewRounds.includes(filters.round as InterviewRound) ? filters.round : undefined;
  const result = interviewResults.includes(filters.result as InterviewResult) ? filters.result : undefined;
  const tagId = filters.tagId ? Number(filters.tagId) : undefined;
  const applicationId = filters.applicationId ? Number(filters.applicationId) : undefined;

  return noteRows.map((note) => ({
    ...note,
    questions: questionsByNote.get(note.id) ?? [],
    tags: tagsByNote.get(note.id) ?? [],
  }) as InterviewNoteView).filter((note) => {
    if (applicationId && note.applicationId !== applicationId) return false;
    if (round && note.round !== round) return false;
    if (result && note.result !== result) return false;
    if (tagId && !note.tags.some((tag) => tag.id === tagId)) return false;
    if (!query) return true;
    const questionText = note.questions.map((question) => question.question).join(" ");
    return `${note.companySnapshot} ${note.roleSnapshot} ${questionText}`.toLowerCase().includes(query);
  });
}

export async function getInterviewCountsByApplication() {
  const rows = await db.select({ applicationId: interviewNotes.applicationId }).from(interviewNotes);
  return rows.reduce<Record<number, number>>((acc, row) => {
    if (row.applicationId) acc[row.applicationId] = (acc[row.applicationId] ?? 0) + 1;
    return acc;
  }, {});
}

export function isApplicationStatus(value: string): value is ApplicationStatus {
  return applicationStatuses.includes(value as ApplicationStatus);
}