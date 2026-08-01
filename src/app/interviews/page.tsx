import { PageContainer } from "@/components/layout/page-container";
import { getInterviewFormOptions, getInterviewNotes } from "@/features/interviews/queries";
import { InterviewsWorkspace } from "@/features/interviews/components/interviews-workspace";

export const dynamic = "force-dynamic";

type InterviewsPageProps = {
  searchParams: Promise<{
    query?: string;
    round?: string;
    result?: string;
    tagId?: string;
    applicationId?: string;
  }>;
};

export default async function InterviewsPage({ searchParams }: InterviewsPageProps) {
  const filters = await searchParams;
  const [notes, options] = await Promise.all([getInterviewNotes(filters), getInterviewFormOptions()]);

  return (
    <PageContainer title="面试" description="记录问题，也记录下一次会更好的地方。">
      <InterviewsWorkspace notes={notes} applications={options.applications} tags={options.tags} filters={filters} />
    </PageContainer>
  );
}
