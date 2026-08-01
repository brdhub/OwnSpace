import { db } from "@/db";
import { applications, interviewNotes, journalEntries, studyCheckins } from "@/db/schema";

export type CalendarInterviewEvent = {
  id: string;
  date: string;
  time?: string;
  company: string;
  role: string;
  source: "application" | "interviewNote";
};

export type CalendarActivityDay = {
  date: string;
  hasJournal: boolean;
  completedStudyCount: number;
};

export async function getCalendarActivityDays(): Promise<CalendarActivityDay[]> {
  const [journalRows, studyRows] = await Promise.all([
    db.select({ date: journalEntries.entryDate }).from(journalEntries),
    db.select({ date: studyCheckins.checkinDate, completed: studyCheckins.isCompleted }).from(studyCheckins),
  ]);

  const activityByDate = new Map<string, CalendarActivityDay>();
  const getDay = (date: string) => {
    const existing = activityByDate.get(date);
    if (existing) return existing;

    const day: CalendarActivityDay = {
      date,
      hasJournal: false,
      completedStudyCount: 0,
    };
    activityByDate.set(date, day);
    return day;
  };

  for (const journal of journalRows) {
    getDay(journal.date).hasJournal = true;
  }
  for (const study of studyRows) {
    if (study.completed) getDay(study.date).completedStudyCount += 1;
  }

  return Array.from(activityByDate.values()).sort((left, right) => left.date.localeCompare(right.date));
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
