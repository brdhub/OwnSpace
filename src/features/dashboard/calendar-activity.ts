export type CalendarActivityDay = {
  date: string;
  hasJournal: boolean;
  completedStudyCount: number;
  applicationCount: number;
};

type CalendarActivityInput = {
  journals: Array<{ date: string }>;
  studyCheckins: Array<{ date: string; completed: boolean }>;
  applications: Array<{ date: string }>;
};

export function buildCalendarActivityDays(input: CalendarActivityInput): CalendarActivityDay[] {
  const activityByDate = new Map<string, CalendarActivityDay>();
  const getDay = (date: string) => {
    const existing = activityByDate.get(date);
    if (existing) return existing;

    const day: CalendarActivityDay = {
      date,
      hasJournal: false,
      completedStudyCount: 0,
      applicationCount: 0,
    };
    activityByDate.set(date, day);
    return day;
  };

  for (const journal of input.journals) {
    getDay(journal.date).hasJournal = true;
  }
  for (const study of input.studyCheckins) {
    if (study.completed) getDay(study.date).completedStudyCount += 1;
  }
  for (const application of input.applications) {
    getDay(application.date).applicationCount += 1;
  }

  return Array.from(activityByDate.values()).sort((left, right) => left.date.localeCompare(right.date));
}
