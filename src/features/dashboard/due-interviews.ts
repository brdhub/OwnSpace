import "server-only";

import { and, eq, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { applications, interviewNotes } from "@/db/schema";

function localDateTimeInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export async function ensureDueInterviewNotes() {
  const dueApplications = await db
    .select({
      id: applications.id,
      company: applications.company,
      role: applications.role,
      interviewTime: applications.interviewTime,
    })
    .from(applications)
    .leftJoin(
      interviewNotes,
      and(
        eq(interviewNotes.applicationId, applications.id),
        eq(interviewNotes.interviewDate, sql<string>`substr(${applications.interviewTime}, 1, 10)`),
      ),
    )
    .where(
      and(
        isNotNull(applications.interviewTime),
        lte(applications.interviewTime, localDateTimeInputValue()),
        isNull(interviewNotes.id),
      ),
    );

  const values = dueApplications.flatMap((application) => {
    if (!application.interviewTime) {
      return [];
    }

    const timestamp = new Date().toISOString();
    return [
      {
        applicationId: application.id,
        companySnapshot: application.company,
        roleSnapshot: application.role,
        round: "other" as const,
        interviewDate: application.interviewTime.slice(0, 10),
        result: "unknown" as const,
        summary: "",
        reflection: "",
        nextAction: "",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ];
  });

  if (values.length > 0) {
    await db.insert(interviewNotes).values(values);
  }
}