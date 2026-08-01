import assert from "node:assert/strict";
import test from "node:test";

import { saveResumeAssetWithExtraction, type ResumeAssetDraft } from "../../src/features/resumes/asset-upload";

test("persists an asset record when PDF text extraction fails", async () => {
  const inserted: ResumeAssetDraft[] = [];
  const file = new File(["%PDF-1.4"], "resume.pdf", { type: "application/pdf" });

  const asset = await saveResumeAssetWithExtraction(file, {
    savePdf: async () => ({ storageKey: "resume-key.pdf", byteSize: file.size }),
    extractText: async () => ({ text: "", error: "Unreadable PDF" }),
    toStoragePath: (storageKey) => `C:/assets/${storageKey}`,
    insertAsset: async (draft) => { inserted.push(draft); },
    now: () => "2026-08-01T00:00:00.000Z",
  });

  assert.equal(inserted.length, 1);
  assert.deepEqual(asset, inserted[0]);
  assert.equal(asset.parseStatus, "failed");
  assert.equal(asset.parseError, "Unreadable PDF");
  assert.equal(asset.extractedText, "");
});
