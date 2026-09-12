import { createHash } from "node:crypto";
import type { ResumeEntryType } from "@/features/resumes/constants";
import type { ResumeEntryContent } from "@/features/resumes/schema";

export type ResumeEntryFingerprintInput = {
  type: ResumeEntryType;
  title: string;
  content: ResumeEntryContent;
};

export type ResumeEntryFingerprintRecord = ResumeEntryFingerprintInput & {
  id: number;
};

function normalizeText(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("zh-CN");
}

function normalizeValue(value: unknown): unknown {
  if (typeof value === "string") return normalizeText(value);
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value && typeof value === "object") return normalizeContent(value);
  return value;
}

function normalizeContent(content: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(content)
      .filter(([key, value]) => !((key === "responsibilities" && value === "") || (key === "projects" && Array.isArray(value) && !value.length)))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [
        normalizeText(key),
        normalizeValue(value),
      ]),
  );
}

export function resumeEntryFingerprint(entry: ResumeEntryFingerprintInput): string {
  const canonical = JSON.stringify({
    type: entry.type,
    title: normalizeText(entry.title),
    content: normalizeContent(entry.content),
  });

  return createHash("sha256").update(canonical).digest("hex");
}

export function findExactResumeEntry<T extends ResumeEntryFingerprintRecord>(
  candidate: ResumeEntryFingerprintInput,
  entries: readonly T[],
): T | undefined {
  const candidateFingerprint = resumeEntryFingerprint(candidate);
  return entries.find((entry) => resumeEntryFingerprint(entry) === candidateFingerprint);
}
