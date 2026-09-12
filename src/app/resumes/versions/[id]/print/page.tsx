import { notFound } from 'next/navigation';
import { getResumeVersion } from '@/features/resumes/documents/queries';
import { DocumentServiceError } from '@/features/resumes/documents/service';
import { ResumePreview } from '@/features/resumes/documents/preview';
import { PrintButton } from '@/features/resumes/documents/print-button';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}){
  const {id}=await params;if(!/^\d+$/.test(id)||!Number.isSafeInteger(Number(id)))notFound();
  try{
    const version=await getResumeVersion(Number(id));
    if (!version) notFound();
    return <div className="resume-print-root mx-auto max-w-4xl p-5"><div className="mb-4 print:hidden"><PrintButton/><p className="mt-2 text-sm text-muted-foreground">在打印对话框选择 A4、另存为 PDF，关闭页眉页脚。长内容会自然分页。</p></div><ResumePreview document={version.document}/></div>;
  }catch(error){if(error instanceof DocumentServiceError&&error.code==='NOT_FOUND')notFound();throw error;}
}
