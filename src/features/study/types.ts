import type { StudyCheckin } from "@/db/schema";
import type { StudyCategory } from "@/features/study/constants";

export type StudyCheckinMap = Partial<Record<StudyCategory, StudyCheckin>>;

export type StudyDaySummary = {
  date: string;
  completedCount: number;
};