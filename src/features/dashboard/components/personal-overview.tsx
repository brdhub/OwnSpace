import { ArrowUpRight, BriefcaseBusiness, FileText, Sprout } from "lucide-react";
import Link from "next/link";

type PersonalOverviewProps = {
  today: string;
  applicationCount: number;
  resumeCount: number;
  recordedDays: number;
};

export function PersonalOverview({ today, applicationCount, resumeCount, recordedDays }: PersonalOverviewProps) {
  const dateLabel = new Intl.DateTimeFormat("zh-CN", {
    month: "long", day: "numeric", weekday: "long",
  }).format(new Date(`${today}T12:00:00`));
  const summaries = [
    { label: "投递记录", value: applicationCount, unit: "条", href: "/applications", icon: BriefcaseBusiness },
    { label: "简历文件", value: resumeCount, unit: "份", href: "/resumes", icon: FileText },
    { label: "留下足迹", value: recordedDays, unit: "天", href: "#overview-calendar", icon: Sprout },
  ];

  return (
    <section className="overview-welcome overview-enter relative overflow-hidden rounded-3xl border border-primary/15 p-6 sm:p-8" aria-labelledby="overview-welcome-title">
      <div className="overview-orbit pointer-events-none absolute -right-16 -top-28 h-80 w-80 rounded-full border border-primary/10" aria-hidden="true" />
      <div className="relative grid gap-8 xl:grid-cols-[1fr_1.15fr] xl:items-center">
        <div>
          <time dateTime={today} className="text-xs font-medium tracking-wider text-primary">{dateLabel}</time>
          <h2 id="overview-welcome-title" className="mt-3 text-2xl font-semibold leading-snug tracking-normal sm:text-3xl">把注意力，留给自己。</h2>
          <p className="mt-3 max-w-sm text-sm leading-7 text-muted-foreground">看看最近的进展，记下今天的一点收获。<br />从一件小事开始，按自己的节奏向前。</p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {summaries.map(({ label, value, unit, href, icon: Icon }, index) => (
            <Link key={label} href={href} className="overview-note group min-w-0 rounded-2xl border border-border/70 bg-card/90 p-3 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4" style={{ "--note-angle": `${index === 1 ? 2 : -2}deg` } as React.CSSProperties}>
              <div className="flex items-center justify-between text-primary">
                <Icon className="h-4 w-4" aria-hidden="true" />
                <ArrowUpRight className="h-3.5 w-3.5 opacity-40 transition-opacity group-hover:opacity-100" aria-hidden="true" />
              </div>
              <p className="mt-6 flex flex-wrap items-baseline gap-1"><strong className="break-all text-3xl font-semibold tracking-tight tabular-nums">{value}</strong><span className="text-xs text-muted-foreground">{unit}</span></p>
              <p className="mt-2 text-xs text-muted-foreground">{label}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
