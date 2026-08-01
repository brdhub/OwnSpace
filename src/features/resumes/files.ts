import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

export const RESUME_ASSET_DIRECTORY = resolve(process.cwd(), "data", "resume-assets");
export const MAX_RESUME_PDF_BYTES = 10 * 1024 * 1024;

type SavedResumePdf = {
  storageKey: string;
  byteSize: number;
};

function validateResumePdf(file: File) {
  if (file.type !== "application/pdf") {
    throw new Error("Only PDF files can be uploaded.");
  }

  if (file.size === 0) {
    throw new Error("The PDF file is empty.");
  }

  if (file.size > MAX_RESUME_PDF_BYTES) {
    throw new Error("The PDF file must be 10 MB or smaller.");
  }
}

export async function saveResumePdf(file: File): Promise<SavedResumePdf> {
  validateResumePdf(file);

  const storageKey = `${randomUUID()}.pdf`;
  await mkdir(RESUME_ASSET_DIRECTORY, { recursive: true });
  await writeFile(resolve(RESUME_ASSET_DIRECTORY, storageKey), Buffer.from(await file.arrayBuffer()));

  return { storageKey, byteSize: file.size };
}
