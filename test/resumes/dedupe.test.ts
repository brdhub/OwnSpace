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
    content: { result: " Saved  20 hours ", duty: "Built API" },
  });
  const second = resumeEntryFingerprint({
    type: "project",
    title: "data dashboard",
    content: { duty: " built api ", result: "saved 20 HOURS" },
  });

  assert.equal(first, second);
});

test("fingerprint changes for a meaningful type, title, or content difference", () => {
  const base = { type: "project" as const, title: "Dashboard", content: { result: "Saved 20 hours" } };

  assert.notEqual(resumeEntryFingerprint(base), resumeEntryFingerprint({ ...base, type: "experience" }));
  assert.notEqual(resumeEntryFingerprint(base), resumeEntryFingerprint({ ...base, title: "Other" }));
  assert.notEqual(resumeEntryFingerprint(base), resumeEntryFingerprint({ ...base, content: { result: "Saved 21 hours" } }));
});

test("finds an exact formal entry and leaves similar content unmatched", () => {
  const entries: ResumeEntryFingerprintRecord[] = [
    { id: 1, type: "project" as const, title: "Dashboard", content: { result: "Saved 20 hours" } },
    { id: 2, type: "skill" as const, title: "SQL", content: { level: "熟练" } },
  ];

  assert.equal(findExactResumeEntry({ type: "project", title: " dashboard ", content: { result: "saved 20 HOURS" } }, entries)?.id, 1);
  assert.equal(findExactResumeEntry({ type: "project", title: "Dashboard", content: { result: "Improved efficiency" } }, entries), undefined);
});
