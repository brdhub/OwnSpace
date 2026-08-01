import type { JournalEntry } from "@/db/schema";

export type JournalMonthGroup = {
  month: string;
  entries: Array<Pick<JournalEntry, "id" | "entryDate" | "updatedAt">>;
};