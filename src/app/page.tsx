import { PageContainer } from "@/components/layout/page-container";
import { getApplicationStatisticsRows } from "@/features/applications/queries";
import { DashboardView } from "@/features/dashboard/components/dashboard-view";
import { ensureDueInterviewNotes } from "@/features/dashboard/due-interviews";
import { getCalendarActivityDays, getInterviewCalendarEvents } from "@/features/dashboard/queries";
import { getDashboardPlanningSummary } from "@/features/planning/queries";
import { hasTodayJournalEntry } from "@/features/journal/queries";
import { getTodayStudyProgress } from "@/features/study/queries";
import { getResumeAssetOptions } from "@/features/resumes/queries";
import { toDateInputValue } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await ensureDueInterviewNotes();

  const today = toDateInputValue();
  const [applicationStatisticsRows, calendarEvents, calendarActivityDays, hasJournalEntry, studyProgress, planningSummary, resumeAssets] = await Promise.all([
    getApplicationStatisticsRows(),
    getInterviewCalendarEvents(),
    getCalendarActivityDays(),
    hasTodayJournalEntry(),
    getTodayStudyProgress(),
    getDashboardPlanningSummary(today),
    getResumeAssetOptions(),
  ]);

  return (
    <PageContainer title="首页">
      <DashboardView
        applicationStatisticsRows={applicationStatisticsRows}
        calendarEvents={calendarEvents}
        calendarActivityDays={calendarActivityDays}
        hasJournalEntry={hasJournalEntry}
        studyProgress={studyProgress}
        today={today}
        planningSummary={planningSummary}
        resumeAssets={resumeAssets}
      />
    </PageContainer>
  );
}


