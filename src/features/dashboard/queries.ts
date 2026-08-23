import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { applications, interviewNotes, journalEntries, recruitmentOpportunities, studyCheckins } from "@/db/schema";
import { buildCalendarActivityDays, type CalendarActivityDay } from "@/features/dashboard/calendar-activity";

export type { CalendarActivityDay } from "@/features/dashboard/calendar-activity";

export type CalendarInterviewEvent = {
  id: string;
  date: string;
  time?: string;
  company: string;
  role: string;
  source: "application" | "interviewNote";
};

export type RecommendedOpportunity = {
  id: number;
  company: string;
  roles: string;
  cities: string;
  deadline: string;
  writtenTestWaived: boolean;
};

export async function getRecommendedOpportunities(): Promise<RecommendedOpportunity[]> {
  return db
    .select({
      id: recruitmentOpportunities.id,
      company: recruitmentOpportunities.company,
      roles: recruitmentOpportunities.roles,
      cities: recruitmentOpportunities.cities,
      deadline: recruitmentOpportunities.deadline,
      writtenTestWaived: recruitmentOpportunities.writtenTestWaived,
    })
    .from(recruitmentOpportunities)
    .leftJoin(applications, eq(applications.opportunityId, recruitmentOpportunities.id))
    .where(and(eq(recruitmentOpportunities.isActive, true), isNull(applications.id)))
    .orderBy(desc(recruitmentOpportunities.sourceUpdatedDate), recruitmentOpportunities.company)
    .limit(12);
}

export async function getCalendarActivityDays(): Promise<CalendarActivityDay[]> {
  const [journalRows, studyRows, applicationRows] = await Promise.all([
    db.select({ date: journalEntries.entryDate }).from(journalEntries),
    db.select({ date: studyCheckins.checkinDate, completed: studyCheckins.isCompleted }).from(studyCheckins),
    db.select({ date: applications.appliedDate }).from(applications),
  ]);

  return buildCalendarActivityDays({ journals: journalRows, studyCheckins: studyRows, applications: applicationRows });
}

export async function getInterviewCalendarEvents(): Promise<CalendarInterviewEvent[]> {
  const [applicationRows, noteRows] = await Promise.all([
    db
      .select({
        id: applications.id,
        company: applications.company,
        role: applications.role,
        interviewTime: applications.interviewTime,
      })
      .from(applications),
    db
      .select({
        id: interviewNotes.id,
        applicationId: interviewNotes.applicationId,
        company: interviewNotes.companySnapshot,
        role: interviewNotes.roleSnapshot,
        interviewDate: interviewNotes.interviewDate,
      })
      .from(interviewNotes),
  ]);

  const applicationEvents: CalendarInterviewEvent[] = applicationRows.flatMap((row) => {
    if (!row.interviewTime) {
      return [];
    }
    const [date, time] = row.interviewTime.split("T");
    return [
      {
        id: `application-${row.id}`,
        date,
        time,
        company: row.company,
        role: row.role,
        source: "application" as const,
      },
    ];
  });

  const scheduledByApplicationDate = new Set(
    applicationEvents.map((event) => event.id.replace("application-", "") + `:${event.date}`),
  );

  const noteEvents: CalendarInterviewEvent[] = noteRows.flatMap((row) => {
    if (row.applicationId && scheduledByApplicationDate.has(`${row.applicationId}:${row.interviewDate}`)) {
      return [];
    }

    return [
      {
        id: `interview-note-${row.id}`,
        date: row.interviewDate,
        company: row.company,
        role: row.role,
        source: "interviewNote" as const,
      },
    ];
  });

  return [...applicationEvents, ...noteEvents].sort((left, right) => {
    const dateCompare = left.date.localeCompare(right.date);
    if (dateCompare !== 0) {
      return dateCompare;
    }
    return (left.time ?? "").localeCompare(right.time ?? "");
  });
}
