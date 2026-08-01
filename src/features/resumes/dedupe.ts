import { createHash } from "node:crypto";
import type { ResumeEntryType } from "@/features/resumes/constants";

export type ResumeEntryFingerprintInput = {
  type: ResumeEntryType;
  title: string;
  content: Record<string, string>;
};

export type ResumeEntryFingerprintRecord = ResumeEntryFingerprintInput & {
  id: number;
};

function normalizeText(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("zh-CN");
}

function normalizeContent(content: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(content)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [normalizeText(key), normalizeText(value)]),
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
