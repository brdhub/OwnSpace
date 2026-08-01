import assert from "node:assert/strict";
import test from "node:test";

import { saveResumePdf } from "../../src/features/resumes/files";

test("rejects a non-PDF upload", async () => {
  await assert.rejects(
    () => saveResumePdf(new File(["x"], "resume.png", { type: "image/png" })),
    /PDF/,
  );
});
