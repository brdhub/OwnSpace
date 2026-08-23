import { ArrowRight, BriefcaseBusiness, Sparkles } from "lucide-react";
import Link from "next/link";
import type { RecommendedOpportunity } from "@/features/dashboard/queries";

type RecommendedOpportunitiesProps = {
  opportunities: RecommendedOpportunity[];
};

function OpportunityItem({ opportunity, duplicate = false }: { opportunity: RecommendedOpportunity; duplicate?: boolean }) {
  const details = [opportunity.roles, opportunity.cities].filter(Boolean).join(" · ");
  const href = `/applications/opportunities?query=${encodeURIComponent(opportunity.company)}`;

  return (
    <Link
      href={href}
      tabIndex={duplicate ? -1 : undefined}
      className="group inline-flex min-w-max items-center gap-3 rounded-md border border-emerald-100 bg-white px-4 py-2.5 shadow-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="grid h-8 w-8 place-items-center rounded-md bg-emerald-50 text-emerald-700">
        <BriefcaseBusiness className="h-4 w-4" />
      </span>
      <span>
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          {opportunity.company}
          {opportunity.writtenTestWaived ? (
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">免笔试</span>
          ) : null}
        </span>
        <span className="mt-0.5 flex max-w-80 items-center gap-1 truncate text-xs text-muted-foreground">
          {details || "岗位详情待查看"}
          {opportunity.deadline ? ` · ${opportunity.deadline}` : ""}
        </span>
      </span>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-700" />
    </Link>
  );
}

export function RecommendedOpportunities({ opportunities }: RecommendedOpportunitiesProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-emerald-100 bg-gradient-to-r from-emerald-50/80 via-card to-amber-50/50">
      <div className="flex items-center justify-between gap-3 border-b border-emerald-100/80 px-5 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-700" />
          <h2 className="text-sm font-semibold">推荐投递</h2>
          <span className="text-xs text-muted-foreground">从最新秋招机会里，挑一份开始</span>
        </div>
        <Link href="/applications/opportunities" className="shrink-0 text-xs font-medium text-emerald-700 hover:text-emerald-900">
          查看全部
        </Link>
      </div>

      {opportunities.length > 0 ? (
        <div className="recommended-opportunities-track group py-3" aria-label="推荐投递机会">
          <div className="recommended-opportunities-marquee flex w-max gap-3 px-3 group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]">
            <div className="flex gap-3">
              {opportunities.map((opportunity) => <OpportunityItem key={opportunity.id} opportunity={opportunity} />)}
            </div>
            <div className="flex gap-3" aria-hidden="true">
              {opportunities.map((opportunity) => <OpportunityItem key={`copy-${opportunity.id}`} opportunity={opportunity} duplicate />)}
            </div>
          </div>
        </div>
      ) : (
        <div className="px-5 py-4 text-sm text-muted-foreground">
          同步秋招企业后，这里会滚动展示值得关注的新机会。
        </div>
      )}
    </section>
  );
}
