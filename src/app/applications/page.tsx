import { PageContainer } from "@/components/layout/page-container";
import { getApplications } from "@/features/applications/queries";
import { ApplicationsWorkspace } from "@/features/applications/components/applications-workspace";
import { resolveApplicationFilters } from "@/features/applications/filters";

export const dynamic = "force-dynamic";

type ApplicationsPageProps = {
  searchParams: Promise<{
    query?: string;
    status?: string;
    internshipType?: string;
  }>;
};

export default async function ApplicationsPage({ searchParams }: ApplicationsPageProps) {
  const filters = resolveApplicationFilters(await searchParams);
  const rows = await getApplications(filters);

  return (
    <PageContainer title="投递记录">
      <ApplicationsWorkspace
        applications={rows}
        query={filters.query}
        status={filters.status}
        internshipType={filters.internshipType}
      />
    </PageContainer>
  );
}
