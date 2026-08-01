import assert from "node:assert/strict";
import test from "node:test";

import {
  generatedCandidateResponseSchema,
  jdRecommendationResponseSchema,
} from "../../src/features/resumes/ai-schema";

test("accepts evidence-backed structured candidates", () => {
  const result = generatedCandidateResponseSchema.safeParse({
    candidates: [{
      type: "project",
      title: "招聘流程数据看板",
      content: { responsibility: "整理招聘漏斗数据" },
      sourceExcerpt: "负责整理招聘漏斗数据并维护周报",
      similarEntryId: null,
    }],
  });

  assert.equal(result.success, true);
});

test("rejects a candidate without source evidence", () => {
  const result = generatedCandidateResponseSchema.safeParse({
    candidates: [{
      type: "project",
      title: "招聘流程数据看板",
      content: { responsibility: "整理招聘漏斗数据" },
      sourceExcerpt: "",
      similarEntryId: null,
    }],
  });

  assert.equal(result.success, false);
});

test("rejects candidate fields outside the response contract", () => {
  const result = generatedCandidateResponseSchema.safeParse({
    candidates: [{
      type: "certificate",
      title: "证书",
      content: { name: "证书" },
      sourceExcerpt: "获得证书",
      similarEntryId: null,
      invented: true,
    }],
  });

  assert.equal(result.success, false);
});

test("accepts unique JD recommendations", () => {
  const result = jdRecommendationResponseSchema.safeParse({
    recommendations: [
      { entryId: 1, level: "high", reason: "直接覆盖岗位要求的数据分析能力" },
      { entryId: 2, level: "medium", reason: "能补充跨团队沟通证据" },
    ],
  });

  assert.equal(result.success, true);
});

test("rejects duplicate IDs and unsupported JD match levels", () => {
  const duplicate = jdRecommendationResponseSchema.safeParse({
    recommendations: [
      { entryId: 1, level: "high", reason: "匹配" },
      { entryId: 1, level: "low", reason: "重复" },
    ],
  });
  const unsupported = jdRecommendationResponseSchema.safeParse({
    recommendations: [{ entryId: 1, level: "perfect", reason: "匹配" }],
  });

  assert.equal(duplicate.success, false);
  assert.equal(unsupported.success, false);
});

test("normalizes list-valued candidate content returned by DeepSeek", () => {
  const result = generatedCandidateResponseSchema.parse({
    candidates: [{
      type: "education",
      title: "硕士研究生",
      content: { courses: ["机器学习", "数据库系统"] },
      sourceExcerpt: "主修课程：机器学习、数据库系统",
      similarEntryId: null,
    }],
  });

  assert.deepEqual(result.candidates[0].content, { courses: "机器学习\n数据库系统" });
});
