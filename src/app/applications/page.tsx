import { PageContainer } from "@/components/layout/page-container";
import { getApplications } from "@/features/applications/queries";
import { ApplicationsWorkspace } from "@/features/applications/components/applications-workspace";

export const dynamic = "force-dynamic";

type ApplicationsPageProps = {
  searchParams: Promise<{
    query?: string;
    status?: string;
    internshipType?: string;
  }>;
};

export default async function ApplicationsPage({ searchParams }: ApplicationsPageProps) {
  const params = await searchParams;
  const rows = await getApplications(params);

  return (
    <PageContainer title="投递记录">
      <ApplicationsWorkspace
        applications={rows}
        query={params.query}
        status={params.status}
        internshipType={params.internshipType}
      />
    </PageContainer>
  );
}
