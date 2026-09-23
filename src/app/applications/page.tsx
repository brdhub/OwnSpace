import { PageContainer } from "@/components/layout/page-container";
import { getApplications } from "@/features/applications/queries";
import { getResumeAssetOptions } from "@/features/resumes/queries";
import { ApplicationsWorkspace } from "@/features/applications/components/applications-workspace";
import { resolveApplicationFilters } from "@/features/applications/filters";

export const dynamic = "force-dynamic";

type ApplicationsPageProps = {
  searchParams: Promise<{
    city?: string;
    jobCategory?: string;
    query?: string;
    status?: string;
    internshipType?: string;
  }>;
};

export default async function ApplicationsPage({ searchParams }: ApplicationsPageProps) {
  const filters = resolveApplicationFilters(await searchParams);
  const [rows, resumeAssets] = await Promise.all([getApplications(filters), getResumeAssetOptions()]);

  return (
    <PageContainer title="投递记录">
      <ApplicationsWorkspace
        applications={rows}
        city={filters.city}
        jobCategory={filters.jobCategory}
        query={filters.query}
        status={filters.status}
        internshipType={filters.internshipType}
        resumeAssets={resumeAssets}
      />
    </PageContainer>
  );
}
