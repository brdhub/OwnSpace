import { and, desc, eq, inArray, like, or } from "drizzle-orm";
import { applicationStatuses } from "@/config/application-status";
import { db } from "@/db";
import { applications } from "@/db/schema";
import { internshipTypes } from "@/features/applications/constants";
import { getApplicationStatusesForFilter, type ResolvedApplicationFilters } from "@/features/applications/filters";
import { getInterviewCountsByApplication } from "@/features/interviews/queries";
import type { ApplicationAiContext, ApplicationJdContext } from "@/features/applications/jd-context";

export async function getApplications(filters: ResolvedApplicationFilters) {
  const conditions = [];
  const query = filters.query.trim();
  const includedStatuses = getApplicationStatusesForFilter(filters.status);

  if (query) {
    const pattern = `%${query}%`;
    conditions.push(or(like(applications.company, pattern), like(applications.role, pattern)));
  }

  if (includedStatuses) {
    conditions.push(inArray(applications.status, includedStatuses));
  }
  if (filters.internshipType !== "all") {
    conditions.push(inArray(applications.internshipType, [filters.internshipType]));
  }

  const rows = await db
    .select()
    .from(applications)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(applications.appliedDate), desc(applications.updatedAt));

  const interviewCounts = await getInterviewCountsByApplication();
  return rows.map((row) => ({
    ...row,
    interviewCount: interviewCounts[row.id] ?? 0,
  }));
}

export async function getApplicationStats() {
  const rows = await db
    .select({ status: applications.status, internshipType: applications.internshipType })
    .from(applications);

  return {
    statusStats: applicationStatuses.map((status) => ({
      status,
      count: rows.filter((row) => row.status === status).length,
    })),
    internshipTypeStats: internshipTypes.map((internshipType) => ({
      internshipType,
      count: rows.filter((row) => row.internshipType === internshipType).length,
    })),
  };
}

export async function getApplicationJdContext(applicationId: number): Promise<ApplicationJdContext | null> {
  const row = await db.select({
    id: applications.id,
    company: applications.company,
    role: applications.role,
    jobDescription: applications.jobDescription,
  }).from(applications).where(eq(applications.id, applicationId)).get();

  if (!row?.jobDescription.trim()) return null;
  return row;
}

export async function getApplicationAiContext(applicationId: number): Promise<ApplicationAiContext | null> {
  return await db.select({
    id: applications.id,
    company: applications.company,
    role: applications.role,
  }).from(applications).where(eq(applications.id, applicationId)).get() ?? null;
}
