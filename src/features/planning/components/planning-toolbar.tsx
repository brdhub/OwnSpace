"use client";

import { LocateFixed, Plus, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { planningDensityMeta, planningDensityOrder, planningEventTypeMeta } from "@/features/planning/constants";
import type { PlanningDensity, PlanningFilter } from "@/features/planning/types";

type PlanningToolbarProps = {
  density: PlanningDensity;
  filter: PlanningFilter;
  onDensityChange: (density: PlanningDensity) => void;
  onFilterChange: (filter: PlanningFilter) => void;
  onCreateTask: () => void;
  onCreateProgress: () => void;
  onToday: () => void;
};

export function PlanningToolbar({ density, filter, onDensityChange, onFilterChange, onCreateTask, onCreateProgress, onToday }: PlanningToolbarProps) {
  const densityIndex = planningDensityOrder.indexOf(density);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onCreateTask}><Plus className="h-4 w-4" />新增任务</Button>
        <Button type="button" variant="outline" onClick={onCreateProgress}><Plus className="h-4 w-4" />新增进度</Button>
        <Button type="button" variant="ghost" onClick={onToday}><LocateFixed className="h-4 w-4" />回到今天</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr] lg:w-[520px]">
        <div className="space-y-2 text-sm font-medium">
          <span>显示密度</span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="缩小时间轴"
              disabled={densityIndex <= 0}
              onClick={() => onDensityChange(planningDensityOrder[Math.max(0, densityIndex - 1)])}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Select value={density} onChange={(event) => onDensityChange(event.target.value as PlanningDensity)}>
              {Object.entries(planningDensityMeta).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="放大时间轴"
              disabled={densityIndex >= planningDensityOrder.length - 1}
              onClick={() => onDensityChange(planningDensityOrder[Math.min(planningDensityOrder.length - 1, densityIndex + 1)])}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <label className="space-y-2 text-sm font-medium">
          <span>类型筛选</span>
          <Select value={filter} onChange={(event) => onFilterChange(event.target.value as PlanningFilter)}>
            <option value="all">全部</option>
            <option value="task">{planningEventTypeMeta.task.label}</option>
            <option value="progress">{planningEventTypeMeta.progress.label}</option>
          </Select>
        </label>
      </div>
    </div>
  );
}


