import assert from "node:assert/strict";
import test from "node:test";

import {
  aiOptimizationResponseSchema,
  optimizationMaterialInputSchema,
  optimizationSuggestionInputSchema,
  parseResumeEntryContent,
  resumeEntrySchema,
} from "../../src/features/resumes/schema";

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