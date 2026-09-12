import { notFound } from 'next/navigation';
import { PageContainer } from '@/components/layout/page-container';
import { getResumeVersion } from '@/features/resumes/documents/queries';
import { DocumentServiceError } from '@/features/resumes/documents/service';
import { ResumePreview } from '@/features/resumes/documents/preview';
import { VersionControls } from '@/features/resumes/documents/version-controls';
import { getVersionCopyTargets } from '@/features/resumes/documents/copy-targets';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}){
  const {id}=await params;if(!/^\d+$/.test(id)||!Number.isSafeInteger(Number(id)))notFound();
  try{
    const version=await getResumeVersion(Number(id));
    if (!version) notFound();
    return <PageContainer title={version.name}><p className="mb-4 text-sm text-muted-foreground">第 {version.versionNumber} 版 · {version.createdAt.slice(0,10)} · 已保存快照，导出不会读取当前草稿。</p><VersionControls versionId={version.id} taskId={version.taskId} targets={await getVersionCopyTargets()}/><div className="mt-5 max-w-4xl rounded-lg border bg-slate-100 p-3"><ResumePreview document={version.document}/></div></PageContainer>;
  }catch(error){if(error instanceof DocumentServiceError&&error.code==='NOT_FOUND')notFound();throw error;}
}
