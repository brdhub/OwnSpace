import { and, desc, eq, like, or } from "drizzle-orm";
import { applicationStatuses, type ApplicationStatus } from "@/config/application-status";
import { db } from "@/db";
import { applications } from "@/db/schema";
import { internshipTypes, type InternshipType } from "@/features/applications/constants";
import { getInterviewCountsByApplication } from "@/features/interviews/queries";

type ApplicationFilters = {
  query?: string;
  status?: string;
  internshipType?: string;
};

export async function getApplications(filters: ApplicationFilters) {
  const conditions = [];
  const query = filters.query?.trim();
  const validStatus = applicationStatuses.includes(filters.status as ApplicationStatus)
    ? (filters.status as ApplicationStatus)
    : undefined;
  const validInternshipType = internshipTypes.includes(filters.internshipType as InternshipType)
    ? (filters.internshipType as InternshipType)
    : undefined;

  if (query) {
    const pattern = `%${query}%`;
    conditions.push(or(like(applications.company, pattern), like(applications.role, pattern)));
  }

  if (validStatus) {
    conditions.push(eq(applications.status, validStatus));
  }
  if (validInternshipType) {
    conditions.push(eq(applications.internshipType, validInternshipType));
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
