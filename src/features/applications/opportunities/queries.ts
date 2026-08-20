import "server-only";

import { and, desc, eq, like, max, or } from "drizzle-orm";
import { db } from "@/db";
import { applications, recruitmentOpportunities } from "@/db/schema";
import type { OpportunityFilters } from "@/features/applications/opportunities/schemas";

export async function getRecruitmentOpportunities(filters: OpportunityFilters) {
  const conditions = [eq(recruitmentOpportunities.isActive, true)];
  if (filters.query) {
    const pattern = `%${filters.query}%`;
    conditions.push(or(like(recruitmentOpportunities.company, pattern), like(recruitmentOpportunities.roles, pattern))!);
  }
  if (filters.companyType) {
    conditions.push(eq(recruitmentOpportunities.companyType, filters.companyType));
  }
  if (filters.city) {
    conditions.push(like(recruitmentOpportunities.cities, `%${filters.city}%`));
  }
  if (filters.unrestrictedMajor === "true") {
    conditions.push(eq(recruitmentOpportunities.unrestrictedMajor, true));
  }

  return db
    .select({
      id: recruitmentOpportunities.id,
      sourceRecordId: recruitmentOpportunities.sourceRecordId,
      company: recruitmentOpportunities.company,
      batch: recruitmentOpportunities.batch,
      sourceUpdatedDate: recruitmentOpportunities.sourceUpdatedDate,
      companyType: recruitmentOpportunities.companyType,
      industry: recruitmentOpportunities.industry,
      roles: recruitmentOpportunities.roles,
      cities: recruitmentOpportunities.cities,
      unrestrictedMajor: recruitmentOpportunities.unrestrictedMajor,
      targetAudience: recruitmentOpportunities.targetAudience,
      degree: recruitmentOpportunities.degree,
      deadline: recruitmentOpportunities.deadline,
      notes: recruitmentOpportunities.notes,
      writtenTestWaived: recruitmentOpportunities.writtenTestWaived,
      announcementUrl: recruitmentOpportunities.announcementUrl,
      applicationUrl: recruitmentOpportunities.applicationUrl,
      isActive: recruitmentOpportunities.isActive,
      syncedAt: recruitmentOpportunities.syncedAt,
      createdAt: recruitmentOpportunities.createdAt,
      updatedAt: recruitmentOpportunities.updatedAt,
      applicationId: applications.id,
      applicationStatus: applications.status,
    })
    .from(recruitmentOpportunities)
    .leftJoin(applications, eq(applications.opportunityId, recruitmentOpportunities.id))
    .where(and(...conditions))
    .orderBy(desc(recruitmentOpportunities.sourceUpdatedDate), recruitmentOpportunities.company);
}

export async function getOpportunityPageMeta() {
  const [types, cityRows, syncRow] = await Promise.all([
    db
      .selectDistinct({ value: recruitmentOpportunities.companyType })
      .from(recruitmentOpportunities)
      .where(eq(recruitmentOpportunities.isActive, true)),
    db
      .selectDistinct({ value: recruitmentOpportunities.cities })
      .from(recruitmentOpportunities)
      .where(eq(recruitmentOpportunities.isActive, true)),
    db.select({ value: max(recruitmentOpportunities.syncedAt) }).from(recruitmentOpportunities).get(),
  ]);

  const cities = new Set<string>();
  for (const row of cityRows) {
    for (const city of row.value.split("、").map((item) => item.trim()).filter(Boolean)) cities.add(city);
  }

  return {
    companyTypes: types.map((item) => item.value).filter(Boolean).sort((left, right) => left.localeCompare(right, "zh-CN")),
    cities: [...cities].sort((left, right) => left.localeCompare(right, "zh-CN")),
    lastSyncedAt: syncRow?.value ?? null,
  };
}

export type RecruitmentOpportunityListItem = Awaited<ReturnType<typeof getRecruitmentOpportunities>>[number];
