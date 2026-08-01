import type { GeneratedCandidate } from "@/features/resumes/ai-schema";
import {
  findExactResumeEntry,
  type ResumeEntryFingerprintInput,
  type ResumeEntryFingerprintRecord,
} from "@/features/resumes/dedupe";

export type PreparedCandidate = Omit<GeneratedCandidate, "similarEntryId"> & {
  duplicateEntryId: number | null;
  duplicateKind: "none" | "similar";
};

export function prepareGeneratedCandidates(
  generated: readonly GeneratedCandidate[],
  formalEntries: readonly ResumeEntryFingerprintRecord[],
): { candidates: PreparedCandidate[]; skippedExactCount: number } {
  const candidates: PreparedCandidate[] = [];
  let skippedExactCount = 0;

  for (const candidate of generated) {
    if (findExactResumeEntry(candidate, formalEntries)) {
      skippedExactCount += 1;
      continue;
    }

    candidates.push({
      type: candidate.type,
      title: candidate.title,
      content: candidate.content,
      sourceExcerpt: candidate.sourceExcerpt,
      duplicateEntryId: candidate.similarEntryId,
      duplicateKind: candidate.similarEntryId === null ? "none" : "similar",
    });
  }

  return { candidates, skippedExactCount };
}

export function resolveCandidateAcceptance(
  candidate: ResumeEntryFingerprintInput,
  formalEntries: readonly ResumeEntryFingerprintRecord[],
): { accepted: true } | { accepted: false; duplicateEntryId: number } {
  const duplicate = findExactResumeEntry(candidate, formalEntries);
  return duplicate ? { accepted: false, duplicateEntryId: duplicate.id } : { accepted: true };
}
