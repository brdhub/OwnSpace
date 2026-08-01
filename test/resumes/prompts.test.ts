import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCandidatePrompt,
  buildJdRecommendationPrompt,
} from "../../src/features/resumes/prompts";

test("candidate prompt contains only selected PDF text and formal entry summaries", () => {
  const messages = buildCandidatePrompt({
    extractedText: "SELECTED_PDF_TEXT",
    formalEntries: [{ id: 7, type: "project", title: "已有项目", content: { result: "节省时间" } }],
  });
  const serialized = JSON.stringify(messages);

  assert.match(serialized, /SELECTED_PDF_TEXT/);
  assert.match(serialized, /已有项目/);
  assert.doesNotMatch(serialized, /storageKey|originalName|apiKey|pendingCandidates/);
  assert.match(serialized.toLowerCase(), /json/);
});

test("JD prompt contains confirmed JD and formal entries without PDF text", () => {
  const messages = buildJdRecommendationPrompt({
    targetRole: "产品经理",
    jdText: "CONFIRMED_JD_TEXT",
    formalEntries: [{ id: 11, type: "experience", title: "实习经历", content: { responsibility: "用户调研" } }],
  });
  const serialized = JSON.stringify(messages);
  const userPayload = JSON.parse(messages[1].content);

  assert.match(serialized, /产品经理/);
  assert.match(serialized, /CONFIRMED_JD_TEXT/);
  assert.equal(userPayload.formalEntries[0].id, 11);
  assert.doesNotMatch(serialized, /extractedText|sourceExcerpt|resumeAsset/);
  assert.match(serialized.toLowerCase(), /json/);
});
