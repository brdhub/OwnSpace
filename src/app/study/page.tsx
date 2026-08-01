import { PageContainer } from "@/components/layout/page-container";
import { StudyDashboard } from "@/features/study/components/study-dashboard";
import { studyCategories, type StudyCategory } from "@/features/study/constants";
import { getRecentStudyRecords, getRecentStudySummaries, getStudyCheckinsByDate } from "@/features/study/queries";
import { toDateInputValue } from "@/lib/date";

export const dynamic = "force-dynamic";

function isDateValue(value?: string) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

type StudyPageProps = {
  searchParams?: Promise<{ date?: string; category?: string }>;
};

export default async function StudyPage({ searchParams }: StudyPageProps) {
  const params = await searchParams;
  const selectedDate = isDateValue(params?.date) ? (params?.date ?? toDateInputValue()) : toDateInputValue();
  const selectedCategory = studyCategories.includes(params?.category as StudyCategory) ? params?.category : undefined;
  const [checkins, summaries, records] = await Promise.all([
    getStudyCheckinsByDate(selectedDate),
    getRecentStudySummaries(14),
    getRecentStudyRecords(selectedCategory),
  ]);

  return (
    <PageContainer title="学习">
      <StudyDashboard selectedDate={selectedDate} checkins={checkins} summaries={summaries} records={records} selectedCategory={selectedCategory} />
    </PageContainer>
  );
}
