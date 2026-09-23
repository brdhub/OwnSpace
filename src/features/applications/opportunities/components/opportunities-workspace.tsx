"use client";

import { ExternalLink, Heart, RefreshCw, Search, Send } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { applicationStatusMeta } from "@/config/application-status";
import { ApplicationForm } from "@/features/applications/components/application-form";
import {
  favoriteOpportunityAction,
  syncRecruitmentOpportunitiesAction,
  type OpportunityActionState,
} from "@/features/applications/opportunities/actions";
import type { RecruitmentOpportunityListItem } from "@/features/applications/opportunities/queries";
import { buildApplicationDraft } from "@/features/applications/opportunities/repository";
import type { ResumeAssetOption } from "@/features/resumes/types";
import { formatDate, formatDateTime, toDateInputValue } from "@/lib/date";

type OpportunitiesWorkspaceProps = {
  opportunities: RecruitmentOpportunityListItem[];
  companyTypes: string[];
  cities: string[];
  lastSyncedAt: string | null;
  query: string;
  companyType: string;
  city: string;
  unrestrictedMajor: string;
  resumeAssets: ResumeAssetOption[];
};

const initialActionState: OpportunityActionState = { success: false };

function SyncButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <RefreshCw className={pending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
      {pending ? "同步中..." : "同步飞书"}
    </Button>
  );
}

function FavoriteButton({ opportunityId, saved }: { opportunityId: number; saved: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(favoriteOpportunityAction, initialActionState);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <Button type="submit" variant="outline" size="sm" disabled={saved || pending}>
        <Heart className="h-4 w-4" />
        {saved || state.success ? "已在计划中" : pending ? "收藏中..." : "收藏"}
      </Button>
      {state.message && !state.success ? <p className="max-w-32 text-xs text-destructive">{state.message}</p> : null}
    </form>
  );
}

export function OpportunitiesWorkspace({
  opportunities,
  companyTypes,
  cities,
  lastSyncedAt,
  query,
  companyType,
  city,
  unrestrictedMajor,
  resumeAssets,
}: OpportunitiesWorkspaceProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isNavigating, startTransition] = useTransition();
  const [syncState, syncAction] = useActionState(syncRecruitmentOpportunitiesAction, initialActionState);
  const [applying, setApplying] = useState<RecruitmentOpportunityListItem | null>(null);

  function updateFilter(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, rawValue] of Object.entries(next)) {
      const value = rawValue.trim();
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const target = params.size ? `${pathname}?${params.toString()}` : pathname;
    startTransition(() => router.replace(target));
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateFilter({ query: new FormData(event.currentTarget).get("query")?.toString() ?? "" });
  }

  const effectiveSyncedAt = syncState.syncedAt ?? lastSyncedAt;

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <form onSubmit={submitSearch} className="flex-1 space-y-2">
            <Label htmlFor="opportunity-search">搜索公司或岗位</Label>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="opportunity-search" name="query" defaultValue={query} placeholder="例如：后端开发" className="pl-9" />
              </div>
              <Button type="submit" variant="outline" disabled={isNavigating}>搜索</Button>
            </div>
          </form>
          <div className="grid gap-3 sm:grid-cols-3 lg:w-[520px]">
            <div className="space-y-2">
              <Label htmlFor="opportunity-company-type">企业类型</Label>
              <Select id="opportunity-company-type" value={companyType} onChange={(event) => updateFilter({ companyType: event.target.value })}>
                <option value="">全部</option>
                {companyTypes.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="opportunity-city">工作城市</Label>
              <Select id="opportunity-city" value={city} onChange={(event) => updateFilter({ city: event.target.value })}>
                <option value="">全部</option>
                {cities.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="opportunity-major">专业限制</Label>
              <Select id="opportunity-major" value={unrestrictedMajor} onChange={(event) => updateFilter({ unrestrictedMajor: event.target.value })}>
                <option value="">全部</option>
                <option value="true">不限专业</option>
              </Select>
            </div>
          </div>
          <form action={syncAction}>
            <SyncButton />
          </form>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{effectiveSyncedAt ? `最近同步：${formatDateTime(effectiveSyncedAt)}` : "尚未同步企业数据"}</span>
          {syncState.message ? <span className={syncState.success ? "text-emerald-700" : "text-destructive"}>{syncState.message}</span> : null}
        </div>
      </div>

      {opportunities.length === 0 ? (
        <EmptyState title={lastSyncedAt ? "没有符合筛选条件的企业" : "先同步一次秋招企业"} />
      ) : (
        <div className="space-y-3">
          {opportunities.map((opportunity) => (
            <Card key={opportunity.id}>
              <CardContent className="grid gap-4 p-4 lg:grid-cols-[1.15fr_1.6fr_1fr_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-foreground">{opportunity.company}</h2>
                    {opportunity.batch ? <Badge>{opportunity.batch}</Badge> : null}
                    {opportunity.unrestrictedMajor ? <Badge variant="outline">不限专业</Badge> : null}
                    {opportunity.writtenTestWaived ? <Badge variant="outline">含免笔试</Badge> : null}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {[opportunity.companyType, opportunity.industry].filter(Boolean).join(" · ") || "企业信息待补充"}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm leading-6 text-foreground">{opportunity.roles || "岗位详情请查看官方公告"}</p>
                  {opportunity.cities ? <p className="mt-1 text-xs text-muted-foreground">{opportunity.cities}</p> : null}
                  {[opportunity.targetAudience, opportunity.degree].filter(Boolean).length ? (
                    <p className="mt-1 text-xs text-muted-foreground">{[opportunity.targetAudience, opportunity.degree].filter(Boolean).join(" · ")}</p>
                  ) : null}
                  {opportunity.notes ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{opportunity.notes}</p> : null}
                </div>
                <div className="text-xs text-muted-foreground">
                  <p>{opportunity.sourceUpdatedDate ? `岗位更新：${formatDate(opportunity.sourceUpdatedDate)}` : "更新时间未标注"}</p>
                  {opportunity.deadline ? <p className="mt-1">截止时间：{opportunity.deadline}</p> : null}
                  {opportunity.applicationId && opportunity.applicationStatus ? (
                    <p className="mt-1">投递状态：{applicationStatusMeta[opportunity.applicationStatus].label}</p>
                  ) : null}
                  {opportunity.applicationUrl ? (
                    <a href={opportunity.applicationUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-primary hover:underline">
                      打开投递页 <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                  {opportunity.announcementUrl ? (
                    <a href={opportunity.announcementUrl} target="_blank" rel="noreferrer" className="mt-1 ml-3 inline-flex items-center gap-1 text-primary hover:underline">
                      官方公告 <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-start gap-2 lg:justify-end">
                  <FavoriteButton opportunityId={opportunity.id} saved={Boolean(opportunity.applicationId)} />
                  <Button type="button" size="sm" onClick={() => setApplying(opportunity)}>
                    <Send className="h-4 w-4" />
                    投递
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {applying ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/20 px-4 py-8">
          <div className="max-h-full w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-card p-5 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">填写投递记录</h2>
            <ApplicationForm
              initialValues={buildApplicationDraft(applying, "apply", toDateInputValue())}
              resumeAssets={resumeAssets}
              onDone={() => {
                setApplying(null);
                router.refresh();
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
