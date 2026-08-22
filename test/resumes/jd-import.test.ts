import assert from "node:assert/strict";
import test from "node:test";
import { resolveJdImportState } from "../../src/features/resumes/jd-import";

const context = {
  id: 7,
  company: "示例科技",
  role: "后端开发实习生",
  jobDescription: "负责服务端研发与性能优化",
};

test("restores the newest task snapshot linked to an application", () => {
  const result = resolveJdImportState([
    { id: 3, applicationId: 7, targetRole: "旧岗位", jdText: "旧 JD", updatedAt: "2026-08-20 10:00:00" },
    { id: 5, applicationId: 7, targetRole: "快照岗位", jdText: "快照 JD", updatedAt: "2026-08-22 10:00:00" },
    { id: 9, applicationId: 8, targetRole: "其他岗位", jdText: "其他 JD", updatedAt: "2026-08-23 10:00:00" },
  ], context);

  assert.deepEqual(result, { activeTaskId: 5, targetRole: "快照岗位", jdText: "快照 JD" });
});

test("prefills a new task from the application when there is no linked task", () => {
  assert.deepEqual(resolveJdImportState([], context), {
    activeTaskId: null,
    targetRole: "后端开发实习生",
    jdText: "负责服务端研发与性能优化",
  });
});

test("returns a blank state without an application context", () => {
  assert.deepEqual(resolveJdImportState([], null), { activeTaskId: null, targetRole: "", jdText: "" });
});
