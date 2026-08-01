import { sql } from "drizzle-orm";
import { db } from "@/db";
import { applications, interviewNotes, interviewQuestions, journalEntries, planningEvents, studyCheckins } from "@/db/schema";

export type GlobalSearchResult = {
  id: string;
  module: "投递" | "面试" | "日记" | "学习" | "规划";
  title: string;
  subtitle: string;
  excerpt: string;
  href: string;
};

function normalizeQuery(query: string) {
  return query.trim().slice(0, 80);
}

function makeLikeQuery(query: string) {
  return `%${query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
}

function excerpt(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" · ").slice(0, 160);
}

export async function searchOwnSpace(rawQuery: string): Promise<GlobalSearchResult[]> {
  const query = normalizeQuery(rawQuery);
  if (!query) {
    return [];
  }

  const likeQuery = makeLikeQuery(query);
  const [applicationRows, interviewRows, questionRows, journalRows, studyRows, planningRows] = await Promise.all([
    db
      .select()
      .from(applications)
      .where(sql`(${applications.company} like ${likeQuery} escape '\\' or ${applications.role} like ${likeQuery} escape '\\' or ${applications.source} like ${likeQuery} escape '\\' or ${applications.notes} like ${likeQuery} escape '\\')`)
      .limit(8),
    db
      .select()
      .from(interviewNotes)
      .where(sql`(${interviewNotes.companySnapshot} like ${likeQuery} escape '\\' or ${interviewNotes.roleSnapshot} like ${likeQuery} escape '\\' or ${interviewNotes.summary} like ${likeQuery} escape '\\' or ${interviewNotes.reflection} like ${likeQuery} escape '\\' or ${interviewNotes.nextAction} like ${likeQuery} escape '\\')`)
      .limit(8),
    db
      .select({
        id: interviewQuestions.id,
        question: interviewQuestions.question,
        myAnswer: interviewQuestions.myAnswer,
        betterAnswer: interviewQuestions.betterAnswer,
        company: interviewNotes.companySnapshot,
        interviewDate: interviewNotes.interviewDate,
      })
      .from(interviewQuestions)
      .leftJoin(interviewNotes, sql`${interviewQuestions.interviewNoteId} = ${interviewNotes.id}`)
      .where(sql`(${interviewQuestions.question} like ${likeQuery} escape '\\' or ${interviewQuestions.myAnswer} like ${likeQuery} escape '\\' or ${interviewQuestions.betterAnswer} like ${likeQuery} escape '\\')`)
      .limit(8),
    db
      .select()
      .from(journalEntries)
      .where(sql`(${journalEntries.content} like ${likeQuery} escape '\\' or ${journalEntries.completedToday} like ${likeQuery} escape '\\' or ${journalEntries.tomorrowMinimumAction} like ${likeQuery} escape '\\')`)
      .limit(8),
    db
      .select()
      .from(studyCheckins)
      .where(sql`(${studyCheckins.title} like ${likeQuery} escape '\\' or ${studyCheckins.notes} like ${likeQuery} escape '\\' or ${studyCheckins.category} like ${likeQuery} escape '\\')`)
      .limit(8),
    db
      .select()
      .from(planningEvents)
      .where(sql`(${planningEvents.title} like ${likeQuery} escape '\\' or ${planningEvents.description} like ${likeQuery} escape '\\')`)
      .limit(8),
  ]);

  const results: GlobalSearchResult[] = [
    ...applicationRows.map((row) => ({
      id: `application-${row.id}`,
      module: "投递" as const,
      title: `${row.company} · ${row.role}`,
      subtitle: `${row.appliedDate} / ${row.source}`,
      excerpt: excerpt(row.notes, row.applicationUrl),
      href: `/applications?query=${encodeURIComponent(query)}`,
    })),
    ...interviewRows.map((row) => ({
      id: `interview-${row.id}`,
      module: "面试" as const,
      title: `${row.companySnapshot} · ${row.roleSnapshot}`,
      subtitle: row.interviewDate,
      excerpt: excerpt(row.summary, row.reflection, row.nextAction),
      href: `/interviews?query=${encodeURIComponent(query)}`,
    })),
    ...questionRows.map((row) => ({
      id: `interview-question-${row.id}`,
      module: "面试" as const,
      title: row.question,
      subtitle: `${row.company ?? "面试问题"} / ${row.interviewDate ?? ""}`,
      excerpt: excerpt(row.myAnswer, row.betterAnswer),
      href: `/interviews?query=${encodeURIComponent(query)}`,
    })),
    ...journalRows.map((row) => ({
      id: `journal-${row.id}`,
      module: "日记" as const,
      title: `${row.entryDate} 的日记`,
      subtitle: row.mood || row.energyLevel ? [row.mood, row.energyLevel].filter(Boolean).join(" / ") : "日记记录",
      excerpt: excerpt(row.content, row.completedToday, row.tomorrowMinimumAction),
      href: `/internships?view=journal&date=${row.entryDate}`,
    })),
    ...studyRows.map((row) => ({
      id: `study-${row.id}`,
      module: "学习" as const,
      title: row.title || row.category,
      subtitle: `${row.checkinDate} / ${row.category}`,
      excerpt: excerpt(row.notes, row.sourceUrl),
      href: `/study?date=${row.checkinDate}&category=${row.category}`,
    })),
    ...planningRows.map((row) => ({
      id: `planning-${row.id}`,
      module: "规划" as const,
      title: row.title,
      subtitle: `${row.eventDate} / ${row.eventType === "task" ? "任务" : "进度"}`,
      excerpt: excerpt(row.description),
      href: "/planning",
    })),
  ];

  return results.slice(0, 40);
}
