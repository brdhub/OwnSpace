import assert from "node:assert/strict";
import test from "node:test";
import { applicationFormSchema } from "@/features/applications/schemas";

const validApplication = {
  company: "浪潮集团",
  role: "AI算法工程师",
  source: "飞书秋招企业库",
  status: "applied",
  internshipType: "autumn",
  companySize: "large",
  appliedDate: "2026-08-04",
  interviewTime: "",
  applicationUrl: "https://example.com/apply",
  notes: "",
};

test("coerces a positive opportunity association from form data", () => {
  const parsed = applicationFormSchema.parse({ ...validApplication, opportunityId: "7" });
  assert.equal(parsed.opportunityId, 7);
});

test("rejects a non-positive opportunity association", () => {
  assert.equal(applicationFormSchema.safeParse({ ...validApplication, opportunityId: "0" }).success, false);
});
