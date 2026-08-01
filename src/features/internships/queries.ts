import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { internshipEntries, internshipRecords } from "@/db/schema";

export async function getInternshipWorkspaceData(requestedRecordId?: number) {
  const [records, entryRows] = await Promise.all([
    db
      .select()
      .from(internshipRecords)
      .orderBy(desc(internshipRecords.startDate), desc(internshipRecords.createdAt)),
    db
      .select({ internshipRecordId: internshipEntries.internshipRecordId })
      .from(internshipEntries),
  ]);

  const entryCountByRecord = entryRows.reduce<Record<number, number>>((counts, entry) => {
    counts[entry.internshipRecordId] = (counts[entry.internshipRecordId] ?? 0) + 1;
    return counts;
  }, {});

  const recordSummaries = records.map((record) => ({
    ...record,
    entryCount: entryCountByRecord[record.id] ?? 0,
  }));
  const selectedRecord =
    recordSummaries.find((record) => record.id === requestedRecordId) ??
    recordSummaries[0] ??
    null;

  const entries = selectedRecord
    ? await db
        .select()
        .from(internshipEntries)
        .where(eq(internshipEntries.internshipRecordId, selectedRecord.id))
        .orderBy(desc(internshipEntries.entryDate), desc(internshipEntries.createdAt))
    : [];

  return { records: recordSummaries, selectedRecord, entries };
}

export type InternshipRecordSummary = Awaited<ReturnType<typeof getInternshipWorkspaceData>>["records"][number];
