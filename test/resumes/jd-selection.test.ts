import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultSelectedEntryIds,
  reconcileSelectedEntryIds,
} from "../../src/features/resumes/jd-selection";

const recommendations = [
  { entryId: 1, level: "high" as const, reason: "直接匹配" },
  { entryId: 2, level: "medium" as const, reason: "部分匹配" },
  { entryId: 3, level: "low" as const, reason: "弱相关" },
];

test("fresh recommendations select only high matches", () => {
  assert.deepEqual(defaultSelectedEntryIds(recommendations), [1]);
});

test("saved selection wins and removes entries no longer in the result", () => {
  assert.deepEqual(reconcileSelectedEntryIds(recommendations, [2, 99]), [2]);
});
