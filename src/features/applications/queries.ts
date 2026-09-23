import { and, desc, eq, inArray, isNull, notInArray, like, or } from "drizzle-orm";
import { applicationStatuses } from "@/config/application-status";
import { db } from "@/db";
import { applications, resumeAssets } from "@/db/schema";
import { internshipTypes, applicationCities } from "@/features/applications/constants";
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

  if (filters.city === "missing") conditions.push(isNull(applications.city));
  else if (filters.city === "other") conditions.push(notInArray(applications.city, [...applicationCities]));
  else if (filters.city && filters.city !== "all") conditions.push(eq(applications.city, filters.city));
  if (filters.jobCategory === "missing") conditions.push(isNull(applications.jobCategory));
  else if (filters.jobCategory && filters.jobCategory !== "all") conditions.push(eq(applications.jobCategory, filters.jobCategory));

  const rows = await db
    .select({ application: applications, resumeAssetName: resumeAssets.originalName })
    .from(applications)
    .leftJoin(resumeAssets, eq(applications.resumeAssetId, resumeAssets.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(applications.appliedDate), desc(applications.updatedAt));

  const interviewCounts = await getInterviewCountsByApplication();
  return rows.map((row) => ({
    ...row.application,
    resumeAssetName: row.resumeAssetName,
    interviewCount: interviewCounts[row.application.id] ?? 0,
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
