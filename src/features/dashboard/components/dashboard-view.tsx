"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PlanningEvent } from "@/db/schema";
import type { StatisticsRow } from "@/features/applications/application-statistics";
import { ApplicationForm } from "@/features/applications/components/application-form";
import { ApplicationAchievement } from "@/features/dashboard/components/application-achievement";
import { InterviewCalendar } from "@/features/dashboard/components/interview-calendar";
import { TodayJournalCard } from "@/features/dashboard/components/today-journal-card";
import { TodayStudyCard } from "@/features/dashboard/components/today-study-card";
import { PlanningSummaryCard } from "@/features/dashboard/components/planning-summary-card";
import { PersonalOverview } from "@/features/dashboard/components/personal-overview";
import type { CalendarActivityDay, CalendarInterviewEvent } from "@/features/dashboard/queries";
import type { StudyCategory } from "@/features/study/constants";
import type { ResumeAssetOption } from "@/features/resumes/types";

type DashboardViewProps = {
  applicationStatisticsRows: StatisticsRow[];
  calendarEvents: CalendarInterviewEvent[];
  calendarActivityDays: CalendarActivityDay[];
  hasJournalEntry: boolean;
  studyProgress: {
    completed: number;
    categories: Array<{ category: StudyCategory; completed: boolean }>;
  };
  today: string;
  planningSummary: {
    nextTask: PlanningEvent | null;
    latestProgress: PlanningEvent | null;
    hasUserEvents: boolean;
  };
  resumeAssets: ResumeAssetOption[];
};

export function DashboardView({
  applicationStatisticsRows,
  calendarEvents,
  calendarActivityDays,
  hasJournalEntry,
  studyProgress,
  today,
  planningSummary,
  resumeAssets,
}: DashboardViewProps) {
  const [showCreateApplication, setShowCreateApplication] = useState(false);
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = new FormData(event.currentTarget).get("q")?.toString().trim() ?? "";
    const target = query ? `/search?q=${encodeURIComponent(query)}` : "/search";

    startTransition(() => router.push(target));
  }

  return (
    <div className="space-y-6">
      <PersonalOverview today={today} applicationCount={applicationStatisticsRows.length} resumeCount={resumeAssets.length} recordedDays={calendarActivityDays.filter((day) => day.date <= today).length} />

      <section className="overview-enter rounded-2xl border border-border bg-card p-4" style={{ animationDelay: "60ms" }} aria-label="快捷操作">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Button type="button" onClick={() => setShowCreateApplication(true)}>
              <Plus className="h-4 w-4" />
              新增投递记录
            </Button>
            <Button asChild type="button" variant="outline">
              <Link href="/applications">查看全部投递</Link>
            </Button>
          </div>
          <form onSubmit={handleSearch} className="flex w-full min-w-0 flex-1 gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input name="q" className="pl-9" placeholder="搜索投递、面试、日记、学习和规划" aria-label="搜索全部记录" />
            </div>
            <Button type="submit" variant="outline" disabled={isNavigating} className="min-w-24">
              <Search className="h-4 w-4" />
              {isNavigating ? "搜索中..." : "搜索"}
            </Button>
          </form>
        </div>
      </section>

      <section aria-labelledby="overview-today-title" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="overview-today-title" className="text-base font-semibold">今天与接下来</h2>
          <p className="text-xs text-muted-foreground">学习、生活与计划，都在这里</p>
        </div>
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid min-w-0 gap-5 sm:grid-cols-2">
            <div className="overview-enter overview-card" style={{ animationDelay: "120ms" }}><TodayStudyCard completed={studyProgress.completed} categories={studyProgress.categories} /></div>
            <div className="overview-enter overview-card sm:pt-6" style={{ animationDelay: "180ms" }}><TodayJournalCard hasEntry={hasJournalEntry} today={today} /></div>
            <div className="overview-enter sm:col-span-2" style={{ animationDelay: "240ms" }}><PlanningSummaryCard {...planningSummary} /></div>
          </div>
          <div id="overview-calendar" className="overview-enter scroll-mt-6" style={{ animationDelay: "300ms" }}>
            <InterviewCalendar events={calendarEvents} activityDays={calendarActivityDays} />
          </div>
        </div>
      </section>

      <div className="border-t border-border pt-6">
        <ApplicationAchievement rows={applicationStatisticsRows} today={today} />
      </div>

      {showCreateApplication ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/20 px-4 py-8">
          <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-5 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">新增投递记录</h2>
            <ApplicationForm resumeAssets={resumeAssets} onDone={() => setShowCreateApplication(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}


