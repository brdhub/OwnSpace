import assert from "node:assert/strict";
import test from "node:test";

import {
  findExactResumeEntry,
  resumeEntryFingerprint,
  type ResumeEntryFingerprintRecord,
} from "../../src/features/resumes/dedupe";

test("fingerprint ignores whitespace, case, and object key order", () => {
  const first = resumeEntryFingerprint({
    type: "project",
    title: " Data Dashboard ",
    content: { projectCategory: " Backend ", techStack: ["TypeScript", "SQL"], content: " Saved  20 hours " },
  });
  const second = resumeEntryFingerprint({
    type: "project",
    title: "data dashboard",
    content: { content: "saved 20 HOURS", techStack: ["typescript", "sql"], projectCategory: "backend" },
  });

  assert.equal(first, second);
});

test("fingerprint changes for a meaningful type, title, or content difference", () => {
  const base = { type: "project" as const, title: "Dashboard", content: { projectCategory: "数据", techStack: ["SQL"], content: "Saved 20 hours" } };

  assert.notEqual(resumeEntryFingerprint(base), resumeEntryFingerprint({ type: "experience", title: base.title, content: { position: "实习生", techStack: ["SQL"], responsibilities: "数据", workContent: "Saved 20 hours" } }));
  assert.notEqual(resumeEntryFingerprint(base), resumeEntryFingerprint({ ...base, title: "Other" }));
  assert.notEqual(resumeEntryFingerprint(base), resumeEntryFingerprint({ ...base, content: { ...base.content, content: "Saved 21 hours" } }));
});

test("finds an exact formal entry and leaves similar content unmatched", () => {
  const entries: ResumeEntryFingerprintRecord[] = [
    { id: 1, type: "project" as const, title: "Dashboard", content: { projectCategory: "数据", techStack: ["SQL"], content: "Saved 20 hours" } },
    { id: 2, type: "skill" as const, title: "SQL", content: { proficiency: "熟练", content: "复杂查询" } },
  ];

  assert.equal(findExactResumeEntry({ type: "project", title: " dashboard ", content: { projectCategory: "数据", techStack: ["sql"], content: "saved 20 HOURS" } }, entries)?.id, 1);
  assert.equal(findExactResumeEntry({ type: "project", title: "Dashboard", content: { projectCategory: "数据", techStack: ["SQL"], content: "Improved efficiency" } }, entries), undefined);
});
