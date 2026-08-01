"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlanningEvent } from "@/db/schema";
import { PlanningEventDetail } from "@/features/planning/components/planning-event-detail";
import { PlanningEventDialog } from "@/features/planning/components/planning-event-dialog";
import { PlanningEventList } from "@/features/planning/components/planning-event-list";
import { PlanningTimeline } from "@/features/planning/components/planning-timeline";
import { PlanningToolbar } from "@/features/planning/components/planning-toolbar";
import { planningStartDate } from "@/features/planning/constants";
import type { PlanningDensity, PlanningEventType, PlanningFilter } from "@/features/planning/types";

export function PlanningWorkspace({ events, today }: { events: PlanningEvent[]; today: string }) {
  const [density, setDensity] = useState<PlanningDensity>("standard");
  const [filter, setFilter] = useState<PlanningFilter>("all");
  const [selected, setSelected] = useState<PlanningEvent | null>(events[0] ?? null);
  const [dialog, setDialog] = useState<{ event?: PlanningEvent; defaultDate: string; defaultType: PlanningEventType } | null>(null);
  const [scrollSignal, setScrollSignal] = useState(0);

  const filteredEvents = useMemo(() => {
    if (filter === "all") {
      return events;
    }
    return events.filter((event) => event.eventType === filter);
  }, [events, filter]);

  useEffect(() => {
    if (!selected || events.some((event) => event.id === selected.id)) {
      return;
    }
    setSelected(events[0] ?? null);
  }, [events, selected]);

  function openCreate(defaultType: PlanningEventType, defaultDate = today >= planningStartDate ? today : planningStartDate) {
    setDialog({ defaultDate, defaultType });
  }

  return (
    <div className="space-y-5">
      <PlanningToolbar
        density={density}
        filter={filter}
        onDensityChange={setDensity}
        onFilterChange={setFilter}
        onCreateTask={() => openCreate("task")}
        onCreateProgress={() => openCreate("progress")}
        onToday={() => setScrollSignal((value) => value + 1)}
      />
      <PlanningTimeline
        events={filteredEvents}
        density={density}
        today={today}
        scrollSignal={scrollSignal}
        onDensityChange={setDensity}
        onSelectEvent={(event) => {
          setSelected(event);
          setDialog({ event, defaultDate: event.eventDate, defaultType: event.eventType });
        }}
        onCreateAtDate={(date) => openCreate("task", date)}
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <PlanningEventDetail event={selected} onEdit={(event) => setDialog({ event, defaultDate: event.eventDate, defaultType: event.eventType })} />
        <PlanningEventList
          events={filteredEvents}
          onSelect={setSelected}
          onEdit={(event) => setDialog({ event, defaultDate: event.eventDate, defaultType: event.eventType })}
        />
      </div>
      {events.every((event) => event.source === "system") ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-4 text-sm leading-6 text-muted-foreground">
          先在时间线上放下一个小节点，之后可以慢慢调整。
        </div>
      ) : null}
      {dialog ? <PlanningEventDialog event={dialog.event} defaultDate={dialog.defaultDate} defaultType={dialog.defaultType} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}


