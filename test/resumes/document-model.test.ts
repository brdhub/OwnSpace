import assert from "node:assert/strict";
import test from "node:test";

import {
  buildResumeDocument,
  readResumeDocument,
  type ResumeDocument,
} from "../../src/features/resumes/documents/model";

test("buildResumeDocument uses only accepted suggestions from the task input revision", () => {
  const document = buildResumeDocument({
    task: { targetRole: "后端开发实习生", jdText: "负责 API 开发", inputRevision: 3 },
    materials: [
      {
        id: 11,
        snapshotJson: JSON.stringify({
          kind: "entry",
          entry: {
            id: 101,
            type: "project",
            title: "课程平台",
            content: { projectCategory: "个人项目", techStack: ["TypeScript", "SQLite"], content: "原始描述" },
            tags: ["后端"],
          },
        }),
      },
      {
        id: 12,
        snapshotJson: JSON.stringify({
          kind: "entry",
          entry: {
            id: 102,
            type: "experience",
            title: "示例公司",
            content: { position: "开发实习生", techStack: ["Java"], responsibilities: "原职责", workContent: "原工作" },
            tags: [],
          },
        }),
      },
    ],
    suggestions: [
      {
        id: 201,
        materialId: 11,
        inputRevision: 3,
        state: "accepted",
        proposedText: JSON.stringify({
          projectCategory: "个人项目",
          techStack: ["TypeScript", "SQLite"],
          content: "优化后的描述",
        }),
      },
      {
        id: 202,
        materialId: 12,
        inputRevision: 2,
        state: "accepted",
        proposedText: JSON.stringify({
          position: "开发实习生",
          techStack: ["Java"],
          responsibilities: "过期职责",
          workContent: "过期工作",
        }),
      },
    ],
  });

  assert.deepEqual(document.sections.map((section) => section.type), [
    "education",
    "skill",
    "project",
    "experience",
    "honor",
  ]);
  assert.deepEqual(document.sections[2].items[0], {
    id: "entry-101",
    title: "课程平台",
    organization: "",
    role: "个人项目",
    dateRange: "",
    link: "",
    body: "技术栈：TypeScript、SQLite\n项目内容：优化后的描述",
    hidden: false,
    sourceEntryId: 101,
    sourceSuggestionId: 201,
  });
  assert.equal(document.sections[3].items[0].body, "技术栈：Java\n原职责\n原工作");
  assert.equal(document.sections[3].items[0].organization, "示例公司");
  assert.equal(document.sections[3].items[0].role, "开发实习生");
  assert.equal(document.sections[3].items[0].sourceSuggestionId, null);
});

test("readResumeDocument validates current snapshots and returns a detached value", () => {
  const source: ResumeDocument = {
    schemaVersion: 1,
    templateVersion: "classic-v1",
    targetRole: "全栈开发",
    jdText: "",
    profile: { name: "张三", phone: "13800138000", email: "", city: "上海", link: "" },
    sections: [],
  };

  const result = readResumeDocument(JSON.stringify(source));
  assert.deepEqual(result, source);
  assert.notEqual(result, source);
  assert.throws(() => readResumeDocument('{"schemaVersion":1,"templateVersion":"unknown"}'));
});

test("readResumeDocument converts the historical accepted-suggestions snapshot", () => {
  const result = readResumeDocument(
    JSON.stringify({ suggestions: [{ materialId: 7, proposedText: "历史优化描述" }] }),
    { targetRole: "Java 开发", jdText: "历史 JD" },
  );

  assert.equal(result.targetRole, "Java 开发");
  assert.equal(result.jdText, "历史 JD");
  assert.deepEqual(result.sections[0].items[0], {
    id: "legacy-material-7",
    title: "历史素材 7",
    organization: "",
    role: "",
    dateRange: "",
    link: "",
    body: "历史优化描述",
    hidden: false,
    sourceEntryId: null,
    sourceSuggestionId: null,
  });
});

test("readResumeDocument rejects duplicate section and item identities", () => {
  const item = {
    id: "duplicate-item",
    title: "项目",
    organization: "",
    role: "",
    dateRange: "",
    link: "",
    body: "描述",
    hidden: false,
    sourceEntryId: null,
    sourceSuggestionId: null,
  };
  const common = {
    schemaVersion: 1,
    templateVersion: "classic-v1",
    targetRole: "后端开发",
    jdText: "",
    profile: { name: "", phone: "", email: "", city: "", link: "" },
  };

  assert.throws(() => readResumeDocument(JSON.stringify({
    ...common,
    sections: [
      { id: "same", type: "project", title: "项目", hidden: false, items: [] },
      { id: "same", type: "skill", title: "技能", hidden: false, items: [] },
    ],
  })));
  assert.throws(() => readResumeDocument(JSON.stringify({
    ...common,
    sections: [
      { id: "one", type: "project", title: "项目", hidden: false, items: [item] },
      { id: "two", type: "skill", title: "技能", hidden: false, items: [item] },
    ],
  })));
});

test("valid experience projects remain complete when the combined document body exceeds 10000 characters", () => {
  const content = { position: '开发', techStack: [], responsibilities: '责'.repeat(4000), workContent: '工'.repeat(4000),
    projects: [{ name: '项目', content: '项'.repeat(3000), responsibilities: '本人负责接口' }] };
  const document = buildResumeDocument({ task: { targetRole: '后端', jdText: '', inputRevision: 1 }, suggestions: [],
    materials: [{ id: 1, snapshotJson: JSON.stringify({ kind: 'entry', entry: { id: 1, type: 'experience', title: '实习', tags: [], content } }) }] });
  const body = document.sections.find(section => section.type === 'experience')!.items[0].body;
  assert.ok(body.length > 10000);
  assert.ok(body.includes(content.responsibilities));
  assert.ok(body.includes(content.workContent));
  assert.ok(body.includes(content.projects[0].content));
  assert.deepEqual(readResumeDocument(JSON.stringify(document)), document);
});
