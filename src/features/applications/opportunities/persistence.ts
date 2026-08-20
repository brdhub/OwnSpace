import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { applications, recruitmentOpportunities } from "@/db/schema";
import { buildApplicationDraft, planOpportunitySync } from "@/features/applications/opportunities/repository";
import type { FeishuOpportunitySnapshot } from "@/features/applications/opportunities/types";

export function syncRecruitmentOpportunities(snapshot: FeishuOpportunitySnapshot) {
  if (snapshot.opportunities.length === 0) {
    throw new Error("飞书秋招视图没有可同步记录，已保留原有数据。");
  }

  return db.transaction((tx) => {
    const existing = tx
      .select({ sourceRecordId: recruitmentOpportunities.sourceRecordId })
      .from(recruitmentOpportunities)
      .all();
    const incomingIds = snapshot.opportunities.map((item) => item.sourceRecordId);
    const plan = planOpportunitySync(existing.map((item) => item.sourceRecordId), incomingIds);
    const now = snapshot.fetchedAt;

    tx.update(recruitmentOpportunities)
      .set({ isActive: false, updatedAt: now })
      .run();

    for (const item of snapshot.opportunities) {
      tx.insert(recruitmentOpportunities)
        .values({
          ...item,
          isActive: true,
          syncedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: recruitmentOpportunities.sourceRecordId,
          set: {
            company: item.company,
            batch: item.batch,
            sourceUpdatedDate: item.sourceUpdatedDate,
            companyType: item.companyType,
            industry: item.industry,
            roles: item.roles,
            cities: item.cities,
            unrestrictedMajor: item.unrestrictedMajor,
            targetAudience: item.targetAudience,
            degree: item.degree,
            deadline: item.deadline,
            notes: item.notes,
            writtenTestWaived: item.writtenTestWaived,
            announcementUrl: item.announcementUrl,
            applicationUrl: item.applicationUrl,
            isActive: true,
            syncedAt: now,
            updatedAt: now,
          },
        })
        .run();
    }

    return {
      inserted: plan.inserted.length,
      updated: plan.updated.length,
      deactivated: plan.deactivated.length,
      active: snapshot.opportunities.length,
      syncedAt: now,
    };
  });
}

export function favoriteOpportunity(opportunityId: number, appliedDate: string) {
  return db.transaction((tx) => {
    const opportunity = tx
      .select()
      .from(recruitmentOpportunities)
      .where(eq(recruitmentOpportunities.id, opportunityId))
      .get();
    if (!opportunity?.isActive) {
      throw new Error("该企业当前不在开放列表中。");
    }

    const draft = buildApplicationDraft(opportunity, "favorite", appliedDate);
    const existing = tx
      .select({ id: applications.id })
      .from(applications)
      .where(eq(applications.opportunityId, opportunityId))
      .get();
    const now = new Date().toISOString();

    if (existing) {
      tx.update(applications)
        .set({ ...draft, updatedAt: now })
        .where(eq(applications.id, existing.id))
        .run();
      return { applicationId: existing.id, created: false };
    }

    const created = tx
      .insert(applications)
      .values({ ...draft, createdAt: now, updatedAt: now })
      .returning({ id: applications.id })
      .get();
    return { applicationId: created.id, created: true };
  });
}
