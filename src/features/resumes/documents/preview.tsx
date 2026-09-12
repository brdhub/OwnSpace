import type { ResumeDocument } from './model';

function LinkText({value}:{value:string}) {
  const safe = /^https?:\/\//i.test(value);
  return safe ? <a href={value} target="_blank" rel="noreferrer" className="break-all underline">{value}</a> : <span className="break-all">{value}</span>;
}

export function ResumePreview({document}:{document:ResumeDocument}) {
  return <article className="resume-paper bg-white text-slate-900">
    <header className="mb-5 text-center"><h1 className="text-2xl font-bold">{document.profile.name || '姓名待补充'}</h1><p className="mt-2 text-sm">{[document.targetRole,document.profile.phone,document.profile.email,document.profile.city].filter(Boolean).join(' · ')}</p>{document.profile.link&&<p className="mt-1 text-xs"><LinkText value={document.profile.link}/></p>}</header>
    {document.sections.filter(section=>!section.hidden&&section.items.some(item=>!item.hidden)).map(section=><section key={section.id} className="mb-5"><h2 className="resume-section-heading mb-2 border-b border-slate-300 pb-1 text-base font-bold">{section.title}</h2>{section.items.filter(item=>!item.hidden).map(item=><div key={item.id} className="mb-3"><h3 className="resume-item-heading text-sm font-semibold">{[item.title,item.organization!==item.title?item.organization:'',item.role,item.dateRange].filter(Boolean).join(' · ')}</h3>{item.link&&<p className="text-xs"><LinkText value={item.link}/></p>}<div className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{item.body}</div></div>)}</section>)}
  </article>;
}
