# Resume AI Entry Matching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox notation for progress tracking.

**Goal:** Turn extracted PDF text into user-reviewed structured resume entries and let DeepSeek recommend existing entries for a pasted JD, while keeping all AI calls explicit and all secrets server-only.

**Architecture:** Add one server-only DeepSeek adapter with two Zod-validated domain operations. Persist PDF-derived candidates separately from formal entries, perform deterministic exact deduplication locally, and reuse the existing optimization task/material tables for JD recommendation snapshots. Keep UI orchestration in the existing resume workspace, with candidate review and JD selection implemented as focused client components backed by Server Actions.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, Server Actions, SQLite, Drizzle ORM, Zod, native `fetch`, Node test runner via `tsx --test`, Tailwind/shadcn primitives.

**Global Constraints:** Preserve the current PDF upload/delete and explicit PDF worker fixes; do not implement PDF/JD OCR, description rewriting, export, or synchronization; do not store or expose the DeepSeek API key; never write AI output directly to formal entries; all external calls require a user button click; use `deepseek-v4-flash` as the current official default model and allow environment overrides.

## File map

- Modify `src/features/resumes/constants.ts`: candidate/extraction/recommendation enums and types.
- Modify `src/db/schema.ts`: extraction state columns and `resume_entry_candidates` table/types.
- Generate `drizzle/0014_*.sql` and `drizzle/meta/0014_snapshot.json`; update `drizzle/meta/_journal.json`.
- Create `src/features/resumes/ai-schema.ts`: Zod contracts for provider responses and saved recommendation output.
- Create `src/features/resumes/deepseek.ts`: server-only configuration, HTTP adapter, response extraction, timeout/error mapping.
- Create `src/features/resumes/prompts.ts`: pure, testable candidate and JD prompt builders.
- Create `src/features/resumes/dedupe.ts`: stable normalization/fingerprint and duplicate matching.
- Extend `src/features/resumes/schema.ts`: Server Action payload schemas and JSON parsing helpers.
- Create `src/features/resumes/candidate-actions.ts`: generate, accept, and ignore candidate actions.
- Create `src/features/resumes/optimization-actions.ts`: run JD recommendations and save selected snapshots.
- Extend `src/features/resumes/queries.ts`: candidates, recommendation tasks, and saved material views.
- Modify `src/features/resumes/components/resume-workspace.tsx`: vault/JD tabs and new feature wiring.
- Modify `src/features/resumes/components/resume-asset-list.tsx`: explicit candidate generation control and status.
- Create `src/features/resumes/components/resume-candidate-list.tsx`: editable pending-candidate review.
- Create `src/features/resumes/components/jd-matching-workspace.tsx`: JD input, recommendations, selection, save, disabled optimization entry.
- Add focused tests under `test/resumes/` for every pure function and service boundary.
- Update `.env.example` with names only/default non-secret values.

## Task 1: Freeze the AI response contracts and prompt privacy boundary

**Files:**

- Create: `src/features/resumes/ai-schema.ts`
- Create: `src/features/resumes/prompts.ts`
- Test: `test/resumes/ai-schema.test.ts`
- Test: `test/resumes/prompts.test.ts`

- [ ] Write failing schema tests covering valid candidate/recommendation JSON, missing source evidence, illegal entry types, illegal recommendation levels, duplicate recommendation IDs, and unknown fields.
- [ ] Define strict domain contracts:

```ts
export const generatedCandidateSchema = z.object({
  type: z.enum(resumeEntryTypes),
  title: z.string().trim().min(1).max(200),
  content: z.record(z.string().trim().min(1), z.string().trim().min(1)),
  sourceExcerpt: z.string().trim().min(1).max(2_000),
  similarEntryId: z.number().int().positive().nullable(),
}).strict();

export const jdRecommendationSchema = z.object({
  entryId: z.number().int().positive(),
  level: z.enum(["high", "medium", "low"]),
  reason: z.string().trim().min(1).max(500),
}).strict();
```

- [ ] Write failing prompt tests proving candidate requests contain only the selected PDF text plus formal-entry summaries, and JD requests contain only target role, confirmed JD, and formal entries.
- [ ] Implement pure prompt builders with explicit “JSON only”, anti-fabrication, source-evidence, allowed-ID, and output-example instructions.
- [ ] Run `npm.cmd test -- test/resumes/ai-schema.test.ts test/resumes/prompts.test.ts` and confirm green.
- [ ] Commit: `test: define resume AI contracts and prompts`.

## Task 2: Build the server-only DeepSeek adapter

**Files:**

- Create: `src/features/resumes/deepseek.ts`
- Test: `test/resumes/deepseek.test.ts`

- [ ] Write failing tests for missing key, official defaults, environment overrides, authorization header, JSON-output request, timeout/network failure, non-2xx response, empty content, invalid provider envelope, invalid domain JSON, and truncated output.
- [ ] Implement configuration without accepting secrets from callers:

```ts
type DeepSeekConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
};

export function getDeepSeekConfig(env: NodeJS.ProcessEnv = process.env): DeepSeekConfig;
```

- [ ] Implement one internal `requestJson<T>` using `POST {baseUrl}/chat/completions`, `Authorization: Bearer ...`, `response_format: { type: "json_object" }`, `thinking: { type: "disabled" }`, a finite timeout, and sanitized errors that never include request text, response bodies, or headers.
- [ ] Expose only typed domain calls:

```ts
export async function generateEntryCandidates(
  input: CandidatePromptInput,
  dependencies?: { fetch?: typeof fetch; env?: NodeJS.ProcessEnv },
): Promise<GeneratedCandidate[]>;

export async function recommendEntriesForJd(
  input: JdPromptInput,
  dependencies?: { fetch?: typeof fetch; env?: NodeJS.ProcessEnv },
): Promise<JdRecommendation[]>;
```

- [ ] Reject unknown recommendation IDs after Zod parsing and reject `finish_reason === "length"` before returning domain objects.
- [ ] Run `npm.cmd test -- test/resumes/deepseek.test.ts` and confirm green.
- [ ] Commit: `feat: add validated DeepSeek resume adapter`.

## Task 3: Add candidate persistence and deterministic deduplication

**Files:**

- Modify: `src/features/resumes/constants.ts`
- Modify: `src/db/schema.ts`
- Create: `src/features/resumes/dedupe.ts`
- Generate: `drizzle/0014_*.sql`
- Generate: `drizzle/meta/0014_snapshot.json`
- Modify: `drizzle/meta/_journal.json`
- Test: `test/resumes/dedupe.test.ts`
- Test: `test/resumes/database.test.ts`

- [ ] Write failing fingerprint tests for whitespace/case normalization, stable object-key ordering, meaningful content differences, and type/title differences.
- [ ] Implement stable exact matching:

```ts
export function resumeEntryFingerprint(entry: {
  type: ResumeEntryType;
  title: string;
  content: Record<string, string>;
}): string;

export function findExactResumeEntry(
  candidate: ResumeEntryFingerprintInput,
  entries: readonly ResumeEntryFingerprintRecord[],
): ResumeEntryFingerprintRecord | undefined;
```

- [ ] Add extraction enums (`idle`, `processing`, `completed`, `failed`), duplicate enums (`none`, `exact`, `similar`), and candidate state enums (`pending`, `accepted`, `ignored`).
- [ ] Add `entryExtractionStatus`, `entryExtractionError`, and `entryExtractedAt` to `resumeAssets`, defaulting existing rows to `idle`.
- [ ] Add `resumeEntryCandidates` with `resumeAssetId` cascade deletion, `duplicateEntryId` set-null deletion, strict enum columns, timestamps, and useful indexes on asset/state.
- [ ] Export inferred candidate types from `src/db/schema.ts` and `src/features/resumes/types.ts`.
- [ ] Run `npm.cmd run db:generate`; inspect the generated SQL to ensure it only adds the intended columns/table/indexes and preserves existing data.
- [ ] Add a migration test using a temporary SQLite database to apply all migrations and verify existing assets receive `idle` while candidate foreign-key actions work.
- [ ] Run `npm.cmd test -- test/resumes/dedupe.test.ts test/resumes/database.test.ts` and `npm.cmd run db:migrate`.
- [ ] Commit: `feat: persist resume entry candidates`.

## Task 4: Implement candidate generation and review actions

**Files:**

- Modify: `src/features/resumes/schema.ts`
- Create: `src/features/resumes/candidate-actions.ts`
- Modify: `src/features/resumes/queries.ts`
- Test: `test/resumes/candidate-actions.test.ts`
- Test: `test/resumes/schema.test.ts`

- [ ] Add failing payload tests for positive asset/candidate IDs, editable candidate JSON, explicit pending-candidate replacement confirmation, and malformed JSON.
- [ ] Extract action dependencies into testable services so tests can use an in-memory repository and fake AI adapter without mocking Next internals.
- [ ] Implement `generateResumeCandidates` service: validate parsed PDF and non-empty text; reject or explicitly replace pending candidates; mark processing; send selected text plus formal-entry summaries; exact-dedupe locally; validate AI similarity IDs; persist remaining candidates transactionally; mark completed or sanitized failed state.
- [ ] Wrap the service in `generateResumeCandidatesAction(previousState, formData)`, invoked only by the PDF card form.
- [ ] Implement `acceptResumeCandidate` service: parse edited content, reload formal entries, re-run exact dedupe, insert one formal entry and mark accepted in one transaction; on exact duplicate, do not insert and persist the duplicate link/status for user feedback.
- [ ] Implement `ignoreResumeCandidate` and Server Action wrappers; no action may accept a candidate that is already accepted/ignored.
- [ ] Extend workspace queries with parsed candidate content and duplicate-entry summary, while preserving existing asset and entry shapes.
- [ ] Test status transitions, exact duplicate skipping, semantic-similar linking, acceptance recheck, ignore behavior, AI failure retryability, and deletion cascade.
- [ ] Run `npm.cmd test -- test/resumes/candidate-actions.test.ts test/resumes/schema.test.ts`.
- [ ] Commit: `feat: generate and review resume candidates`.

## Task 5: Add candidate generation and editing UI

**Files:**

- Modify: `src/features/resumes/components/resume-asset-list.tsx`
- Create: `src/features/resumes/components/resume-candidate-list.tsx`
- Modify: `src/features/resumes/components/resume-workspace.tsx`
- Test: `test/resumes/resume-ui.test.tsx` if the current test stack supports component rendering; otherwise cover form-state helpers as pure tests and verify manually.

- [ ] Add an explicit “生成结构化条目” button only for parsed, non-empty PDFs; show that clicking sends the extracted text to DeepSeek.
- [ ] Require browser confirmation before replacing unresolved pending candidates; keep accepted/ignored history intact.
- [ ] Render extraction states independently from PDF parsing states: idle, processing, completed timestamp, failed with retry.
- [ ] Build editable candidate cards with type selector, title input, dynamic structured content fields serialized to a hidden JSON value, source excerpt, semantic duplicate warning, accept, and ignore controls.
- [ ] Keep the existing manual entry dialog and deletion button behavior unchanged.
- [ ] Ensure success refreshes server data and errors remain visible without clearing edits.
- [ ] Run targeted tests, `npm.cmd run lint`, and `npm.cmd run typecheck`.
- [ ] Commit: `feat: add resume candidate review UI`.

## Task 6: Implement JD recommendation services and saved snapshots

**Files:**

- Modify: `src/features/resumes/schema.ts`
- Create: `src/features/resumes/optimization-actions.ts`
- Modify: `src/features/resumes/queries.ts`
- Test: `test/resumes/optimization-actions.test.ts`

- [ ] Write failing tests for required target role/JD, empty entry vault, valid recommendations, unknown AI entry IDs, failure persistence, selection validation, and immutable snapshot content.
- [ ] Implement `runJdRecommendation`: create or update a text-source task in `processing`; call DeepSeek only after the action is submitted; persist the validated recommendation JSON and `completed`, or persist `failed` without losing role/JD.
- [ ] Use this saved shape:

```ts
type SavedJdRecommendationOutput = {
  recommendations: Array<{
    entryId: number;
    level: "high" | "medium" | "low";
    reason: string;
  }>;
};
```

- [ ] Implement `saveJdMaterialSelection`: validate task and entry IDs, delete only that task’s prior `kind = "entry"` materials, and insert current entry snapshots containing type/title/content/tags/completeness.
- [ ] Preserve the task even when DeepSeek fails, enabling explicit retry from the same saved inputs.
- [ ] Extend queries to return recent JD tasks with validated recommendations, current entry details, and saved selected IDs; malformed legacy output should degrade to an empty result instead of breaking the page.
- [ ] Run `npm.cmd test -- test/resumes/optimization-actions.test.ts`.
- [ ] Commit: `feat: recommend resume entries for JD`.

## Task 7: Add the JD matching interface and deferred optimization entry

**Files:**

- Create: `src/features/resumes/components/jd-matching-workspace.tsx`
- Modify: `src/features/resumes/components/resume-workspace.tsx`
- Test: `test/resumes/jd-selection.test.ts`

- [ ] Write pure selection tests proving high matches are initially selected, medium/low are not, and manual add/remove produces the exact submitted ID set.
- [ ] Add “简历仓库” and “JD 匹配” tabs without changing the main `/resumes` route.
- [ ] Add target-role input, JD textarea, disclosure that confirmed JD and formal entries will be sent to DeepSeek, and “AI 推荐条目” submit state.
- [ ] Render high/medium/low recommendation cards with reasons, formal-entry previews, checkboxes, and saved-selection status.
- [ ] Default-select high recommendations on a fresh result, allow manual changes, and save selected snapshots.
- [ ] Add a visible disabled “优化条目描述” button with “后续开放”; do not call AI, write suggestions, or create resume versions.
- [ ] Keep failed task inputs in the form and expose an explicit retry button.
- [ ] Run targeted tests, `npm.cmd run lint`, and `npm.cmd run typecheck`.
- [ ] Commit: `feat: add JD resume entry matching UI`.

## Task 8: Document configuration and complete end-to-end verification

**Files:**

- Modify: `.env.example`
- Modify: project README or existing setup documentation discovered during implementation.

- [ ] Add only non-secret configuration names:

```dotenv
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_TIMEOUT_MS=30000
```

- [ ] Document that the key pasted into chat must be rotated before use and placed only in local `.env.local`; never add the actual key to any repository file.
- [ ] Verify missing-key UI behavior without an external request.
- [ ] With a newly rotated local key supplied outside source control, manually verify one candidate-generation call and one JD-recommendation call; if no safe key is available, record these two network checks as the only unverified items.
- [ ] Run the complete suite from a clean app state:

```powershell
npm.cmd run db:migrate
npm.cmd test
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

- [ ] Manually verify PDF parse/generate/retry, candidate edit/accept/ignore, repeated-resume exact dedupe, JD default selection/manual adjustment/save, deletion behavior, and the disabled optimization entry.
- [ ] Inspect `git diff --check`, `git status --short`, and the final diff for accidental secrets or unrelated reversions.
- [ ] Commit: `docs: configure DeepSeek resume features`.

## Final self-review checklist

- [ ] Every confirmed requirement in `docs/superpowers/specs/2026-08-02-resume-ai-entry-matching-design.md` maps to a task and test above.
- [ ] No OCR, description rewrite, suggestion/version creation, export, or sync path was added.
- [ ] No API key appears in source, migration, test fixture, log, error message, or client bundle.
- [ ] Candidate output always requires evidence and user acceptance before formal entry insertion.
- [ ] Exact dedupe executes both after AI generation and immediately before acceptance.
- [ ] JD AI output cannot reference an entry outside the submitted formal-entry set.
- [ ] All state enums and JSON shapes share one Zod/type source of truth.
- [ ] Migration is additive and safe for existing data.
- [ ] Final report lists changed files, decisions, verification evidence, and any external-API limitation.
