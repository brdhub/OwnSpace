import { PageContainer } from "@/components/layout/page-container";
import { getApplicationStats } from "@/features/applications/queries";
import { DashboardView } from "@/features/dashboard/components/dashboard-view";
import { ensureDueInterviewNotes } from "@/features/dashboard/due-interviews";
import { getCalendarActivityDays, getInterviewCalendarEvents, getRecommendedOpportunities } from "@/features/dashboard/queries";
import { getDashboardPlanningSummary } from "@/features/planning/queries";
import { hasTodayJournalEntry } from "@/features/journal/queries";
import { getTodayStudyProgress } from "@/features/study/queries";
import { getResumeAssetOptions } from "@/features/resumes/queries";
import { toDateInputValue } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await ensureDueInterviewNotes();

  const today = toDateInputValue();
  const [applicationStats, calendarEvents, calendarActivityDays, hasJournalEntry, studyProgress, planningSummary, recommendedOpportunities, resumeAssets] = await Promise.all([
    getApplicationStats(),
    getInterviewCalendarEvents(),
    getCalendarActivityDays(),
    hasTodayJournalEntry(),
    getTodayStudyProgress(),
    getDashboardPlanningSummary(today),
    getRecommendedOpportunities(),
    getResumeAssetOptions(),
  ]);

  return (
    <PageContainer title="首页">
      <DashboardView
        statusStats={applicationStats.statusStats}
        internshipTypeStats={applicationStats.internshipTypeStats}
        calendarEvents={calendarEvents}
        calendarActivityDays={calendarActivityDays}
        hasJournalEntry={hasJournalEntry}
        studyProgress={studyProgress}
        today={today}
        planningSummary={planningSummary}
        recommendedOpportunities={recommendedOpportunities}
        resumeAssets={resumeAssets}
      />
    </PageContainer>
  );
}


