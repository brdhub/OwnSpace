import type { ResumeAsset } from "@/db/schema";
import type { SavedResumePdf } from "@/features/resumes/files";
import type { PdfTextExtractionResult } from "@/features/resumes/pdf";

export type ResumeAssetDraft = Pick<
  ResumeAsset,
  "originalName" | "storageKey" | "mimeType" | "byteSize" | "extractedText" | "parseStatus" | "parseError" | "createdAt" | "updatedAt"
>;

type ResumeAssetUploadDependencies = {
  savePdf: (file: File) => Promise<SavedResumePdf>;
  extractText: (path: string) => Promise<PdfTextExtractionResult>;
  toStoragePath: (storageKey: string) => string;
  insertAsset: (asset: ResumeAssetDraft) => Promise<void>;
  now: () => string;
};

export async function saveResumeAssetWithExtraction(
  file: File,
  dependencies: ResumeAssetUploadDependencies,
): Promise<ResumeAssetDraft> {
  const saved = await dependencies.savePdf(file);
  const extracted = await dependencies.extractText(dependencies.toStoragePath(saved.storageKey));
  const timestamp = dependencies.now();
  const asset: ResumeAssetDraft = {
    originalName: file.name,
    storageKey: saved.storageKey,
    mimeType: file.type,
    byteSize: saved.byteSize,
    extractedText: extracted.text,
    parseStatus: extracted.error ? "failed" : "parsed",
    parseError: extracted.error ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await dependencies.insertAsset(asset);
  return asset;
}
