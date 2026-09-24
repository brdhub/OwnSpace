"use client";

import { ChevronDown, ChevronRight, Edit3, ExternalLink, FilePlus2, FileSearch, Image as ImageIcon, MessagesSquare, Plus, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { applicationStatusMeta, applicationStatuses } from "@/config/application-status";
import type { Application, ApplicationStatusEvent } from "@/db/schema";
import { matchMissingJobCategoriesAction, updateApplicationStatusAction } from "@/features/applications/actions";
import { ApplicationForm } from "@/features/applications/components/application-form";
import { ApplicationDetail } from "@/features/applications/components/application-detail";
import { ApplicationQuickLinks } from "@/features/applications/components/application-quick-links";
import { ApplicationImageExport } from "@/features/applications/components/application-image-export";
import { StatusBadge } from "@/features/applications/components/status-badge";
import { applicationCities, jobCategories, jobCategoryLabels, companySizeMeta, internshipTypeMeta, internshipTypes } from "@/features/applications/constants";
import {
  defaultApplicationFilters,
  type ApplicationInternshipTypeFilter,
  type ApplicationStatusFilter,
  type ResolvedApplicationFilters,
} from "@/features/applications/filters";
import { formatDate, formatDateTime } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { ResumeAssetOption } from "@/features/resumes/types";

type ApplicationsWorkspaceProps = {
  applications: Array<Application & { interviewCount: number; resumeAssetName: string | null }>;
  statusEvents: Record<number, ApplicationStatusEvent[]>;
  resumeAssets: ResumeAssetOption[];
  city?: string;
  jobCategory?: ResolvedApplicationFilters["jobCategory"];
  query?: string;
  status?: ApplicationStatusFilter;
  internshipType?: ApplicationInternshipTypeFilter;
};

function ApplicationStatusSelect({ id, status, error }: { id: number; status: Application["status"]; error?: string }) {
  const { pending } = useFormStatus();
  const statusMeta = applicationStatusMeta[status];

  return (
    <div className="space-y-1">
      <Label className="sr-only" htmlFor={`status-${id}`}>
        更新状态
      </Label>
      <Select
        key={status}
        id={`status-${id}`}
        name="status"
        defaultValue={status}
        disabled={pending}
        aria-busy={pending}
        className={cn("border font-semibold", statusMeta.className)}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {applicationStatuses.map((item) => (
          <option key={item} value={item}>
            {applicationStatusMeta[item].label}
          </option>
        ))}
      </Select>
      {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}
    </div>
  );
}

type ApplicationRow = Application & { interviewCount: number; resumeAssetName: string | null };

function normalizeCompanyName(company: string) {
  return company.trim().toLocaleLowerCase();
}

function groupApplications(applications: ApplicationRow[]) {
  const groups = new Map<string, ApplicationRow[]>();
  for (const application of applications) {
    const key = normalizeCompanyName(application.company);
    const group = groups.get(key) ?? [];
    group.push(application);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([key, group]) => ({ key, applications: group }));
}

function ApplicationCard({
  application,
  statusError,
  onEdit,
  onDetail,
  onStatusUpdate,
}: {
  application: ApplicationRow;
  statusError?: string;
  onEdit: (application: Application) => void;
  onDetail: (applicationId: number) => void;
  onStatusUpdate: (formData: FormData) => Promise<void>;
}) {
  const internshipMeta = internshipTypeMeta[application.internshipType];
  const companySize = companySizeMeta[application.companySize];
  const statusMeta = applicationStatusMeta[application.status];
  const hasJobDescription = Boolean(application.jobDescription.trim());

  return (
    <Card className={cn("relative overflow-hidden border", statusMeta.cardClassName)}>
      <div className={cn("absolute left-0 top-0 h-full", internshipMeta.barClassName, companySize.barWidthClassName)} aria-hidden="true" />
      <CardContent className="grid gap-4 p-4 pl-8 lg:grid-cols-[1.4fr_1fr_180px_100px] lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">{application.company}</h2>
            <StatusBadge status={application.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{application.role}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-md border border-border bg-background px-2 py-1">{internshipMeta.label}</span>
            <span className="rounded-md border border-border bg-background px-2 py-1">{companySize.label}</span>
            <span className="rounded-md border border-border bg-background px-2 py-1">{application.city ?? "城市未填写"}</span>
            <span className="rounded-md border border-border bg-background px-2 py-1">{application.jobCategory ? jobCategoryLabels[application.jobCategory] : "岗位类型未填写"}</span>
            {hasJobDescription ? <span className="rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-primary">已有 JD</span> : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {hasJobDescription ? (
              <>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/resumes?tab=jd&applicationId=${application.id}`}>
                    <FileSearch className="h-3.5 w-3.5" />JD 匹配
                  </Link>
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/ai-hub?applicationId=${application.id}#interview-simulator`}>
                    <MessagesSquare className="h-3.5 w-3.5" />面试模拟
                  </Link>
                </Button>
              </>
            ) : (
              <Button type="button" size="sm" variant="ghost" onClick={() => onEdit(application)}>
                <FilePlus2 className="h-3.5 w-3.5" />补充 JD
              </Button>
            )}
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          <div>渠道：{application.source}</div>
          <div>投递：{formatDate(application.appliedDate)}</div>
          {application.resumeAssetName ? <div className="truncate" title={application.resumeAssetName}>简历：{application.resumeAssetName}</div> : null}
          {application.interviewTime ? <div>面试：{formatDateTime(application.interviewTime)}</div> : null}
          {application.applicationUrl ? (
            <a href={application.applicationUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-primary hover:underline">
              投递网址
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
          <Link href={`/interviews?applicationId=${application.id}`} className="mt-1 inline-flex items-center gap-1 text-primary hover:underline">
            面经：{application.interviewCount}
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
        <form action={onStatusUpdate}>
          <input type="hidden" name="id" value={application.id} />
          <ApplicationStatusSelect id={application.id} status={application.status} error={statusError} />
        </form>
        <div className="flex justify-start gap-2 lg:justify-end">
          <Button type="button" variant="outline" size="icon" onClick={() => onEdit(application)} aria-label="编辑投递记录">
            <Edit3 className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => onDetail(application.id)} aria-label={`查看${application.company}投递详情`} title="查看状态轨迹">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        {application.notes ? <p className="border-t border-border pt-3 text-sm leading-6 text-muted-foreground lg:col-span-4">{application.notes}</p> : null}
      </CardContent>
    </Card>
  );
}

export function ApplicationsWorkspace({
  applications,
  statusEvents,
  resumeAssets,
  city = "all",
  jobCategory = "all",
  query = "",
  status = defaultApplicationFilters.status,
  internshipType = defaultApplicationFilters.internshipType,
}: ApplicationsWorkspaceProps) {
  const [isMatching, startMatching] = useTransition();
  const [matchMessage, setMatchMessage] = useState("");
  const [editing, setEditing] = useState<Application | null>(null);
  const [detailApplicationId, setDetailApplicationId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, startTransition] = useTransition();
  const [statusErrors, setStatusErrors] = useState<Record<number, string>>({});
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  const [optimisticApplications, updateOptimisticStatus] = useOptimistic(
    applications,
    (currentApplications, update: { id: number; status: Application["status"] }) =>
      currentApplications.map((application) =>
        application.id === update.id ? { ...application, status: update.status } : application,
      ),
  );

  useEffect(() => {
    if (!isFiltersOpen) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (!(event.target instanceof Node)) return;
      if (filterButtonRef.current?.contains(event.target) || filterPanelRef.current?.contains(event.target)) return;
      setIsFiltersOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsFiltersOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isFiltersOpen]);

  const modalTitle = useMemo(() => {
    if (editing) {
      return "编辑投递记录";
    }
    if (isCreating) {
      return "新增投递记录";
    }
    return "";
  }, [editing, isCreating]);

  const applicationGroups = useMemo(() => groupApplications(optimisticApplications), [optimisticApplications]);
  const detailApplication = optimisticApplications.find((application) => application.id === detailApplicationId);
  const activeFilterCount = [query.trim() !== "", status !== "all", internshipType !== "all", city !== "all", jobCategory !== "all"].filter(Boolean).length;

  function updateFilter(next: Partial<ResolvedApplicationFilters>) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.query !== undefined) {
      const query = next.query.trim();
      if (query) {
        params.set("query", query);
      } else {
        params.delete("query");
      }
    }
    if (next.status !== undefined) {
      if (next.status) {
        params.set("status", next.status);
      } else {
        params.delete("status");
      }
    }
    if (next.internshipType !== undefined) {
      if (next.internshipType) {
        params.set("internshipType", next.internshipType);
      } else {
        params.delete("internshipType");
      }
    }

    if (next.city !== undefined) params.set("city", next.city);
    if (next.jobCategory !== undefined) params.set("jobCategory", next.jobCategory);
    if (params.toString() === searchParams.toString()) {
      return;
    }

    const target = params.size > 0 ? `${pathname}?${params.toString()}` : pathname;
    startTransition(() => router.replace(target));
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const queryValue = new FormData(event.currentTarget).get("query")?.toString() ?? "";
    updateFilter({ query: queryValue });
  }

  async function handleStatusUpdate(formData: FormData) {
    const id = Number(formData.get("id"));
    const statusValue = formData.get("status");
    const nextStatus = applicationStatuses.find((item) => item === statusValue);

    if (!Number.isInteger(id) || !nextStatus) {
      return;
    }

    setStatusErrors((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    updateOptimisticStatus({ id, status: nextStatus });

    try {
      const result = await updateApplicationStatusAction(formData);
      if (!result.success) {
        setStatusErrors((current) => ({ ...current, [id]: result.message ?? "状态更新失败，请重试。" }));
      }
    } catch {
      setStatusErrors((current) => ({ ...current, [id]: "状态更新失败，请重试。" }));
    }
  }

  function closeForm() {
    setEditing(null);
    setIsCreating(false);
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-col items-center gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-end">
            <Button ref={filterButtonRef} type="button" variant="outline" aria-controls="application-filters" aria-expanded={isFiltersOpen} onClick={() => setIsFiltersOpen((value) => !value)}>
              <SlidersHorizontal className="h-4 w-4" />
              筛选
              {activeFilterCount > 0 ? <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">{activeFilterCount}</span> : null}
              <ChevronDown className={cn("h-4 w-4 transition-transform", isFiltersOpen && "rotate-180")} />
            </Button>
            <Button type="button" onClick={() => setIsExportOpen((value) => !value)} className="bg-teal-700 text-white hover:bg-teal-800">
              <ImageIcon className="h-4 w-4" />
              {isExportOpen ? "收起导出" : "投递导出"}
            </Button>
          </div>
          <Button
            type="button"
            aria-label="新增投递"
            title="新增投递"
            onClick={() => setIsCreating(true)}
            className="group h-14 w-14 gap-0 overflow-hidden rounded-full p-0 transition-[width] duration-200 hover:w-40 hover:gap-2 focus-visible:w-40 focus-visible:gap-2 motion-reduce:transition-none"
          >
            <Plus className="h-7 w-7 shrink-0" />
            <span className="max-w-0 overflow-hidden opacity-0 transition-[max-width,opacity] duration-200 group-hover:max-w-24 group-hover:opacity-100 group-focus-visible:max-w-24 group-focus-visible:opacity-100 motion-reduce:transition-none">新增投递</span>
          </Button>
          <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <Button type="button" variant="outline" disabled={isMatching} onClick={() => startMatching(async () => {
              setMatchMessage("");
              try {
                const result = await matchMissingJobCategoriesAction({ scope: "all_missing" });
                setMatchMessage(result.message ?? "匹配已完成。");
                if (result.success) router.refresh();
              } catch { setMatchMessage("匹配未完成，请重试。"); }
            })}>{isMatching ? "匹配中..." : "匹配缺失类型"}</Button>
            <ApplicationQuickLinks applications={optimisticApplications} />
          </div>
        </div>
        {matchMessage ? <p className="mt-2 text-center text-sm text-muted-foreground" role="status">{matchMessage}</p> : null}
      </div>
      {isFiltersOpen ? <div ref={filterPanelRef} id="application-filters" className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <form onSubmit={handleSearch} className="flex-1 space-y-2">
          <Label htmlFor="application-search">搜索</Label>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="application-search"
                name="query"
                defaultValue={query}
                className="pl-9"
                placeholder="按公司或岗位搜索"
              />
            </div>
            <Button type="submit" variant="outline" disabled={isNavigating} className="min-w-24">
              <Search className="h-4 w-4" />
              {isNavigating ? "搜索中..." : "搜索"}
            </Button>
          </div>
        </form>
        <div className="w-full space-y-2 sm:w-56">
          <Label htmlFor="status-filter">状态筛选</Label>
          <Select
            id="status-filter"
            value={status}
            disabled={isNavigating}
            onChange={(event) => {
              if (event.target.value !== status) {
                updateFilter({ status: event.target.value as ApplicationStatusFilter });
              }
            }}
          >
            <option value="active">所有未结束</option>
            <option value="all">全部状态</option>
            {applicationStatuses.map((item) => (
              <option key={item} value={item}>
                {applicationStatusMeta[item].label}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-full space-y-2 sm:w-40">
          <Label htmlFor="internship-type-filter">招聘类型</Label>
          <Select
            id="internship-type-filter"
            value={internshipType}
            disabled={isNavigating}
            onChange={(event) => {
              if (event.target.value !== internshipType) {
                updateFilter({ internshipType: event.target.value as ApplicationInternshipTypeFilter });
              }
            }}
          >
            <option value="all">全部类型</option>
            {internshipTypes.map((item) => (
              <option key={item} value={item}>
                {internshipTypeMeta[item].label}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-full space-y-2 sm:w-36">
          <Label htmlFor="city-filter">城市</Label>
          <Select id="city-filter" value={city} disabled={isNavigating} onChange={(event) => updateFilter({ city: event.target.value })}>
            <option value="all">全部城市</option>
            {applicationCities.map((item) => <option key={item} value={item}>{item}</option>)}
            <option value="other">其他城市</option>
            <option value="missing">未填写</option>
          </Select>
        </div>
        <div className="w-full space-y-2 sm:w-44">
          <Label htmlFor="job-category-filter">岗位类型</Label>
          <Select id="job-category-filter" value={jobCategory} disabled={isNavigating} onChange={(event) => updateFilter({ jobCategory: event.target.value as ResolvedApplicationFilters["jobCategory"] })}>
            <option value="all">全部岗位类型</option>
            {jobCategories.map((item) => <option key={item} value={item}>{jobCategoryLabels[item]}</option>)}
            <option value="missing">未填写</option>
          </Select>
        </div>
      </div> : null}
      {isExportOpen ? <ApplicationImageExport applications={optimisticApplications} onClose={() => setIsExportOpen(false)} /> : null}

      {optimisticApplications.length === 0 ? (
        <EmptyState title="当前筛选下没有投递记录" actionLabel="新增投递" onAction={() => setIsCreating(true)} />
      ) : (
        <div className="space-y-3">
          {applicationGroups.map((group) => {
            const [topApplication, ...otherApplications] = group.applications;
            const expanded = expandedCompanies.has(group.key);

            return (
              <div key={group.key} className="space-y-2">
                <ApplicationCard
                  application={topApplication}
                  statusError={statusErrors[topApplication.id]}
                  onEdit={setEditing}
                  onDetail={setDetailApplicationId}
                  onStatusUpdate={handleStatusUpdate}
                />
                {otherApplications.length ? (
                  <>
                    {expanded
                      ? otherApplications.map((application) => (
                        <ApplicationCard
                          key={application.id}
                          application={application}
                          statusError={statusErrors[application.id]}
                          onEdit={setEditing}
                          onDetail={setDetailApplicationId}
                          onStatusUpdate={handleStatusUpdate}
                        />
                      ))
                      : null}
                    <button
                      type="button"
                      className="w-full rounded-md px-3 py-2 text-left text-sm text-primary hover:bg-muted"
                      aria-expanded={expanded}
                      onClick={() => {
                        setExpandedCompanies((current) => {
                          const next = new Set(current);
                          if (next.has(group.key)) next.delete(group.key);
                          else next.add(group.key);
                          return next;
                        });
                      }}
                    >
                      {expanded ? "收起同公司其余投递 ▴" : `同公司另有 ${otherApplications.length} 条投递 ▾`}
                    </button>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {editing || isCreating ? (
        <div role="dialog" aria-modal="true" aria-labelledby="application-form-title" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-3 py-4 backdrop-blur-[2px] sm:px-6 sm:py-8">
          <ApplicationForm application={editing ?? undefined} resumeAssets={resumeAssets} onDone={closeForm} modalTitle={modalTitle} modalSubtitle={editing ? `${editing.company} · ${editing.role}` : "记下新的机会和投递进度"} />
        </div>
      ) : null}
      {detailApplication ? <ApplicationDetail application={detailApplication} events={statusEvents[detailApplication.id] ?? []} onClose={() => setDetailApplicationId(null)} /> : null}
    </div>
  );
}

