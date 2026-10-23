import assert from "node:assert/strict";
import test from "node:test";
import { addHistoricalStatusSchema, applicationFormSchema, updateApplicationQuickFieldSchema, updateApplicationStatusSchema } from "@/features/applications/schemas";

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
  jobDescription: "",
  notes: "",
};

test("coerces a positive opportunity association from form data", () => {
  const parsed = applicationFormSchema.parse({ ...validApplication, opportunityId: "7" });
  assert.equal(parsed.opportunityId, 7);
});

test("rejects a non-positive opportunity association", () => {
  assert.equal(applicationFormSchema.safeParse({ ...validApplication, opportunityId: "0" }).success, false);
});

test("accepts an empty or complete optional job description", () => {
  assert.equal(applicationFormSchema.parse({ ...validApplication, jobDescription: "" }).jobDescription, "");
  assert.equal(
    applicationFormSchema.parse({ ...validApplication, jobDescription: "  负责 AI Agent 平台开发  " }).jobDescription,
    "负责 AI Agent 平台开发",
  );
  assert.equal(
    applicationFormSchema.safeParse({ ...validApplication, jobDescription: "岗".repeat(20_001) }).success,
    false,
  );
});

test("historical status entries require a real past date and a known status", () => {
  assert.equal(addHistoricalStatusSchema.safeParse({ id: 1, date: "2025-09-01", status: "applied" }).success, true);
  assert.equal(addHistoricalStatusSchema.safeParse({ id: 1, date: "2025-02-30", status: "applied" }).success, false);
  assert.equal(addHistoricalStatusSchema.safeParse({ id: 1, date: "2099-01-01", status: "applied" }).success, false);
  assert.equal(addHistoricalStatusSchema.safeParse({ id: 1, date: "2025-09-01", status: "unknown" }).success, false);
});

test("quick edits accept one valid field at a time and reject unrelated form values", () => {
  assert.equal(updateApplicationQuickFieldSchema.parse({ id: 1, field: "city", value: "  成都  " }).value, "成都");
  assert.equal(updateApplicationQuickFieldSchema.safeParse({ id: 1, field: "jobCategory", value: "backend" }).success, true);
  assert.equal(updateApplicationQuickFieldSchema.safeParse({ id: 1, field: "jobCategory", value: "unknown" }).success, false);
  assert.equal(updateApplicationQuickFieldSchema.safeParse({ id: 1, field: "city", value: "上海", status: "offer" }).success, false);
});

test("later interview rounds validate consistently for forms, quick updates, and history", () => {
  const base = { id: 1, status: "laterInterview", date: "2025-09-01" };
  for (const schema of [applicationFormSchema, updateApplicationStatusSchema, addHistoricalStatusSchema]) {
    const input = schema === applicationFormSchema ? {...validApplication, status: "laterInterview"} : schema === addHistoricalStatusSchema ? base : {id: 1, status: "laterInterview"};
    assert.equal(schema.parse({...input, interviewRound: "3"}).interviewRound, 3);
    assert.equal(schema.parse({...input, interviewRound: ""}).interviewRound, null);
    for (const interviewRound of ["1", "11", "2.5", "invalid"]) assert.equal(schema.safeParse({...input, interviewRound}).success, false);
  }
});
