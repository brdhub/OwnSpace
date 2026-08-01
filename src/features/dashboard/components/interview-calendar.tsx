"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CalendarActivityDay, CalendarInterviewEvent } from "@/features/dashboard/queries";
import { cn } from "@/lib/utils";

type InterviewCalendarProps = {
  events: CalendarInterviewEvent[];
  activityDays: CalendarActivityDay[];
};

const weekdayLabels = ["一", "二", "三", "四", "五", "六", "日"];

function monthKey(date: Date) {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`;
}

function dateKey(date: Date) {
  return `${monthKey(date)}-${`${date.getDate()}`.padStart(2, "0")}`;
}

function monthTitle(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long" }).format(date);
}

function fullDateTitle(date: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short" }).format(
    new Date(`${date}T00:00:00`),
  );
}

function buildCalendarDays(visibleMonth: Date) {
  const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function studyColor(count: number) {
  if (count >= 4) return "bg-emerald-800";
  if (count === 3) return "bg-emerald-600";
  if (count === 2) return "bg-emerald-400";
  if (count === 1) return "bg-emerald-200";
  return "bg-muted";
}

function tooltipPosition(index: number) {
  const column = index % 7;
  const horizontal = column < 2 ? "left-0" : column > 4 ? "right-0" : "left-1/2 -translate-x-1/2";
  const vertical = index < 14 ? "top-full mt-2" : "bottom-full mb-2";
  return `${horizontal} ${vertical}`;
}

export function InterviewCalendar({ events, activityDays }: InterviewCalendarProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const today = dateKey(new Date());
  const days = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);

  const eventsByDate = useMemo(() => {
    return events.reduce<Record<string, CalendarInterviewEvent[]>>((acc, event) => {
      acc[event.date] = acc[event.date] ?? [];
      acc[event.date].push(event);
      return acc;
    }, {});
  }, [events]);

  const activityByDate = useMemo(
    () => Object.fromEntries(activityDays.map((day) => [day.date, day])),
    [activityDays],
  );

  const selectedActivity = selectedDate ? activityByDate[selectedDate] : undefined;
  const selectedEvents = selectedDate ? eventsByDate[selectedDate] ?? [] : [];

  function moveMonth(offset: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
    setSelectedDate(null);
  }

  return (
    <Card className="w-full max-w-md overflow-visible">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border px-4 py-3">
        <CardTitle className="text-base">日历</CardTitle>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveMonth(-1)} aria-label="上个月">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-24 text-center text-sm font-medium text-foreground">{monthTitle(visibleMonth)}</div>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveMonth(1)} aria-label="下个月">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="max-w-[300px]">
          <div className="mb-1 grid grid-cols-7 gap-1">
            {weekdayLabels.map((label) => (
              <div key={label} className="text-center text-[11px] font-medium text-muted-foreground">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => {
              const key = dateKey(day);
              const dayEvents = eventsByDate[key] ?? [];
              const activity = activityByDate[key];
              const inMonth = day.getMonth() === visibleMonth.getMonth();
              const isToday = key === today;
              const isSelected = key === selectedDate;
              const summary = `${activity?.hasJournal ? "已写日记" : "未写日记"}，学习 ${activity?.completedStudyCount ?? 0}/4`;

              return (
                <div key={key} className="group relative aspect-square min-w-0">
                  <button
                    type="button"
                    onClick={() => setSelectedDate((current) => (current === key ? null : key))}
                    className={cn(
                      "relative h-full w-full rounded-[4px] border border-border bg-card p-1 text-left transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      !inMonth && "opacity-35",
                      isToday && "border-primary",
                      isSelected && "ring-2 ring-foreground/30",
                      dayEvents.length > 0 && "border-rose-400",
                    )}
                    aria-label={`${fullDateTitle(key)}，${summary}${dayEvents.length ? `，${dayEvents.length} 场面试` : ""}`}
                  >
                    <span className="absolute inset-x-1 bottom-3 top-1 grid place-items-center" aria-hidden="true">
                      <span
                        className={cn(
                          "grid h-5 min-w-5 place-items-center rounded-[3px] px-1 text-[11px] font-medium leading-none text-foreground",
                          isToday && "bg-primary text-primary-foreground",
                        )}
                      >
                        {day.getDate()}
                      </span>
                    </span>
                    {dayEvents.length > 0 ? <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-sm bg-rose-500" aria-hidden="true" /> : null}
                    <span className="absolute inset-x-1 bottom-1 grid grid-cols-2 gap-0.5" aria-hidden="true">
                      <span className={cn("h-1.5 rounded-[2px]", activity?.hasJournal ? "bg-amber-400" : "bg-muted")} />
                      <span className={cn("h-1.5 rounded-[2px]", studyColor(activity?.completedStudyCount ?? 0))} />
                    </span>
                  </button>

                  {dayEvents.length > 0 ? (
                    <div
                      className={cn(
                        "pointer-events-none invisible absolute z-20 w-52 rounded-md border border-border bg-popover p-2 text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100",
                        tooltipPosition(index),
                      )}
                    >
                      <p className="mb-1.5 text-xs font-semibold">{fullDateTitle(key)}</p>
                      <div className="space-y-1.5">
                        {dayEvents.slice(0, 3).map((event) => (
                          <div key={event.id} className="text-xs leading-4">
                            <p><span className="font-medium text-rose-600">{event.time ?? "时间待补"}</span> {event.company}</p>
                            <p className="truncate text-muted-foreground">{event.role}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-[2px] bg-amber-400" />日记</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-[2px] bg-rose-500" />面试</span>
            <span className="inline-flex items-center gap-1">
              学习
              <span className="inline-flex gap-0.5" aria-hidden="true">
                <span className="h-2 w-2 rounded-[2px] bg-emerald-200" />
                <span className="h-2 w-2 rounded-[2px] bg-emerald-400" />
                <span className="h-2 w-2 rounded-[2px] bg-emerald-600" />
                <span className="h-2 w-2 rounded-[2px] bg-emerald-800" />
              </span>
            </span>
          </div>
        </div>

        {selectedDate ? (
          <div className="mt-4 max-w-[300px] border-t border-border pt-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">{fullDateTitle(selectedDate)}</p>
              <p className="text-xs text-muted-foreground">学习 {selectedActivity?.completedStudyCount ?? 0}/4</p>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              <span className={cn("rounded px-2 py-1", selectedActivity?.hasJournal ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground")}>
                {selectedActivity?.hasJournal ? "已写日记" : "未写日记"}
              </span>
            </div>
            {selectedEvents.length > 0 ? (
              <div className="mt-3 space-y-2">
                {selectedEvents.map((event) => (
                  <div key={event.id} className="border-l-2 border-rose-400 pl-2 text-sm">
                    <p><span className="font-semibold text-rose-600">{event.time ?? "时间待补"}</span> · {event.company}</p>
                    <p className="text-xs text-muted-foreground">{event.role}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
