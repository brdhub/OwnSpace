import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCandidatePrompt,
  buildJdRecommendationPrompt,
} from "../../src/features/resumes/prompts";

test("candidate prompt contains only selected PDF text and formal entry summaries", () => {
  const messages = buildCandidatePrompt({
    extractedText: "SELECTED_PDF_TEXT",
    formalEntries: [{ id: 7, type: "project", title: "已有项目", content: { projectCategory: "后端", techStack: ["Java"], content: "节省时间" }, tags: ["后端"] }],
  });
  const serialized = JSON.stringify(messages);

  assert.match(serialized, /SELECTED_PDF_TEXT/);
  assert.match(serialized, /已有项目/);
  assert.doesNotMatch(serialized, /storageKey|originalName|apiKey|pendingCandidates/);
  assert.match(serialized.toLowerCase(), /json/);
  assert.match(serialized, /honor/);
  assert.match(serialized, /tags/);
});

test("JD prompt contains confirmed JD and formal entries without PDF text", () => {
  const messages = buildJdRecommendationPrompt({
    targetRole: "产品经理",
    jdText: "CONFIRMED_JD_TEXT",
    formalEntries: [{ id: 11, type: "experience", title: "示例科技", content: { position: "产品实习生", techStack: [], responsibilities: "用户调研", workContent: "完成访谈" }, tags: ["用户研究"] }],
  });
  const serialized = JSON.stringify(messages);
  const userPayload = JSON.parse(messages[1].content);

  assert.match(serialized, /产品经理/);
  assert.match(serialized, /CONFIRMED_JD_TEXT/);
  assert.equal(userPayload.formalEntries[0].id, 11);
  assert.doesNotMatch(serialized, /extractedText|sourceExcerpt|resumeAsset/);
  assert.match(serialized.toLowerCase(), /json/);
});
