import { PageContainer } from '@/components/layout/page-container';
import { ResumeNavigation } from '@/features/resumes/components/resume-navigation';
import { GithubWorkspace } from '@/features/resumes/github/workspace';
import { createGithubStore, viewOf } from '@/features/resumes/github/store';
import { db } from '@/db';
import { startSchema } from '@/features/resumes/github/contracts';

export const dynamic = 'force-dynamic';

export default function GithubProjectsPage() {
  const runs = createGithubStore(db).list().map(({inputJson, viewJson, leaseToken, ...run}) => {
    void leaseToken;
    return {...run, input: startSchema.parse(JSON.parse(inputJson)), view: viewOf({...run, inputJson, viewJson, leaseToken: null})};
  });
  return <PageContainer title="简历"><ResumeNavigation active="github"/><GithubWorkspace runs={runs}/></PageContainer>;
}
