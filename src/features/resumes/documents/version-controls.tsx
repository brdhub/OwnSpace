'use client';
import { useActionState,useEffect,useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { copyVersionAction } from './actions';

export function VersionControls({versionId,taskId,targets}:{versionId:number;taskId:number|null;targets:Array<{id:number;targetRole:string;revision:number|null}>}) {
  const [target,setTarget]=useState(taskId??targets[0]?.id??0);
  const [state,action,pending]=useActionState(copyVersionAction,{success:false,message:''});
  const router=useRouter();
  useEffect(()=>{if(state.success&&state.taskId)router.push(`/resumes/documents/${state.taskId}`);},[state,router]);
  const selected=targets.find(item=>item.id===target);
  return <div className="space-y-4 print:hidden"><div className="flex flex-wrap gap-4 text-sm"><a className="text-primary underline" href={`/resumes/versions/${versionId}/download`}>下载 Word（DOCX）</a><Link className="text-primary underline" href={`/resumes/versions/${versionId}/print`} target="_blank">打印 / 另存 PDF</Link><Link className="text-primary underline" href="/resumes/versions">全部版本</Link></div><form action={action} onSubmit={event=>{if(selected?.revision&&!window.confirm('目标岗位已有草稿，复制将替换它。确认继续？'))event.preventDefault();}} className="flex flex-wrap items-end gap-3"><input type="hidden" name="versionId" value={versionId}/><input type="hidden" name="targetTaskId" value={target}/>{selected?.revision&&<input type="hidden" name="expectedRevision" value={selected.revision}/>}<label className="text-sm">复制到岗位草稿<Select value={target} onChange={event=>setTarget(Number(event.target.value))}>{!targets.length&&<option value={0}>请先新建岗位</option>}{targets.map(item=><option key={item.id} value={item.id}>{item.targetRole}</option>)}</Select></label><Button variant="outline" disabled={pending||!selected}>复制为草稿</Button></form><p role="status" className="text-sm">{state.message}</p>{!targets.length&&<Link className="text-sm text-primary underline" href="/resumes?tab=jd">新建岗位后复制</Link>}</div>;
}
