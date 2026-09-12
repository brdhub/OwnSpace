'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createDraftAction, saveDraftAction, saveVersionAction, type DocumentActionState } from './actions';
import type { DocumentWorkspace } from './service';
import type { ResumeDocument } from './model';
import { ResumePreview } from './preview';

const initial: DocumentActionState = { success:false,message:'' };
function move<T>(values:T[],index:number,offset:number) { const result=[...values];const destination=index+offset;if(destination<0||destination>=values.length)return result;[result[index],result[destination]]=[result[destination],result[index]];return result; }

export function DocumentEditor({workspace}:{workspace:DocumentWorkspace}) {
  const router=useRouter();
  const [createState,createAction,creating]=useActionState(createDraftAction,initial);
  useEffect(()=>{if(createState.success)router.refresh();},[createState,router]);
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center gap-4"><Link href="/resumes?tab=jd" className="text-sm text-primary underline">返回岗位选材</Link><Link href="/resumes/versions" className="text-sm text-primary underline">全部历史版本</Link></div>
    {!workspace.draft?<section className="rounded-lg border bg-card p-6"><h2 className="font-semibold">将选中素材组装成简历</h2><p className="my-3 text-sm text-muted-foreground">采用已接受的有效建议，其他条目保留原文。生成草稿不调用 AI。</p><form action={createAction}><input type="hidden" name="taskId" value={workspace.task.id}/><Button disabled={creating}>生成简历草稿</Button></form><p role="status" className="mt-3 text-sm">{createState.message}</p></section>:<DraftEditor key={`${workspace.draft.revision}`} workspace={workspace}/>}
    <section className="rounded-lg border bg-card p-5"><h2 className="mb-3 font-semibold">本岗位的已保存版本</h2>{!workspace.versions.length?<p className="text-sm text-muted-foreground">保存第一个版本后，可在这里查看和导出。</p>:<div className="space-y-2">{workspace.versions.map(version=><Link href={`/resumes/versions/${version.id}`} className="block text-sm text-primary underline" key={version.id}>{version.name} · 第 {version.versionNumber} 版 · {version.createdAt.slice(0,10)}</Link>)}</div>}</section>
  </div>;
}

function DraftEditor({workspace}:{workspace:DocumentWorkspace}) {
  const draft=workspace.draft!;
  const router=useRouter();
  const [document,setDocument]=useState<ResumeDocument>(draft.document);
  const [savedJson,setSavedJson]=useState(JSON.stringify(draft.document));
  const [revision,setRevision]=useState(draft.revision);
  const [versionName,setVersionName]=useState(`${workspace.task.targetRole}简历`);
  const [idempotencyKey,setIdempotencyKey]=useState('');
  const [saveState,saveAction,saving]=useActionState(saveDraftAction,initial);
  const [versionState,versionAction,versioning]=useActionState(saveVersionAction,initial);
  const [createState,createAction,creating]=useActionState(createDraftAction,initial);
  const dirty=JSON.stringify(document)!==savedJson;
  const busy=saving||versioning||creating;
  useEffect(()=>{setIdempotencyKey(crypto.randomUUID());},[]);
  useEffect(()=>{if(saveState.success&&saveState.document&&saveState.revision){setSavedJson(JSON.stringify(saveState.document));setRevision(saveState.revision);setIdempotencyKey(crypto.randomUUID());router.refresh();}},[saveState,router]);
  useEffect(()=>{if(createState.success)router.refresh();},[createState,router]);
  useEffect(()=>{if(versionState.success)router.refresh();},[versionState,router]);
  useEffect(()=>{
    if(!dirty)return;
    const before=(event:BeforeUnloadEvent)=>{event.preventDefault();};
    const click=(event:MouseEvent)=>{const target=event.target as HTMLElement;if(target.closest('a[href]')&&!window.confirm('草稿有未保存的修改，确认离开？')){event.preventDefault();event.stopPropagation();}};
    window.addEventListener('beforeunload',before);window.document.addEventListener('click',click,true);
    return()=>{window.removeEventListener('beforeunload',before);window.document.removeEventListener('click',click,true);};
  },[dirty]);
  function changeItem(sectionId:string,itemId:string,key:string,value:string|boolean){setDocument(current=>({...current,sections:current.sections.map(section=>section.id!==sectionId?section:{...section,items:section.items.map(item=>item.id!==itemId?item:{...item,[key]:value})})}));}
  return <>
    <section className="rounded-lg border bg-card p-4"><div className="flex flex-wrap items-center gap-3">
      <form action={saveAction}><input type="hidden" name="taskId" value={workspace.task.id}/><input type="hidden" name="revision" value={revision}/><input type="hidden" name="contentJson" value={JSON.stringify(document)}/><Button disabled={busy||!dirty}>{saving?'正在保存…':'保存草稿'}</Button></form>
      <span className="text-sm text-muted-foreground">{dirty?'有未保存修改':'草稿已保存'} · 排版与导出不调用 AI</span>
      <form action={createAction} onSubmit={event=>{if(!window.confirm('将用当前岗位选材和已接受建议替换整个草稿，包括手动填写的信息。继续？'))event.preventDefault();}}><input type="hidden" name="taskId" value={workspace.task.id}/><input type="hidden" name="expectedRevision" value={revision}/><Button variant="ghost" size="sm" disabled={busy}>按最新选材重新生成</Button></form>
    </div><p role="status" className="mt-2 text-sm">{saveState.message||createState.message}</p>
    <form action={versionAction} className="mt-4 flex flex-wrap items-end gap-3"><input type="hidden" name="taskId" value={workspace.task.id}/><input type="hidden" name="revision" value={revision}/><input type="hidden" name="idempotencyKey" value={idempotencyKey}/><label className="text-sm">版本名称<Input name="name" value={versionName} onChange={event=>{setVersionName(event.target.value);setIdempotencyKey(crypto.randomUUID());}} maxLength={120}/></label><Button variant="outline" disabled={busy||dirty||!idempotencyKey}>保存为新版本</Button>{versionState.success&&versionState.versionId&&<Link className="text-sm text-primary underline" href={`/resumes/versions/${versionState.versionId}`}>查看并导出此版本 →</Link>}</form><p role="status" className="mt-2 text-sm">{versionState.message}</p><p className="mt-2 text-xs text-muted-foreground">保存版本前请填写姓名及有效联系方式。导出以已保存版本为准，编辑后请先保存草稿。</p>
    </section>
    <div className="grid items-start gap-5 2xl:grid-cols-2">
      <div className="space-y-4">
        <section className="rounded-lg border bg-card p-5"><h2 className="mb-3 font-semibold">基本信息</h2><div className="grid gap-3 sm:grid-cols-2">{([{key:'name',label:'姓名'},{key:'phone',label:'电话'},{key:'email',label:'邮箱'},{key:'city',label:'城市'},{key:'link',label:'个人链接'}] as const).map(field=><label className="text-sm" key={field.key}>{field.label}<Input value={document.profile[field.key]} disabled={busy} onChange={event=>setDocument(current=>({...current,profile:{...current.profile,[field.key]:event.target.value}}))}/></label>)}<label className="text-sm">目标岗位<Input value={document.targetRole} disabled={busy} onChange={event=>setDocument(current=>({...current,targetRole:event.target.value}))}/></label></div></section>
        {document.sections.map((section,sectionIndex)=><section className="rounded-lg border bg-card p-5" key={section.id}><div className="mb-3 flex flex-wrap items-center gap-2"><h2 className="mr-auto font-semibold">{section.title}</h2><Button size="sm" variant="ghost" disabled={busy||sectionIndex===0} onClick={()=>setDocument(current=>({...current,sections:move(current.sections,sectionIndex,-1)}))}>分区上移</Button><Button size="sm" variant="ghost" disabled={busy||sectionIndex===document.sections.length-1} onClick={()=>setDocument(current=>({...current,sections:move(current.sections,sectionIndex,1)}))}>分区下移</Button><label className="text-xs"><input type="checkbox" checked={section.hidden} disabled={busy} onChange={event=>setDocument(current=>({...current,sections:current.sections.map(value=>value.id===section.id?{...value,hidden:event.target.checked}:value)}))}/> 隐藏分区</label></div>
          {!section.items.length&&<p className="text-sm text-muted-foreground">暂无素材，此分区不会出现在成品中。</p>}
          <div className="space-y-4">{section.items.map((item,itemIndex)=><article className="rounded-md border p-3" key={item.id}><div className="mb-3 flex flex-wrap items-center gap-2"><span className="mr-auto text-sm font-medium">{item.title||'未命名条目'}</span><Button variant="ghost" size="sm" disabled={busy||itemIndex===0} onClick={()=>setDocument(current=>({...current,sections:current.sections.map(s=>s.id===section.id?{...s,items:move(s.items,itemIndex,-1)}:s)}))}>上移</Button><Button variant="ghost" size="sm" disabled={busy||itemIndex===section.items.length-1} onClick={()=>setDocument(current=>({...current,sections:current.sections.map(s=>s.id===section.id?{...s,items:move(s.items,itemIndex,1)}:s)}))}>下移</Button><label className="text-xs"><input type="checkbox" disabled={busy} checked={item.hidden} onChange={event=>changeItem(section.id,item.id,'hidden',event.target.checked)}/> 隐藏条目</label></div>
            <div className="grid gap-3 sm:grid-cols-2">{([{key:'title',label:'展示名称'},{key:'organization',label:'组织 / 学校'},{key:'role',label:'角色 / 说明'},{key:'dateRange',label:'起止日期'},{key:'link',label:'相关链接'}] as const).map(field=><label className="text-xs" key={field.key}>{field.label}<Input disabled={busy} value={item[field.key]} onChange={event=>changeItem(section.id,item.id,field.key,event.target.value)}/></label>)}</div><label className="mt-3 block text-xs">正文<Textarea rows={6} disabled={busy} value={item.body} onChange={event=>changeItem(section.id,item.id,'body',event.target.value)}/></label>
          </article>)}</div>
        </section>)}
      </div>
      <section className="min-w-0 rounded-lg border bg-slate-100 p-3"><h2 className="mb-3 text-sm font-medium text-muted-foreground">内容预览 · A4 单栏（长内容自然分页）</h2><ResumePreview document={document}/></section>
    </div>
  </>;
}
