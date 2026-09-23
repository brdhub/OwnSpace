import { applicationStatuses, type ApplicationStatus } from "@/config/application-status";
import { internshipTypes, type InternshipType } from "@/features/applications/constants";

export type StatisticsRow = {
  appliedDate: string;
  status: ApplicationStatus;
  internshipType: InternshipType;
};

export type StatisticsPoint = { label: string; count: number };

export type ApplicationStatistics = {
  total: number;
  statusCounts: Array<{ key: ApplicationStatus; count: number }>;
  typeCounts: Array<{ key: InternshipType; count: number }>;
  trend: StatisticsPoint[];
};

function dateFromKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function buildApplicationStatistics(rows: StatisticsRow[], startDate: string, endDate: string): ApplicationStatistics {
  const statusCounts = applicationStatuses.map((key) => ({
    key,
    count: rows.filter((row) => row.status === key).length,
  }));
  const typeCounts = internshipTypes.map((key) => ({
    key,
    count: rows.filter((row) => row.internshipType === key).length,
  }));

  if (!startDate || !endDate || startDate > endDate) {
    return { total: rows.length, statusCounts, typeCounts, trend: [] };
  }

  const start = dateFromKey(startDate);
  const end = dateFromKey(endDate);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const trend: StatisticsPoint[] = [];

  if (days <= 31) {
    for (let day = new Date(start); day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
      const key = dateKey(day);
      trend.push({ label: key.slice(5), count: rows.filter((row) => row.appliedDate === key).length });
    }
  } else {
    const firstMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    const lastMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    const monthCount = (lastMonth.getUTCFullYear() - firstMonth.getUTCFullYear()) * 12
      + lastMonth.getUTCMonth() - firstMonth.getUTCMonth() + 1;
    const visibleStart = new Date(firstMonth);
    if (monthCount > 12) visibleStart.setUTCMonth(visibleStart.getUTCMonth() + monthCount - 12);

    if (monthCount > 12) {
      const cutoff = dateKey(visibleStart);
      trend.push({ label: "更早", count: rows.filter((row) => row.appliedDate < cutoff).length });
    }
    for (let month = new Date(visibleStart); month <= lastMonth; month.setUTCMonth(month.getUTCMonth() + 1)) {
      const key = dateKey(month).slice(0, 7);
      trend.push({ label: key, count: rows.filter((row) => row.appliedDate.startsWith(key)).length });
    }
  }

  return { total: rows.length, statusCounts, typeCounts, trend };
}
