import { applicationStatuses, type ApplicationStatus } from "@/config/application-status";
import { internshipTypes } from "@/features/applications/constants";

export const applicationStatusFilters = ["active", "all", ...applicationStatuses] as const;
export type ApplicationStatusFilter = (typeof applicationStatusFilters)[number];

export const applicationInternshipTypeFilters = ["all", ...internshipTypes] as const;
export type ApplicationInternshipTypeFilter = (typeof applicationInternshipTypeFilters)[number];

export type ResolvedApplicationFilters = {
  query: string;
  status: ApplicationStatusFilter;
  internshipType: ApplicationInternshipTypeFilter;
};

export const defaultApplicationFilters = {
  status: "active",
  internshipType: "autumn",
} as const satisfies Pick<ResolvedApplicationFilters, "status" | "internshipType">;

function includesValue<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === "string" && values.includes(value as T[number]);
}

export function resolveApplicationFilters(filters: {
  query?: unknown;
  status?: unknown;
  internshipType?: unknown;
}): ResolvedApplicationFilters {
  return {
    query: typeof filters.query === "string" ? filters.query.trim() : "",
    status: includesValue(applicationStatusFilters, filters.status)
      ? filters.status
      : defaultApplicationFilters.status,
    internshipType: includesValue(applicationInternshipTypeFilters, filters.internshipType)
      ? filters.internshipType
      : defaultApplicationFilters.internshipType,
  };
}

export function getApplicationStatusesForFilter(filter: ApplicationStatusFilter): ApplicationStatus[] | null {
  if (filter === "all") return null;
  if (filter === "active") return applicationStatuses.filter((status) => status !== "closed");
  return [filter];
}

export function buildApplicationFiltersHref(
  filters: Pick<ResolvedApplicationFilters, "status" | "internshipType">,
) {
  const params = new URLSearchParams({
    status: filters.status,
    internshipType: filters.internshipType,
  });
  return `/applications?${params.toString()}`;
}
