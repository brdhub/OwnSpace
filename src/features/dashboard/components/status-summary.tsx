import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { applicationStatusMeta, type ApplicationStatus } from "@/config/application-status";
import Link from "next/link";
import { internshipTypeMeta, type InternshipType } from "@/features/applications/constants";
import { buildApplicationFiltersHref } from "@/features/applications/filters";
import { cn } from "@/lib/utils";

type StatusSummaryProps = {
  statusStats: Array<{ status: ApplicationStatus; count: number }>;
  internshipTypeStats: Array<{ internshipType: InternshipType; count: number }>;
};

const interactiveBlockClassName =
  "flex items-center justify-between rounded-md border px-3 py-2 transition duration-150 hover:-translate-y-0.5 hover:brightness-95 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const internshipBlockClassName =
  "group relative flex min-h-14 items-center justify-between overflow-hidden rounded-lg border border-border bg-background py-2.5 pl-5 pr-3 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-foreground/20 hover:bg-accent/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function StatusSummary({ statusStats, internshipTypeStats }: StatusSummaryProps) {
  const total = statusStats.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card>
      <CardHeader className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-end">
        <div>
          <CardTitle>投递状态概览</CardTitle>
          <Link
            href={buildApplicationFiltersHref({ status: "all", internshipType: "all" })}
            className="group mt-5 inline-flex items-baseline gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="text-3xl font-semibold text-foreground transition-colors group-hover:text-primary">{total}</span>
            <span className="text-sm text-muted-foreground group-hover:text-foreground">条投递记录</span>
          </Link>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {internshipTypeStats.map((item) => (
            <Link
              key={item.internshipType}
              href={buildApplicationFiltersHref({ status: "all", internshipType: item.internshipType })}
              className={internshipBlockClassName}
            >
              <span
                className={cn("absolute inset-y-0 left-0 w-1.5", internshipTypeMeta[item.internshipType].barClassName)}
                aria-hidden="true"
              />
              <span className="text-sm font-medium text-foreground">{internshipTypeMeta[item.internshipType].label}</span>
              <span className="grid h-8 min-w-8 place-items-center rounded-full bg-muted px-2 text-sm font-semibold text-foreground transition-colors group-hover:bg-foreground group-hover:text-background">
                {item.count}
              </span>
            </Link>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
          {statusStats.map((item) => (
            <Link
              key={item.status}
              href={buildApplicationFiltersHref({ status: item.status, internshipType: "all" })}
              className={cn(interactiveBlockClassName, applicationStatusMeta[item.status].summaryClassName)}
            >
              <span className="text-sm font-medium">{applicationStatusMeta[item.status].label}</span>
              <span className="text-sm font-semibold">{item.count}</span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

