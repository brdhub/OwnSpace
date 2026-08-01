"use client";

import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlanningEvent } from "@/db/schema";
import { planningDensityMeta, planningDensityOrder, planningEndDate, planningEventTypeMeta, planningStartDate } from "@/features/planning/constants";
import { PlanningTimelineEvent } from "@/features/planning/components/planning-timeline-event";
import type { PlanningDensity } from "@/features/planning/types";
import { dateToTimelinePosition, getPlanningMonthTicks, isEventInPlanningRange, timelinePositionToDate } from "@/features/planning/utils";
import { cn } from "@/lib/utils";

type PlanningTimelineProps = {
  events: PlanningEvent[];
  density: PlanningDensity;
  today: string;
  onSelectEvent: (event: PlanningEvent) => void;
  onCreateAtDate: (date: string) => void;
  onDensityChange: (density: PlanningDensity) => void;
  scrollSignal: number;
};

type PositionedEvent = {
  event: PlanningEvent;
  position: number;
  x: number;
};

type ViewportState = {
  left: number;
  width: number;
};

const collisionGapByDensity: Record<PlanningDensity, number> = {
  minimal: 124,
  compact: 100,
  standard: 76,
  comfortable: 56,
  expanded: 42,
  detailed: 30,
};

function getEventPriority(event: PlanningEvent) {
  if (event.eventType === "task") {
    return 0;
  }
  return 1;
}

function getVisibleEvents(positionedEvents: PositionedEvent[], density: PlanningDensity) {
  const accepted: PositionedEvent[] = [];
  const hiddenIds = new Set<number>();
  const minGap = collisionGapByDensity[density];
  const byPriority = [...positionedEvents].sort((left, right) => {
    const priorityCompare = getEventPriority(left.event) - getEventPriority(right.event);
    if (priorityCompare !== 0) {
      return priorityCompare;
    }
    const dateCompare = left.event.eventDate.localeCompare(right.event.eventDate);
    if (dateCompare !== 0) {
      return dateCompare;
    }
    return left.event.id - right.event.id;
  });

  for (const item of byPriority) {
    const isTooClose = accepted.some((acceptedItem) => Math.abs(acceptedItem.x - item.x) < minGap);
    if (isTooClose) {
      hiddenIds.add(item.event.id);
    } else {
      accepted.push(item);
    }
  }

  return {
    visibleEvents: positionedEvents.filter((item) => !hiddenIds.has(item.event.id)),
    hiddenEvents: positionedEvents.filter((item) => hiddenIds.has(item.event.id)),
  };
}

export function PlanningTimeline({ events, density, today, onSelectEvent, onCreateAtDate, onDensityChange, scrollSignal }: PlanningTimelineProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<HTMLDivElement | null>(null);
  const lastWheelAtRef = useRef(0);
  const [viewport, setViewport] = useState<ViewportState>({ left: 0, width: 1 });
  const [showHiddenEvents, setShowHiddenEvents] = useState(false);
  const width = planningDensityMeta[density].width;
  const ticks = useMemo(() => getPlanningMonthTicks(), []);
  const todayPosition = isEventInPlanningRange(today) ? dateToTimelinePosition(today) : null;
  const densityIndex = planningDensityOrder.indexOf(density);

  const positionedEvents = useMemo(
    () =>
      events.map((event) => {
        const position = dateToTimelinePosition(event.eventDate, planningStartDate, planningEndDate);
        return { event, position, x: position * width };
      }),
    [events, width],
  );

  const { visibleEvents, hiddenEvents } = useMemo(() => getVisibleEvents(positionedEvents, density), [density, positionedEvents]);

  const updateViewport = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }
    setViewport({
      left: scroller.scrollLeft / width,
      width: Math.min(1, scroller.clientWidth / width),
    });
  }, [width]);

  const scrollToMinimapPosition = useCallback(
    (position: number) => {
      const scroller = scrollerRef.current;
      if (!scroller) {
        return;
      }
      const clamped = Math.min(1, Math.max(0, position));
      scroller.scrollTo({ left: Math.max(0, width * clamped - scroller.clientWidth / 2), behavior: "smooth" });
      window.setTimeout(updateViewport, 250);
    },
    [updateViewport, width],
  );

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }

    function handleWheel(event: WheelEvent) {
      if (Math.abs(event.deltaY) < 8) {
        return;
      }

      event.preventDefault();
      const now = window.performance.now();
      if (now - lastWheelAtRef.current < 180) {
        return;
      }

      const nextIndex = event.deltaY < 0 ? densityIndex + 1 : densityIndex - 1;
      if (nextIndex < 0 || nextIndex >= planningDensityOrder.length) {
        lastWheelAtRef.current = now;
        return;
      }

      lastWheelAtRef.current = now;
      onDensityChange(planningDensityOrder[nextIndex]);
    }

    chart.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      chart.removeEventListener("wheel", handleWheel);
    };
  }, [densityIndex, onDensityChange]);

  useEffect(() => {
    updateViewport();
  }, [density, updateViewport]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || todayPosition === null) {
      return;
    }
    const left = width * todayPosition - scroller.clientWidth / 2;
    scroller.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
    window.setTimeout(updateViewport, 250);
  }, [scrollSignal, todayPosition, updateViewport, width]);

  const sameDayCounts = new Map<string, number>();

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>鼠标放在时间轴区域内滚动滚轮，可以快速放大或缩小。</span>
        {hiddenEvents.length > 0 ? <span>{hiddenEvents.length} 个相邻节点已暂时隐藏，放大后可见。</span> : <span>当前节点全部可见。</span>}
      </div>
      <div ref={scrollerRef} className="overflow-x-auto" onScroll={updateViewport}>
        <div
          ref={chartRef}
          className="relative h-[360px] min-w-full cursor-crosshair"
          style={{ width }}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const position = (event.clientX - rect.left) / rect.width;
            onCreateAtDate(timelinePositionToDate(position));
          }}
        >
          <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-border" />
          {ticks.map((tick) => (
            <div key={tick.date} className="absolute top-0 h-full border-l border-border/70" style={{ left: `${tick.position * 100}%` }}>
              <div className="ml-2 mt-2 whitespace-nowrap text-xs text-muted-foreground">{tick.label}</div>
            </div>
          ))}
          {todayPosition !== null ? (
            <div className="absolute top-8 h-[292px] border-l-2 border-primary" style={{ left: `${todayPosition * 100}%` }}>
              <span className="ml-2 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground">今天</span>
            </div>
          ) : null}
          {visibleEvents.map(({ event, position }) => {
            const count = sameDayCounts.get(event.eventDate) ?? 0;
            sameDayCounts.set(event.eventDate, count + 1);
            return <PlanningTimelineEvent key={event.id} event={event} position={position} sameDayIndex={count} onSelect={onSelectEvent} />;
          })}
          <p className="absolute bottom-3 left-4 text-sm text-muted-foreground">点击时间轴空白位置，可以在对应日期放下一个小节点。</p>
        </div>
      </div>
      <div className="mt-4 rounded-md border border-border bg-background p-3">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>缩略图</span>
          <span>拖动蓝色视野框或点击缩略图，可以快速移动视野</span>
        </div>
        <div
          className="relative h-12 cursor-pointer rounded-md border border-border bg-card"
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            scrollToMinimapPosition((event.clientX - rect.left) / rect.width);
          }}
          onPointerDown={(event) => {
            const target = event.target as HTMLElement;
            if (!target.closest("[data-minimap-viewport]")) {
              return;
            }
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            const rect = event.currentTarget.getBoundingClientRect();
            const moveTo = (clientX: number) => scrollToMinimapPosition((clientX - rect.left) / rect.width);
            moveTo(event.clientX);

            function handlePointerMove(moveEvent: PointerEvent) {
              moveTo(moveEvent.clientX);
            }

            function handlePointerUp() {
              window.removeEventListener("pointermove", handlePointerMove);
              window.removeEventListener("pointerup", handlePointerUp);
            }

            window.addEventListener("pointermove", handlePointerMove);
            window.addEventListener("pointerup", handlePointerUp, { once: true });
          }}
        >
          <div className="absolute left-2 right-2 top-1/2 h-px -translate-y-1/2 bg-border" />
          {positionedEvents.map(({ event, position }) => {
            const meta = planningEventTypeMeta[event.eventType];
            return (
              <span
                key={event.id}
                className={cn("absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border", meta.dotClassName)}
                style={{ left: `${position * 100}%` }}
              />
            );
          })}
          <div
            data-minimap-viewport
            className="absolute top-1 h-10 cursor-grab rounded border border-primary bg-primary/10 active:cursor-grabbing"
            style={{ left: `${viewport.left * 100}%`, width: `${viewport.width * 100}%` }}
          />
        </div>
      </div>
      {hiddenEvents.length > 0 ? (
        <div className="mt-3 rounded-md border border-dashed border-border bg-background">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-medium text-foreground"
            onClick={() => setShowHiddenEvents((value) => !value)}
          >
            <span>查看暂时隐藏的节点</span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", showHiddenEvents && "rotate-180")} />
          </button>
          {showHiddenEvents ? (
            <div className="grid gap-2 border-t border-border p-3 sm:grid-cols-2 lg:grid-cols-3">
              {hiddenEvents.map(({ event }) => {
                const meta = planningEventTypeMeta[event.eventType];
                return (
                  <button
                    key={event.id}
                    type="button"
                    className="rounded-md border border-border bg-card p-3 text-left text-sm hover:bg-accent"
                    onClick={() => onSelectEvent(event)}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className={cn("rounded-md border px-2 py-0.5", meta.badgeClassName)}>{meta.label}</span>
                      <span>{event.eventDate}</span>
                    </div>
                    <div className="mt-2 font-medium text-foreground">{event.title}</div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">当前密度下与相邻节点距离过近，已优先保留任务或更早节点。</p>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
