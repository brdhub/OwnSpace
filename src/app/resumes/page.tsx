import { PageContainer } from "@/components/layout/page-container";
import { ResumeWorkspace } from "@/features/resumes/components/resume-workspace";
import { getResumeWorkspaceData } from "@/features/resumes/queries";

export const dynamic = "force-dynamic";

export default async function ResumesPage() {
  const data = await getResumeWorkspaceData();

  return (
    <PageContainer title="简历">
      <ResumeWorkspace {...data} />
    </PageContainer>
  );
}
