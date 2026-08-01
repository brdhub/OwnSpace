import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { studyCheckins } from "@/db/schema";
import { studyCategories, type StudyCategory } from "@/features/study/constants";
import type { StudyCheckinMap, StudyDaySummary } from "@/features/study/types";
import { toDateInputValue } from "@/lib/date";

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return toDateInputValue(date);
}

export async function getStudyCheckinsByDate(checkinDate: string): Promise<StudyCheckinMap> {
  const rows = await db.select().from(studyCheckins).where(eq(studyCheckins.checkinDate, checkinDate));
  return rows.reduce<StudyCheckinMap>((acc, row) => {
    acc[row.category as StudyCategory] = row;
    return acc;
  }, {});
}

export async function getRecentStudySummaries(days = 14): Promise<StudyDaySummary[]> {
  const startDate = daysAgo(days - 1);
  const rows = await db.select().from(studyCheckins).where(gte(studyCheckins.checkinDate, startDate));
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.isCompleted) {
      counts.set(row.checkinDate, (counts.get(row.checkinDate) ?? 0) + 1);
    }
  }

  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - index));
    const key = toDateInputValue(date);
    return { date: key, completedCount: counts.get(key) ?? 0 };
  });
}

export async function getRecentStudyRecords(category?: string) {
  const rows = await db.select().from(studyCheckins).orderBy(desc(studyCheckins.checkinDate), desc(studyCheckins.updatedAt)).limit(80);
  const validCategory = studyCategories.includes(category as StudyCategory) ? category : undefined;
  return rows.filter((row) => !validCategory || row.category === validCategory);
}

export async function getTodayStudyProgress() {
  const today = toDateInputValue();
  const rows = await db.select().from(studyCheckins).where(eq(studyCheckins.checkinDate, today));
  const completed = rows.filter((row) => row.isCompleted).length;
  const completedCategories = new Set(rows.filter((row) => row.isCompleted).map((row) => row.category));
  return {
    completed,
    categories: studyCategories.map((category) => ({ category, completed: completedCategories.has(category) })),
  };
}

export async function getStudyCheckin(checkinDate: string, category: StudyCategory) {
  const [row] = await db
    .select()
    .from(studyCheckins)
    .where(and(eq(studyCheckins.checkinDate, checkinDate), eq(studyCheckins.category, category)))
    .limit(1);
  return row ?? null;
}