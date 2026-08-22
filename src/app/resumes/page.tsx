import { PageContainer } from "@/components/layout/page-container";
import { ResumeWorkspace } from "@/features/resumes/components/resume-workspace";
import { getResumeWorkspaceData } from "@/features/resumes/queries";
import { getApplicationJdContext } from "@/features/applications/queries";

export const dynamic = "force-dynamic";

type ResumesPageProps = {
  searchParams: Promise<{ tab?: string; applicationId?: string }>;
};

function parseApplicationId(value?: string) {
  if (!value || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export default async function ResumesPage({ searchParams }: ResumesPageProps) {
  const params = await searchParams;
  const data = await getResumeWorkspaceData();
  const requestedApplicationId = parseApplicationId(params.applicationId);
  const applicationContext = requestedApplicationId
    ? await getApplicationJdContext(requestedApplicationId)
    : null;
  const applicationContextError = params.applicationId && !applicationContext
    ? "未找到对应投递，或该投递尚未填写岗位描述。"
    : undefined;

  return (
    <PageContainer title="简历">
      <ResumeWorkspace
        {...data}
        initialTab={params.tab === "jd" ? "jd" : "vault"}
        applicationContext={applicationContext}
        applicationContextError={applicationContextError}
      />
    </PageContainer>
  );
}
