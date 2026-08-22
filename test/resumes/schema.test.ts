import assert from "node:assert/strict";
import test from "node:test";

import {
  aiOptimizationResponseSchema,
  acceptResumeCandidateSchema,
  generateResumeCandidatesSchema,
  runJdRecommendationSchema,
  runEntryOptimizationSchema,
  saveJdSelectionSchema,
  updateOptimizationSuggestionStateSchema,
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

test("accepts the exact structured content contract for every resume entry type", () => {
  const entries = [
    {
      type: "project",
      title: "Multi-agent study",
      content: { projectCategory: "AI Agent", techStack: ["TypeScript", "Python"], content: "Built evaluation workflows" },
      tags: ["多智能体", "评测"],
    },
    {
      type: "experience",
      title: "示例科技",
      content: { position: "后端开发实习生", techStack: ["Java", "MySQL"], responsibilities: "维护订单服务", workContent: "补充接口测试" },
      tags: ["后端"],
    },
    {
      type: "education",
      title: "示例大学",
      content: { degree: "硕士", major: "计算机技术", dateRange: "2024.09 - 2027.06", content: "研究方向为智能体系统" },
      tags: ["计算机"],
    },
    {
      type: "skill",
      title: "Java",
      content: { proficiency: "熟练", content: "能够使用 Spring Boot 开发服务" },
      tags: ["错误标签"],
    },
    { type: "honor", title: "全国大学生竞赛", content: { award: "二等奖" }, tags: [] },
  ];

  const parsed = entries.map((entry) => resumeEntrySchema.parse(entry));
  assert.deepEqual(parsed[0].type === "project" ? parsed[0].content.techStack : [], ["TypeScript", "Python"]);
  assert.deepEqual(parsed[3].tags, ["Java"]);
  assert.equal(parsed[4].type, "honor");
});

test("rejects legacy types, completeness, unknown content fields, and invalid proficiency", () => {
  assert.equal(resumeEntrySchema.safeParse({ type: "profile", title: "我", content: {}, tags: [] }).success, false);
  assert.equal(resumeEntrySchema.safeParse({
    type: "project",
    title: "项目",
    content: { projectCategory: "后端", techStack: [], content: "内容", duty: "旧字段" },
    tags: [],
    completeness: "complete",
  }).success, false);
  assert.equal(resumeEntrySchema.safeParse({ type: "skill", title: "Java", content: { proficiency: "大师", content: "" }, tags: [] }).success, false);
});

test("keeps skill names within the persisted tag length contract", () => {
  const fortyCharacters = "技".repeat(40);
  const fortyOneCharacters = "技".repeat(41);

  assert.equal(resumeEntrySchema.safeParse({ type: "skill", title: fortyCharacters, content: { proficiency: "熟悉", content: "" }, tags: [] }).success, true);
  assert.equal(resumeEntrySchema.safeParse({ type: "skill", title: fortyOneCharacters, content: { proficiency: "熟悉", content: "" }, tags: [] }).success, false);
});

test("rejects an evidence-free suggestion", () => {
  assert.equal(aiOptimizationResponseSchema.safeParse({ suggestions: [{ proposedText: "Improved 80%" }] }).success, false);
});

test("parses typed persisted entry content", () => {
  assert.deepEqual(parseResumeEntryContent('{"award":"二等奖"}'), { award: "二等奖" });
});

test("rejects a material with both source references", () => {
  assert.equal(optimizationMaterialInputSchema.safeParse({ kind: "asset", resumeAssetId: 1, resumeEntryId: 2, snapshot: { kind: "asset", asset: { id: 1, originalName: "resume.pdf", storageKey: "resume.pdf", mimeType: "application/pdf", byteSize: 1, extractedText: "resume" } } }).success, false);
});

test("rejects caller-supplied suggestion task ownership", () => {
  assert.equal(optimizationSuggestionInputSchema.safeParse({ taskId: 2, materialId: 1, originalText: "Built the API.", proposedText: "Built the API.", rationale: "Matches the material." }).success, false);
});
test("rejects a material whose source ID differs from its snapshot ID", () => {
  assert.equal(optimizationMaterialInputSchema.safeParse({ kind: "asset", resumeAssetId: 2, snapshot: { kind: "asset", asset: { id: 1, originalName: "resume.pdf", storageKey: "resume.pdf", mimeType: "application/pdf", byteSize: 1, extractedText: "resume" } } }).success, false);
  assert.equal(optimizationMaterialInputSchema.safeParse({ kind: "entry", resumeEntryId: 2, snapshot: { kind: "entry", entry: { id: 1, type: "project", title: "Project", content: { projectCategory: "后端", techStack: [], content: "" }, tags: [] } } }).success, false);
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
    contentJson: '{"projectCategory":"数据分析","techStack":["SQL"],"content":"整理招聘漏斗数据"}',
    tagsJson: '["数据分析"]',
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data.content, { projectCategory: "数据分析", techStack: ["SQL"], content: "整理招聘漏斗数据" });
    assert.deepEqual(result.data.tags, ["数据分析"]);
  }
  assert.equal(acceptResumeCandidateSchema.safeParse({ candidateId: "2", type: "project", title: "数据看板", contentJson: "[]", tagsJson: "[]" }).success, false);
});

test("returns a validation failure when candidate type and content do not match", () => {
  const mismatched = {
    candidateId: "2",
    type: "honor",
    title: "竞赛奖项",
    contentJson: '{"projectCategory":"后端","techStack":[],"content":"开发服务"}',
    tagsJson: "[]",
  };

  assert.doesNotThrow(() => acceptResumeCandidateSchema.safeParse(mismatched));
  assert.equal(acceptResumeCandidateSchema.safeParse(mismatched).success, false);
});

test("requires a target role and confirmed JD for AI recommendations", () => {
  assert.equal(runJdRecommendationSchema.safeParse({ targetRole: "产品经理", jdText: "负责用户研究" }).success, true);
  assert.equal(runJdRecommendationSchema.safeParse({ targetRole: "产品经理", jdText: "" }).success, false);
});

test("accepts only a positive optional application source for JD matching", () => {
  const base = { targetRole: "后端开发实习生", jdText: "负责服务端研发" };
  assert.equal(runJdRecommendationSchema.parse({ ...base, applicationId: "8" }).applicationId, 8);
  assert.equal(runJdRecommendationSchema.parse(base).applicationId, undefined);
  assert.equal(runJdRecommendationSchema.safeParse({ ...base, applicationId: "0" }).success, false);
});

test("parses unique selected entry IDs", () => {
  const result = saveJdSelectionSchema.safeParse({ taskId: "3", selectedEntryIdsJson: "[4,7]" });
  assert.equal(result.success, true);
  if (result.success) assert.deepEqual(result.data.selectedEntryIds, [4, 7]);
  assert.equal(saveJdSelectionSchema.safeParse({ taskId: "3", selectedEntryIdsJson: "[4,4]" }).success, false);
});

test("validates description optimization task IDs", () => {
  assert.equal(runEntryOptimizationSchema.safeParse({ taskId: "3" }).success, true);
  assert.equal(runEntryOptimizationSchema.safeParse({ taskId: "0" }).success, false);
});

test("only accepts terminal optimization suggestion states", () => {
  assert.equal(updateOptimizationSuggestionStateSchema.safeParse({ suggestionId: "2", state: "accepted" }).success, true);
  assert.equal(updateOptimizationSuggestionStateSchema.safeParse({ suggestionId: "2", state: "pending" }).success, false);
});
