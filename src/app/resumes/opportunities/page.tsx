import { PageContainer } from "@/components/layout/page-container";
import { OpportunitiesWorkspace } from "@/features/applications/opportunities/components/opportunities-workspace";
import { getOpportunityPageMeta, getRecruitmentOpportunities } from "@/features/applications/opportunities/queries";
import { opportunityFiltersSchema } from "@/features/applications/opportunities/schemas";
import { ResumeNavigation } from "@/features/resumes/components/resume-navigation";
import { getResumeAssetOptions } from "@/features/resumes/queries";

export const dynamic = "force-dynamic";

type OpportunitiesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ResumeOpportunitiesPage({ searchParams }: OpportunitiesPageProps) {
  const rawParams = await searchParams;
  const filters = opportunityFiltersSchema.parse({
    query: typeof rawParams.query === "string" ? rawParams.query : "",
    companyType: typeof rawParams.companyType === "string" ? rawParams.companyType : "",
    city: typeof rawParams.city === "string" ? rawParams.city : "",
    unrestrictedMajor: rawParams.unrestrictedMajor === "true" ? "true" : "",
  });
  const [opportunities, meta, resumeAssets] = await Promise.all([
    getRecruitmentOpportunities(filters),
    getOpportunityPageMeta(),
    getResumeAssetOptions(),
  ]);

  return <PageContainer title="简历">
    <div>
      <ResumeNavigation active="opportunities" />
      <h2 className="mb-4 text-lg font-semibold text-foreground">秋招企业</h2>
      <OpportunitiesWorkspace
        opportunities={opportunities}
        companyTypes={meta.companyTypes}
        cities={meta.cities}
        lastSyncedAt={meta.lastSyncedAt}
        query={filters.query}
        companyType={filters.companyType}
        city={filters.city}
        unrestrictedMajor={filters.unrestrictedMajor}
        resumeAssets={resumeAssets}
      />
    </div>
  </PageContainer>;
}
