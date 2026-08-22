import assert from "node:assert/strict";
import test from "node:test";
import { getResumeCopyFields } from "../../src/features/resumes/copy-fields";

test("project copy fields expose visible values without tags or a combined copy", () => {
  assert.deepEqual(getResumeCopyFields({
    type: "project",
    title: "OwnSpace",
    content: {
      projectCategory: "个人项目",
      techStack: ["Next.js", "SQLite"],
      content: "实现本地优先求职工作台",
    },
  }), [
    { key: "title", label: "条目名称", value: "OwnSpace", multiline: false },
    { key: "projectCategory", label: "项目分类", value: "个人项目", multiline: false },
    { key: "techStack", label: "技术栈", value: "Next.js、SQLite", multiline: false },
    { key: "content", label: "项目内容", value: "实现本地优先求职工作台", multiline: true },
  ]);
});

test("every resume type exposes only its visible non-empty fields", () => {
  assert.deepEqual(getResumeCopyFields({
    type: "experience",
    title: "平台研发实习",
    content: {
      position: "后端实习生",
      techStack: ["Java", "Redis"],
      responsibilities: "负责接口开发",
      workContent: "完成缓存治理",
    },
  }), [
    { key: "title", label: "条目名称", value: "平台研发实习", multiline: false },
    { key: "position", label: "岗位", value: "后端实习生", multiline: false },
    { key: "techStack", label: "技术栈", value: "Java、Redis", multiline: false },
    { key: "responsibilities", label: "工作职责", value: "负责接口开发", multiline: true },
    { key: "workContent", label: "工作内容", value: "完成缓存治理", multiline: true },
  ]);

  assert.deepEqual(getResumeCopyFields({
    type: "education",
    title: "示例大学",
    content: { degree: "硕士", major: "计算机技术", dateRange: "2025-2028", content: "研究方向：大模型应用" },
  }), [
    { key: "title", label: "条目名称", value: "示例大学", multiline: false },
    { key: "degree", label: "学历", value: "硕士", multiline: false },
    { key: "major", label: "专业", value: "计算机技术", multiline: false },
    { key: "dateRange", label: "时间", value: "2025-2028", multiline: false },
    { key: "content", label: "教育经历", value: "研究方向：大模型应用", multiline: true },
  ]);

  assert.deepEqual(getResumeCopyFields({
    type: "skill",
    title: "Java",
    content: { proficiency: "熟练", content: "掌握并发与常用框架" },
  }), [
    { key: "title", label: "条目名称", value: "Java", multiline: false },
    { key: "proficiency", label: "掌握程度", value: "熟练", multiline: false },
    { key: "content", label: "技能说明", value: "掌握并发与常用框架", multiline: true },
  ]);

  assert.deepEqual(getResumeCopyFields({
    type: "honor",
    title: "程序设计竞赛",
    content: { award: "省级二等奖" },
  }), [
    { key: "title", label: "条目名称", value: "程序设计竞赛", multiline: false },
    { key: "award", label: "奖项 / 等级", value: "省级二等奖", multiline: false },
  ]);

  assert.deepEqual(getResumeCopyFields({
    type: "project",
    title: "仅标题",
    content: { projectCategory: "", techStack: [], content: "" },
  }), [
    { key: "title", label: "条目名称", value: "仅标题", multiline: false },
  ]);
});
