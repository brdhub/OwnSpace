import assert from "node:assert/strict";
import test from "node:test";

import {
  aiOptimizationResponseSchema,
  resumeEntrySchema,
} from "../../src/features/resumes/schema";

test("rejects a project entry without a title", () => {
  assert.equal(
    resumeEntrySchema.safeParse({ type: "project", title: "", content: {} })
      .success,
    false,
  );
});

test("accepts a bounded project entry", () => {
  assert.equal(
    resumeEntrySchema.safeParse({
      type: "project",
      title: "多智能体协作研究",
      content: { responsibilities: "编写评测脚本" },
    }).success,
    true,
  );
});

test("rejects an evidence-free suggestion", () => {
  assert.equal(
    aiOptimizationResponseSchema.safeParse({
      suggestions: [{ proposedText: "提升 80%" }],
    }).success,
    false,
  );
});
