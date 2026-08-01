import assert from "node:assert/strict";
import test from "node:test";

import {
  aiOptimizationResponseSchema,
  acceptResumeCandidateSchema,
  generateResumeCandidatesSchema,
  optimizationMaterialInputSchema,
  optimizationSuggestionInputSchema,
  parseResumeEntryContent,
  resumeAssetIdSchema,
  resumeEntrySchema,
} from "../../src/features/resumes/schema";

test("validates resume asset IDs used by delete actions", () => {
  assert.equal(resumeAssetIdSchema.safeParse({ id: "1" }).success, true);
  assert.equal(resumeAssetIdSchema.safeParse({ id: "../1" }).success, false);
});

test("rejects a project entry without a title", () => {
  assert.equal(resumeEntrySchema.safeParse({ type: "project", title: "", content: {} }).success, false);
});

test("accepts a bounded project entry", () => {
  assert.equal(resumeEntrySchema.safeParse({ type: "project", title: "Multi-agent study", content: { responsibilities: "Wrote evaluation scripts" } }).success, true);
});

test("rejects an evidence-free suggestion", () => {
  assert.equal(aiOptimizationResponseSchema.safeParse({ suggestions: [{ proposedText: "Improved 80%" }] }).success, false);
});

test("parses typed persisted entry content", () => {
  assert.deepEqual(parseResumeEntryContent('{"responsibilities":"Built API"}'), { responsibilities: "Built API" });
});

test("rejects a material with both source references", () => {
  assert.equal(optimizationMaterialInputSchema.safeParse({ kind: "asset", resumeAssetId: 1, resumeEntryId: 2, snapshot: { kind: "asset", asset: { id: 1, originalName: "resume.pdf", storageKey: "resume.pdf", mimeType: "application/pdf", byteSize: 1, extractedText: "resume" } } }).success, false);
});

test("rejects caller-supplied suggestion task ownership", () => {
  assert.equal(optimizationSuggestionInputSchema.safeParse({ taskId: 2, materialId: 1, originalText: "Built the API.", proposedText: "Built the API.", rationale: "Matches the material." }).success, false);
});
test("rejects a material whose source ID differs from its snapshot ID", () => {
  assert.equal(optimizationMaterialInputSchema.safeParse({ kind: "asset", resumeAssetId: 2, snapshot: { kind: "asset", asset: { id: 1, originalName: "resume.pdf", storageKey: "resume.pdf", mimeType: "application/pdf", byteSize: 1, extractedText: "resume" } } }).success, false);
  assert.equal(optimizationMaterialInputSchema.safeParse({ kind: "entry", resumeEntryId: 2, snapshot: { kind: "entry", entry: { id: 1, type: "project", title: "Project", content: {}, tags: [], completeness: "complete" } } }).success, false);
});

test("validates explicit candidate generation replacement intent", () => {
  assert.equal(generateResumeCandidatesSchema.safeParse({ assetId: "1", replacePending: "false" }).success, true);
  assert.equal(generateResumeCandidatesSchema.safeParse({ assetId: "1", replacePending: "yes" }).success, false);
});

test("parses edited candidate structured content", () => {
  const result = acceptResumeCandidateSchema.safeParse({
    candidateId: "2",
    type: "project",
    title: "数据看板",
    contentJson: '{"responsibility":"整理招聘漏斗数据"}',
  });

  assert.equal(result.success, true);
  if (result.success) assert.deepEqual(result.data.content, { responsibility: "整理招聘漏斗数据" });
  assert.equal(acceptResumeCandidateSchema.safeParse({ candidateId: "2", type: "project", title: "数据看板", contentJson: "[]" }).success, false);
});
