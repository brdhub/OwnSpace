"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { applicationStatusMeta } from "@/config/application-status";
import { buildDashboardApplicationStatistics, type StatisticsRow } from "@/features/applications/application-statistics";
import { internshipTypeMeta, type InternshipType } from "@/features/applications/constants";
import { buildApplicationFiltersHref } from "@/features/applications/filters";
import { cn } from "@/lib/utils";

type DistributionRow = { key: string; label: string; count: number; color: string; href: string };
type StatisticsType = InternshipType | "all";
const statisticsTypes: StatisticsType[] = ["autumn", "summer", "daily", "spring", "all"];

function Distribution({ title, rows, total, selectedKey }: { title: string; rows: DistributionRow[]; total: number; selectedKey?: string }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <span className="text-xs text-muted-foreground">点击查看记录</span>
      </div>
      <div className="space-y-3">
        {rows.map((row, index) => (
          <Link key={row.key} href={row.href} className={cn("group block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring", selectedKey === row.key && "-mx-2 bg-accent/50 px-2 py-1")} style={{ animationDelay: `${index * 45}ms` }}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-foreground transition-colors group-hover:text-primary">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} />
                {row.label}
              </span>
              <span className="tabular-nums text-muted-foreground">{row.count}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="application-stats-fill h-full origin-left rounded-full transition-[filter] duration-200 group-hover:brightness-110" style={{ width: `${total ? row.count / total * 100 : 0}%`, backgroundColor: row.color, animationDelay: `${index * 55}ms` }} />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function ApplicationAchievement({ rows, today }: { rows: StatisticsRow[]; today: string }) {
  const [selectedType, setSelectedType] = useState<StatisticsType>("all");
  const selectedRows = selectedType === "all" ? rows : rows.filter((row) => row.internshipType === selectedType);
  const all = buildDashboardApplicationStatistics(selectedRows, today, "all");
  const recent = buildDashboardApplicationStatistics(selectedRows, today, "recent30");
  const overall = buildDashboardApplicationStatistics(rows, today, "all");
  const selectedLabel = selectedType === "all" ? "全部类型" : internshipTypeMeta[selectedType].label;
  const active = all.statusCounts.filter((item) => item.key !== "closed").reduce((sum, item) => sum + item.count, 0);
  const offer = all.statusCounts.find((item) => item.key === "offer")?.count ?? 0;
  const max = Math.max(1, ...all.trend.map((point) => point.count));
  const statusRows = all.statusCounts.map((item) => ({
    key: item.key,
    label: applicationStatusMeta[item.key].label,
    count: item.count,
    color: applicationStatusMeta[item.key].canvasText,
    href: buildApplicationFiltersHref({ status: item.key, internshipType: selectedType }),
  }));
  const typeRows = overall.typeCounts.map((item) => ({
    key: item.key,
    label: internshipTypeMeta[item.key].label,
    count: item.count,
    color: internshipTypeMeta[item.key].canvasColor,
    href: buildApplicationFiltersHref({ status: "all", internshipType: item.key }),
  }));

  return (
    <section aria-labelledby="application-achievement-title" className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-[#315956] bg-[#102c2b] text-white shadow-[0_18px_50px_-25px_rgba(9,57,53,0.6)]">
        <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-teal-300/15 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-36 left-1/3 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" aria-hidden="true" />
        <div className="relative grid gap-7 p-6 sm:p-7 lg:grid-cols-[minmax(16rem,0.9fr)_minmax(0,1.1fr)] lg:items-end">
          <div className="application-stats-enter">
            <div role="group" aria-label="筛选投递统计的招聘类型" className="mb-6 flex max-w-full gap-1 overflow-x-auto rounded-full border border-white/15 bg-white/[0.06] p-1">
              {statisticsTypes.map((type) => (
                <button key={type} type="button" aria-pressed={selectedType === type} onClick={() => setSelectedType(type)} className={cn("shrink-0 rounded-full px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white", selectedType === type ? "bg-teal-200 text-[#12332d] shadow-sm" : "text-teal-100/80 hover:bg-white/10 hover:text-white")}>
                  {type === "all" ? "全部" : internshipTypeMeta[type].label}
                </button>
              ))}
            </div>
            <p className="text-xs font-semibold tracking-[0.18em] text-teal-200/90">YOUR PROGRESS</p>
            <h2 id="application-achievement-title" className="mt-3 text-xl font-semibold tracking-tight">投递统计</h2>
            <p className="mt-4 text-xs text-teal-100/70">{selectedType === "all" ? "累计投递记录" : `累计${selectedLabel}记录`}</p>
            <p key={selectedType} className="application-stats-enter mt-1 text-6xl font-semibold leading-none tracking-tight tabular-nums sm:text-7xl">{all.total}<span className="ml-2 text-base font-normal tracking-normal text-teal-100/70">条</span></p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">近 30 天 <strong className="ml-1 text-sm tabular-nums text-white">{recent.total}</strong></span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">正在推进 <strong className="ml-1 text-sm tabular-nums text-white">{active}</strong></span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">Offer <strong className="ml-1 text-sm tabular-nums text-white">{offer}</strong></span>
            </div>
          </div>
          <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">投递轨迹</p>
                <p className="mt-0.5 text-xs text-teal-100/60">{selectedLabel} · 按日期汇总 · 最多显示近 12 个月</p>
              </div>
              <Link href={buildApplicationFiltersHref({ status: "all", internshipType: selectedType })} className="rounded-full border border-white/15 p-2 text-teal-100 transition hover:-translate-y-0.5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label={`查看${selectedLabel}投递记录`}><ArrowUpRight className="h-4 w-4" /></Link>
            </div>
            {all.total ? (
              <div key={selectedType} className="flex h-40 items-end gap-1.5 border-b border-white/15" role="img" aria-label={`${selectedLabel}投递数量趋势：${all.trend.map((point) => `${point.label} ${point.count} 条`).join("，")}`}>
                {all.trend.map((point, index) => (
                  <div key={point.label} className="group relative flex h-full min-w-0 flex-1 items-end justify-center" title={`${point.label} · ${point.count} 条`}>
                    <div className="application-stats-bar w-full max-w-9 origin-bottom rounded-t-md bg-gradient-to-t from-teal-600 to-emerald-300 transition-[filter] duration-200 group-hover:brightness-125" style={{ height: `${point.count ? Math.max(6, point.count / max * 100) : 2}%`, opacity: point.count ? 1 : 0.18, animationDelay: `${Math.min(index * 45, 500)}ms` }} />
                    {(all.trend.length <= 12 || index % 5 === 0) ? <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-teal-100/55">{point.label.length === 7 ? point.label.slice(5) : point.label}</span> : null}
                  </div>
                ))}
              </div>
            ) : <p className="grid h-40 place-items-center text-sm text-teal-100/70">{selectedType === "all" ? "记录第一条投递后，这里会出现你的轨迹。" : `暂无${selectedLabel}投递记录。`}</p>}
            <div className="h-5" aria-hidden="true" />
          </div>
        </div>
      </div>
      {overall.total ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Distribution title={`${selectedLabel} · 投递进度`} rows={statusRows} total={all.total} />
          <Distribution title="招聘类型 · 全部记录" rows={typeRows} total={overall.total} selectedKey={selectedType} />
        </div>
      ) : null}
    </section>
  );
}
