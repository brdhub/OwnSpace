import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  deleteResumePdf,
  MAX_RESUME_PDF_BYTES,
  RESUME_ASSET_DIRECTORY,
  saveResumePdf,
} from "../../src/features/resumes/files";

const validPdf = "%PDF-1.4\nnot a complete PDF";

async function removeSavedFiles(storageKeys: string[]) {
  await Promise.all(storageKeys.map((storageKey) => rm(resolve(RESUME_ASSET_DIRECTORY, storageKey), { force: true })));
}

test("rejects a non-PDF upload", async () => {
  await assert.rejects(
    () => saveResumePdf(new File(["x"], "resume.png", { type: "image/png" })),
    /PDF/,
  );
});

test("rejects a file that only claims to be a PDF", async () => {
  await assert.rejects(
    () => saveResumePdf(new File(["not a PDF"], "resume.pdf", { type: "application/pdf" })),
    /valid PDF/,
  );
});

test("rejects PDFs larger than 10 MB", async () => {
  await assert.rejects(
    () => saveResumePdf(new File([new Uint8Array(MAX_RESUME_PDF_BYTES + 1)], "large.pdf", { type: "application/pdf" })),
    /10 MB/,
  );
});

test("stores each accepted PDF under a unique .pdf key", async () => {
  const first = await saveResumePdf(new File([validPdf], "resume.pdf", { type: "application/pdf" }));
  const second = await saveResumePdf(new File([validPdf], "resume.pdf", { type: "application/pdf" }));

  try {
    assert.match(first.storageKey, /^[0-9a-f-]+\.pdf$/);
    assert.match(second.storageKey, /^[0-9a-f-]+\.pdf$/);
    assert.notEqual(first.storageKey, second.storageKey);
    assert.equal((await readFile(resolve(RESUME_ASSET_DIRECTORY, first.storageKey))).toString(), validPdf);
  } finally {
    await removeSavedFiles([first.storageKey, second.storageKey]);
  }
});

test("deletes a stored resume PDF", async () => {
  const saved = await saveResumePdf(new File([validPdf], "resume.pdf", { type: "application/pdf" }));

  await deleteResumePdf(saved.storageKey);

  await assert.rejects(() => readFile(resolve(RESUME_ASSET_DIRECTORY, saved.storageKey)), /ENOENT/);
});

test("rejects an unsafe resume PDF storage key", async () => {
  await assert.rejects(() => deleteResumePdf("../resume.pdf"), /storage key/);
});
