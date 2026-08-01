import assert from "node:assert/strict";
import test from "node:test";

import {
  prepareGeneratedCandidates,
  resolveCandidateAcceptance,
} from "../../src/features/resumes/candidate-service";

const formalEntries = [
  { id: 4, type: "project" as const, title: "数据看板", content: { duty: "整理招聘数据" } },
  { id: 9, type: "experience" as const, title: "产品实习", content: { duty: "用户研究" } },
];

test("skips locally exact AI candidates and keeps semantic duplicate hints", () => {
  const prepared = prepareGeneratedCandidates([
    {
      type: "project",
      title: " 数据看板 ",
      content: { duty: "整理招聘数据" },
      sourceExcerpt: "整理招聘数据",
      similarEntryId: null,
    },
    {
      type: "experience",
      title: "用户研究实习",
      content: { duty: "完成用户访谈" },
      sourceExcerpt: "完成用户访谈",
      similarEntryId: 9,
    },
  ], formalEntries);

  assert.equal(prepared.skippedExactCount, 1);
  assert.deepEqual(prepared.candidates, [{
    type: "experience",
    title: "用户研究实习",
    content: { duty: "完成用户访谈" },
    sourceExcerpt: "完成用户访谈",
    duplicateEntryId: 9,
    duplicateKind: "similar",
  }]);
});

test("acceptance rechecks the formal vault for exact duplicates", () => {
  assert.deepEqual(resolveCandidateAcceptance({
    type: "project",
    title: "数据看板",
    content: { duty: "整理招聘数据" },
  }, formalEntries), { accepted: false, duplicateEntryId: 4 });

  assert.deepEqual(resolveCandidateAcceptance({
    type: "skill",
    title: "SQL",
    content: { level: "熟练" },
  }, formalEntries), { accepted: true });
});
