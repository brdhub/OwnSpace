import Link from 'next/link';
import { PageContainer } from '@/components/layout/page-container';
import { listResumeVersions } from '@/features/resumes/documents/queries';
export const dynamic='force-dynamic';
export default async function Page(){
  const versions=await listResumeVersions();
  return <PageContainer title="已保存的简历"><Link className="text-sm text-primary underline" href="/resumes?tab=jd">返回岗位选材</Link><div className="mt-5 space-y-3">{versions.length?versions.map(version=><Link key={version.id} href={`/resumes/versions/${version.id}`} className="block rounded-lg border bg-card p-5"><h2 className="font-semibold">{version.name} · 第 {version.versionNumber} 版</h2><p className="mt-1 text-sm text-muted-foreground">{version.document.targetRole} · {version.createdAt.slice(0,10)}{version.taskId===null?' · 原任务已删除，版本仍保留':''}</p></Link>):<p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">还没有保存的版本。完成草稿后，点击“保存为新版本”即可在这里查看与导出。</p>}</div></PageContainer>;
}
