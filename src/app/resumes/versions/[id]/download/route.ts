import { getResumeVersion } from '@/features/resumes/documents/queries';
import { DocumentServiceError } from '@/features/resumes/documents/service';
import { generateResumeDocx } from '@/features/resumes/documents/docx';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;if(!/^\d+$/.test(id)||!Number.isSafeInteger(Number(id)))return new Response('未找到版本',{status:404});
  try{
    const version=await getResumeVersion(Number(id));
    if (!version) return new Response('未找到版本',{status:404});
    const buffer=await generateResumeDocx(version.document);
    const name=`${version.name.replace(/[\\/:*?"<>|\r\n]/g,'-')}.docx`;
    return new Response(new Uint8Array(buffer),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','Content-Disposition':`attachment; filename="resume-${id}.docx"; filename*=UTF-8''${encodeURIComponent(name)}`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }catch(error){if(error instanceof DocumentServiceError&&error.code==='NOT_FOUND')return new Response('未找到版本',{status:404});return new Response('导出失败，请返回版本页面重试。',{status:500});}
}
