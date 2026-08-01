import { planningEndDate, planningStartDate } from "@/features/planning/constants";

const dayMs = 24 * 60 * 60 * 1000;

function parseDateParts(value: Date | string) {
  if (value instanceof Date) {
    return { year: value.getFullYear(), month: value.getMonth() + 1, day: value.getDate() };
  }
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function toUtcDay(value: Date | string) {
  const { year, month, day } = parseDateParts(value);
  return Date.UTC(year, month - 1, day);
}

function fromUtcDay(value: number) {
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function clampPosition(position: number) {
  if (Number.isNaN(position)) {
    return 0;
  }
  return Math.min(1, Math.max(0, position));
}

export function clampDateToPlanningRange(date: Date | string) {
  const value = toUtcDay(date);
  const start = toUtcDay(planningStartDate);
  const end = toUtcDay(planningEndDate);
  return fromUtcDay(Math.min(end, Math.max(start, value)));
}

export function isEventInPlanningRange(date: Date | string) {
  const value = toUtcDay(date);
  return value >= toUtcDay(planningStartDate) && value <= toUtcDay(planningEndDate);
}

export function dateToTimelinePosition(date: Date | string, startDate = planningStartDate, endDate = planningEndDate) {
  const start = toUtcDay(startDate);
  const end = toUtcDay(endDate);
  if (end <= start) {
    return 0;
  }
  return clampPosition((toUtcDay(date) - start) / (end - start));
}

export function timelinePositionToDate(position: number, startDate = planningStartDate, endDate = planningEndDate) {
  const start = toUtcDay(startDate);
  const end = toUtcDay(endDate);
  const clamped = clampPosition(position);
  const rounded = Math.round((start + (end - start) * clamped) / dayMs) * dayMs;
  return clampDateToPlanningRange(fromUtcDay(rounded));
}

export function formatPlanningMonthLabel(date: Date | string) {
  const { year, month } = parseDateParts(date);
  return `${year} 年 ${month} 月`;
}

export function getPlanningMonthTicks() {
  const ticks: Array<{ date: string; label: string; position: number }> = [];
  const start = parseDateParts(planningStartDate);
  const end = parseDateParts(planningEndDate);
  let year = start.year;
  let month = start.month;

  while (year < end.year || (year === end.year && month <= end.month)) {
    const date = `${year}-${`${month}`.padStart(2, "0")}-01`;
    ticks.push({ date, label: formatPlanningMonthLabel(date), position: dateToTimelinePosition(date) });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return ticks;
}

export function getSameDayLane(index: number) {
  return index % 4;
}
