import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { journalEntries } from "@/db/schema";
import type { JournalMonthGroup } from "@/features/journal/types";
import { toDateInputValue } from "@/lib/date";

export async function getJournalEntryByDate(entryDate: string) {
  const [entry] = await db.select().from(journalEntries).where(eq(journalEntries.entryDate, entryDate)).limit(1);
  return entry ?? null;
}

export async function getJournalSidebarGroups(): Promise<JournalMonthGroup[]> {
  const rows = await db
    .select({
      id: journalEntries.id,
      entryDate: journalEntries.entryDate,
      updatedAt: journalEntries.updatedAt,
    })
    .from(journalEntries)
    .orderBy(desc(journalEntries.entryDate));

  const groups = new Map<string, JournalMonthGroup["entries"]>();
  for (const row of rows) {
    const month = row.entryDate.slice(0, 7);
    groups.set(month, [...(groups.get(month) ?? []), row]);
  }

  return Array.from(groups.entries()).map(([month, entries]) => ({ month, entries }));
}

export async function hasTodayJournalEntry() {
  return Boolean(await getJournalEntryByDate(toDateInputValue()));
}
