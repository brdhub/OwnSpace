import assert from "node:assert/strict";
import test from "node:test";
import type { RecruitmentOpportunity } from "@/db/schema";
import {
  buildApplicationDraft,
  planOpportunitySync,
} from "@/features/applications/opportunities/repository";

const opportunity: RecruitmentOpportunity = {
  id: 7,
  sourceRecordId: "rec001",
  company: "浪潮集团",
  batch: "27届秋招",
  sourceUpdatedDate: "2026-08-02",
  companyType: "国企",
  industry: "互联网,人工智能",
  roles: "服务器架构师，AI算法工程师",
  cities: "山东-济南、北京",
  unrestrictedMajor: false,
  targetAudience: "2027届毕业生",
  degree: "本科及以上",
  deadline: "2026-09-30",
  notes: "提前批",
  writtenTestWaived: true,
  announcementUrl: "https://example.com/announcement",
  applicationUrl: "https://example.com/apply",
  isActive: true,
  syncedAt: "2026-08-04T00:00:00.000Z",
  createdAt: "2026-08-04T00:00:00.000Z",
  updatedAt: "2026-08-04T00:00:00.000Z",
};

test("builds a planned application draft for favorite", () => {
  const draft = buildApplicationDraft(opportunity, "favorite", "2026-08-04");

  assert.equal(draft.status, "planned");
  assert.equal(draft.opportunityId, 7);
  assert.equal(draft.company, "浪潮集团");
  assert.equal(draft.role, "服务器架构师，AI算法工程师");
  assert.equal(draft.internshipType, "autumn");
  assert.equal(draft.companySize, "large");
  assert.equal(draft.appliedDate, "2026-08-04");
  assert.match(draft.notes, /城市：山东-济南、北京/);
});

test("builds an applied draft without losing the source association", () => {
  const draft = buildApplicationDraft(opportunity, "apply", "2026-08-04");

  assert.equal(draft.status, "applied");
  assert.equal(draft.source, "飞书秋招企业库");
  assert.equal(draft.applicationUrl, "https://example.com/apply");
  assert.equal(draft.opportunityId, 7);
});

test("plans insert, update, and deactivate sets without overlap", () => {
  assert.deepEqual(planOpportunitySync(["recA", "recB"], ["recB", "recC"]), {
    inserted: ["recC"],
    updated: ["recB"],
    deactivated: ["recA"],
  });
});
