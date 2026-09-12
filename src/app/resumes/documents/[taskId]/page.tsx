import { notFound } from 'next/navigation';
import { PageContainer } from '@/components/layout/page-container';
import { getDocumentWorkspace } from '@/features/resumes/documents/queries';
import { DocumentEditor } from '@/features/resumes/documents/editor';
import { DocumentServiceError } from '@/features/resumes/documents/service';

export const dynamic = 'force-dynamic';
export default async function Page({params}:{params:Promise<{taskId:string}>}) {
  const {taskId}=await params;
  if(!/^\d+$/.test(taskId)||!Number.isSafeInteger(Number(taskId)))notFound();
  try {
    const workspace=await getDocumentWorkspace(Number(taskId));
    return <PageContainer title={`制作简历 · ${workspace.task.targetRole}`}><DocumentEditor workspace={workspace}/></PageContainer>;
  } catch(error) {if(error instanceof DocumentServiceError&&error.code==='NOT_FOUND')notFound();throw error;}
}
