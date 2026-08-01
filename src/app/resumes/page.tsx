import { PageContainer } from "@/components/layout/page-container";
import { ResumeWorkspace } from "@/features/resumes/components/resume-workspace";
import { getResumeWorkspaceData } from "@/features/resumes/queries";

export const dynamic = "force-dynamic";

export default async function ResumesPage() {
  const data = await getResumeWorkspaceData();

  return (
    <PageContainer title="简历" description="把原始 PDF 和可复用的经历条目放在一个安静、清晰的地方。">
      <ResumeWorkspace {...data} />
    </PageContainer>
  );
}
