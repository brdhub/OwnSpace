import assert from "node:assert/strict";
import test from "node:test";

import { extractPdfText } from "../../src/features/resumes/pdf";

test("returns an error object for unreadable PDFs", async () => {
  const result = await extractPdfText("C:/missing/not-a-pdf.pdf");

  assert.equal(result.text, "");
  assert.ok(result.error);
});
