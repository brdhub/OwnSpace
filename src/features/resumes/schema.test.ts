import assert from "node:assert/strict";
import test from "node:test";

import { resumeEntrySchema } from "./schema";

test("rejects a project entry without a title", () => {
  assert.equal(
    resumeEntrySchema.safeParse({ type: "project", title: "", content: {} })
      .success,
    false,
  );
});
