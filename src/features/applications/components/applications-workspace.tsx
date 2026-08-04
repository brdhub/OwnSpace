"use client";

import { Edit3, ExternalLink, Image as ImageIcon, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useMemo, useOptimistic, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { applicationStatusMeta, applicationStatuses } from "@/config/application-status";
import type { Application } from "@/db/schema";
import { deleteApplicationAction, updateApplicationStatusAction } from "@/features/applications/actions";
import { ApplicationForm } from "@/features/applications/components/application-form";
import { ApplicationsNavigation } from "@/features/applications/components/applications-navigation";
import { ApplicationImageExport } from "@/features/applications/components/application-image-export";
import { StatusBadge } from "@/features/applications/components/status-badge";
import { companySizeMeta, internshipTypeMeta, internshipTypes } from "@/features/applications/constants";
import { formatDate, formatDateTime } from "@/lib/date";
import { cn } from "@/lib/utils";

type ApplicationsWorkspaceProps = {
  applications: Array<Application & { interviewCount: number }>;
  query?: string;
  status?: string;
  internshipType?: string;
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

export function ApplicationsWorkspace({
  applications,
  query = "",
  status = "",
  internshipType = "",
}: ApplicationsWorkspaceProps) {
  const [editing, setEditing] = useState<Application | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, startTransition] = useTransition();
  const [statusErrors, setStatusErrors] = useState<Record<number, string>>({});
  const [optimisticApplications, updateOptimisticStatus] = useOptimistic(
    applications,
    (currentApplications, update: { id: number; status: Application["status"] }) =>
      currentApplications.map((application) =>
        application.id === update.id ? { ...application, status: update.status } : application,
      ),
  );

  const modalTitle = useMemo(() => {
    if (editing) {
      return "编辑投递记录";
    }
    if (isCreating) {
      return "新增投递记录";
    }
    return "";
  }, [editing, isCreating]);

  function updateFilter(next: { query?: string; status?: string; internshipType?: string }) {
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
      <ApplicationsNavigation />
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-end">
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
                updateFilter({ status: event.target.value });
              }
            }}
          >
            <option value="">全部状态</option>
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
                updateFilter({ internshipType: event.target.value });
              }
            }}
          >
            <option value="">全部类型</option>
            {internshipTypes.map((item) => (
              <option key={item} value={item}>
                {internshipTypeMeta[item].label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" onClick={() => setIsCreating(true)}>
            <Plus className="h-4 w-4" />
            新增投递
          </Button>
          <Button type="button" onClick={() => setIsExportOpen((value) => !value)} className="bg-teal-700 text-white hover:bg-teal-800">
            <ImageIcon className="h-4 w-4" />
            {isExportOpen ? "收起导出" : "投递导出"}
          </Button>
        </div>
      </div>

      {isExportOpen ? <ApplicationImageExport applications={optimisticApplications} onClose={() => setIsExportOpen(false)} /> : null}

      {optimisticApplications.length === 0 ? (
        <EmptyState title="还没有投递记录" actionLabel="新增投递" onAction={() => setIsCreating(true)} />
      ) : (
        <div className="space-y-3">
          {optimisticApplications.map((application) => {
            const internshipMeta = internshipTypeMeta[application.internshipType];
            const companySize = companySizeMeta[application.companySize];
            const statusMeta = applicationStatusMeta[application.status];

            return (
              <Card key={application.id} className={cn("relative overflow-hidden border", statusMeta.cardClassName)}>
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
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <div>渠道：{application.source}</div>
                    <div>投递：{formatDate(application.appliedDate)}</div>
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
                  <form action={handleStatusUpdate}>
                    <input type="hidden" name="id" value={application.id} />
                    <ApplicationStatusSelect id={application.id} status={application.status} error={statusErrors[application.id]} />
                  </form>
                  <div className="flex justify-start gap-2 lg:justify-end">
                    <Button type="button" variant="outline" size="icon" onClick={() => setEditing(application)} aria-label="编辑投递记录">
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <form action={deleteApplicationAction}>
                      <input type="hidden" name="id" value={application.id} />
                      <Button type="submit" variant="ghost" size="icon" aria-label="删除投递记录">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </form>
                  </div>
                  {application.notes ? <p className="border-t border-border pt-3 text-sm leading-6 text-muted-foreground lg:col-span-4">{application.notes}</p> : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {editing || isCreating ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/20 px-4 py-8">
          <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-5 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">{modalTitle}</h2>
            <ApplicationForm application={editing ?? undefined} onDone={closeForm} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

