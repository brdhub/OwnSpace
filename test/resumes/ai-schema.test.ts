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
      content: { projectCategory: "数据分析", techStack: ["SQL"], content: "整理招聘漏斗数据" },
      tags: ["数据分析", "招聘系统"],
      sourceExcerpt: "负责整理招聘漏斗数据并维护周报",
      similarEntryId: null,
    }],
  });

  assert.equal(result.success, true);
});

test("discards unknown AI response fields while preserving the resume contract", () => {
  const result = generatedCandidateResponseSchema.parse({
    candidates: [{
      type: "project",
      title: "招聘流程数据看板",
      company: "模型额外概括的字段",
      content: {
        projectCategory: "数据分析",
        techStack: ["SQL"],
        content: "整理招聘漏斗数据",
        completion: "100%",
      },
      tags: ["数据分析"],
      sourceExcerpt: "负责整理招聘漏斗数据并维护周报",
      similarEntryId: null,
    }],
    summary: "模型额外返回的说明",
  });

  assert.deepEqual(result, {
    candidates: [{
      type: "project",
      title: "招聘流程数据看板",
      content: { projectCategory: "数据分析", techStack: ["SQL"], content: "整理招聘漏斗数据" },
      tags: ["数据分析"],
      sourceExcerpt: "负责整理招聘漏斗数据并维护周报",
      similarEntryId: null,
    }],
  });
});

test("rejects a candidate without source evidence", () => {
  const result = generatedCandidateResponseSchema.safeParse({
    candidates: [{
      type: "project",
      title: "招聘流程数据看板",
      content: { projectCategory: "数据分析", techStack: ["SQL"], content: "整理招聘漏斗数据" },
      tags: ["数据分析"],
      sourceExcerpt: "",
      similarEntryId: null,
    }],
  });

  assert.equal(result.success, false);
});

test("accepts honors and rejects legacy or incomplete candidate contracts", () => {
  const honor = generatedCandidateResponseSchema.safeParse({
    candidates: [{
      type: "honor",
      title: "全国大学生竞赛",
      content: { award: "二等奖" },
      tags: [],
      sourceExcerpt: "全国大学生竞赛二等奖",
      similarEntryId: null,
    }],
  });
  const result = generatedCandidateResponseSchema.safeParse({
    candidates: [{
      type: "profile",
      title: "证书",
      content: { name: "证书" },
      tags: [],
      sourceExcerpt: "获得证书",
      similarEntryId: null,
    }],
  });
  const missingTags = generatedCandidateResponseSchema.safeParse({
    candidates: [{
      type: "project",
      title: "项目",
      content: { projectCategory: "后端", techStack: [], content: "开发接口" },
      sourceExcerpt: "开发接口",
      similarEntryId: null,
    }],
  });

  assert.equal(honor.success, true);
  assert.equal(result.success, false);
  assert.equal(missingTags.success, false);
});

test("rejects an AI skill candidate whose name cannot also be its tag", () => {
  const result = generatedCandidateResponseSchema.safeParse({
    candidates: [{
      type: "skill",
      title: "技".repeat(41),
      content: { proficiency: "熟悉", content: "能够开发服务" },
      tags: ["Java"],
      sourceExcerpt: "熟悉 Java",
      similarEntryId: null,
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
      content: { degree: "硕士", major: "计算机技术", dateRange: "2024-2027", content: "机器学习、数据库系统" },
      tags: ["计算机"],
      sourceExcerpt: "主修课程：机器学习、数据库系统",
      similarEntryId: null,
    }],
  });

  assert.deepEqual(result.candidates[0].content, { degree: "硕士", major: "计算机技术", dateRange: "2024-2027", content: "机器学习、数据库系统" });
});
