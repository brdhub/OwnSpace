"use client";

import { ArrowUpRight, Clock3, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { applicationStatusMeta, applicationStatuses, type ApplicationStatus } from "@/config/application-status";
import type { Application, ApplicationStatusEvent } from "@/db/schema";
import { addHistoricalStatusAction } from "@/features/applications/actions";
import { StatusBadge } from "@/features/applications/components/status-badge";
import { formatDate, formatDateTime, toDateInputValue } from "@/lib/date";

type ApplicationDetailProps = {
  application: Application;
  events: ApplicationStatusEvent[];
  onClose: () => void;
};

export function ApplicationDetail({ application, events, onClose }: ApplicationDetailProps) {
  const router = useRouter();
  const [isAddingHistory, setIsAddingHistory] = useState(false);
  const [historicalDate, setHistoricalDate] = useState("");
  const [historicalStatus, setHistoricalStatus] = useState<ApplicationStatus | "">("");
  const [isSavingHistory, setIsSavingHistory] = useState(false);
  const [historyMessage, setHistoryMessage] = useState("");

  async function handleAddHistory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSavingHistory) return;
    setIsSavingHistory(true);
    setHistoryMessage("");
    try {
      const result = await addHistoricalStatusAction({ id: application.id, date: historicalDate, status: historicalStatus });
      if (!result.success) {
        setHistoryMessage(result.message ?? "补录失败，请重试。");
        return;
      }
      setHistoricalDate("");
      setHistoricalStatus("");
      setIsAddingHistory(false);
      setHistoryMessage("历史状态已补录");
      router.refresh();
    } catch {
      setHistoryMessage("补录失败，请重试。");
    } finally {
      setIsSavingHistory(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]" aria-label="关闭投递详情" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-labelledby="application-detail-title" className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col overflow-hidden border-l border-teal-900/10 bg-white shadow-2xl motion-safe:animate-in motion-safe:slide-in-from-right">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#183e3b] via-[#235d56] to-[#176f68] px-7 pb-8 pt-7 text-white">
          <div className="absolute -right-14 -top-20 h-56 w-56 rounded-full border border-white/15" aria-hidden="true" />
          <div className="absolute -right-2 -top-7 h-36 w-36 rounded-full border border-white/15" aria-hidden="true" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.24em] text-teal-100/80">APPLICATION JOURNEY</p>
              <h2 id="application-detail-title" className="mt-3 text-2xl font-semibold tracking-tight">{application.company}</h2>
              <p className="mt-1 text-sm text-teal-50/80">{application.role}</p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="关闭详情" className="shrink-0 rounded-full text-white hover:bg-white/15 hover:text-white"><X className="h-5 w-5" /></Button>
          </div>
          <div className="relative mt-6 flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15"><Clock3 className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1"><p className="text-xs text-teal-50/70">当前进度</p><p className="font-semibold">{applicationStatusMeta[application.status].label}</p></div>
            <span className="text-xs tabular-nums text-teal-50/70">{events.length} 个节点</span>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-7">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500">投递日期</p><p className="mt-1 font-medium">{formatDate(application.appliedDate)}</p></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500">投递渠道</p><p className="mt-1 truncate font-medium" title={application.source}>{application.source}</p></div>
          </div>
          <div className="mt-8 flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">STATUS HISTORY</p><h3 className="mt-1 text-lg font-semibold">状态轨迹</h3></div><StatusBadge status={application.status} /></div>
          <Button type="button" variant="outline" size="sm" aria-expanded={isAddingHistory} onClick={() => { setIsAddingHistory((value) => !value); setHistoryMessage(""); }} className="mt-4 border-teal-200 text-teal-800 hover:bg-teal-50"><Plus className="h-4 w-4" />补录过去状态</Button>
          {isAddingHistory ? <form onSubmit={handleAddHistory} className="mt-3 space-y-3 rounded-xl border border-teal-100 bg-teal-50/50 p-4">
            <p className="text-xs text-slate-600">选择到达该状态的日期。补录不会改变当前状态。</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="historical-status-date">日期</Label><Input id="historical-status-date" type="date" required max={toDateInputValue()} value={historicalDate} onChange={(event) => setHistoricalDate(event.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="historical-status-value">状态</Label><Select id="historical-status-value" required value={historicalStatus} onChange={(event) => setHistoricalStatus(event.target.value as ApplicationStatus | "")}><option value="">请选择状态</option>{applicationStatuses.map((status) => <option key={status} value={status}>{applicationStatusMeta[status].label}</option>)}</Select></div>
            </div>
            {historyMessage ? <p role="alert" className="text-sm text-rose-700">{historyMessage}</p> : null}
            <div className="flex justify-end"><Button type="submit" size="sm" disabled={isSavingHistory}>{isSavingHistory ? "补录中..." : "保存轨迹"}</Button></div>
          </form> : null}
          {!isAddingHistory && historyMessage ? <p role="status" className="mt-2 text-sm text-teal-700">{historyMessage}</p> : null}
          {events.length ? <ol className="relative ml-2 mt-6 border-l border-teal-200">
            {events.map((event, index) => <li key={event.id} className="relative pb-7 pl-7 last:pb-0">
              <span className={`absolute -left-[7px] top-1 h-3.5 w-3.5 rounded-full border-[3px] border-white ${index === 0 ? "bg-teal-600 ring-2 ring-teal-100" : "bg-teal-300"}`} aria-hidden="true" />
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-slate-900">{applicationStatusMeta[event.toStatus].label}</p><time className="text-xs tabular-nums text-slate-500">{event.kind === "manual" ? formatDate(event.occurredAt) : formatDateTime(event.occurredAt)}</time></div>
                <p className="mt-1 text-sm text-slate-500">{event.kind === "changed" && event.fromStatus ? `从「${applicationStatusMeta[event.fromStatus].label}」转入` : event.kind === "baseline" ? "开始记录时的状态" : event.kind === "manual" ? "手动补录" : "创建投递记录时的状态"}</p>
              </div>
            </li>)}
          </ol> : <p className="mt-5 text-sm text-slate-500">暂无状态轨迹。</p>}
          {application.notes ? <div className="mt-8 rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">备注</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{application.notes}</p></div> : null}
          {application.applicationUrl ? <a href={application.applicationUrl} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:underline">打开投递网址 <ArrowUpRight className="h-4 w-4" /></a> : null}
        </div>
      </aside>
    </div>
  );
}
