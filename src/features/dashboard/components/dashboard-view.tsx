"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ApplicationStatus } from "@/config/application-status";
import type { PlanningEvent } from "@/db/schema";
import { ApplicationForm } from "@/features/applications/components/application-form";
import type { InternshipType } from "@/features/applications/constants";
import { InterviewCalendar } from "@/features/dashboard/components/interview-calendar";
import { StatusSummary } from "@/features/dashboard/components/status-summary";
import { TodayJournalCard } from "@/features/dashboard/components/today-journal-card";
import { TodayStudyCard } from "@/features/dashboard/components/today-study-card";
import { PlanningSummaryCard } from "@/features/dashboard/components/planning-summary-card";
import { RecommendedOpportunities } from "@/features/dashboard/components/recommended-opportunities";
import type { CalendarActivityDay, CalendarInterviewEvent } from "@/features/dashboard/queries";
import type { RecommendedOpportunity } from "@/features/dashboard/queries";
import type { StudyCategory } from "@/features/study/constants";
import type { ResumeAssetOption } from "@/features/resumes/types";

type DashboardViewProps = {
  statusStats: Array<{ status: ApplicationStatus; count: number }>;
  internshipTypeStats: Array<{ internshipType: InternshipType; count: number }>;
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
  recommendedOpportunities: RecommendedOpportunity[];
  resumeAssets: ResumeAssetOption[];
};

export function DashboardView({
  statusStats,
  internshipTypeStats,
  calendarEvents,
  calendarActivityDays,
  hasJournalEntry,
  studyProgress,
  today,
  planningSummary,
  recommendedOpportunities,
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
      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Button type="button" onClick={() => setShowCreateApplication(true)}>
              <Plus className="h-4 w-4" />
              新增投递记录
            </Button>
            <Button asChild type="button" className="bg-blue-100 text-blue-800 hover:bg-blue-200">
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

      <RecommendedOpportunities opportunities={recommendedOpportunities} />

      <StatusSummary statusStats={statusStats} internshipTypeStats={internshipTypeStats} />

      <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-4">
        <TodayJournalCard hasEntry={hasJournalEntry} today={today} />
        <TodayStudyCard completed={studyProgress.completed} categories={studyProgress.categories} />
        <PlanningSummaryCard {...planningSummary} />
        <InterviewCalendar events={calendarEvents} activityDays={calendarActivityDays} />
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


