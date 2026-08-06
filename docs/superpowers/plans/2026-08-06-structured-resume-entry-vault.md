# Structured Resume Entry Vault Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic resume entry model with five strictly structured entry categories and remove completeness while clearing incompatible historical entry data.

**Architecture:** Keep one Drizzle table for formal entries and one for AI candidates, with category-specific Zod discriminated unions governing JSON content. Reuse the existing import, dedupe, and JD flows, but carry tags through candidate generation and remove completeness from snapshots.

**Tech Stack:** Next.js 15 App Router, TypeScript strict mode, Zod, Drizzle ORM, SQLite, Node test runner, React 19.

## Global Constraints

- All database changes use a migration; do not delete or recreate the database.
- Preserve uploaded PDF assets, but clear old entries, candidates, and JD history tied to the old entry contract.
- Add no dependencies and keep resume business logic under `src/features/resumes`.
- All writes remain server actions validated by Zod.

---

### Task 1: Define category-specific entry contracts

**Files:**
- Modify: `src/features/resumes/constants.ts`
- Modify: `src/features/resumes/schema.ts`
- Test: `test/resumes/schema.test.ts`

**Interfaces:**
- Produces: `resumeEntrySchema`, `resumeEntryContentSchema`, `normalizeResumeEntryTags(input)`, `skillProficiencyLevels`.

- [ ] Write failing tests that accept exact project, experience, education, skill, and honor payloads; reject `profile`, `completeness`, unknown content keys, and unsupported skill proficiency; and assert skill tags normalize to `[title]`.
- [ ] Run `npm test -- test/resumes/schema.test.ts` and confirm failures are caused by the old generic schema.
- [ ] Implement the five-type discriminated union, typed content parsing/stringifying, technology list normalization, and tag normalization.
- [ ] Re-run the focused tests and confirm they pass.

### Task 2: Migrate persistent storage and clear incompatible data

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0016_structured_resume_entry_vault.sql`
- Create: `drizzle/meta/0016_snapshot.json`
- Modify: `drizzle/meta/_journal.json`
- Test: `test/resumes/database.test.ts`

**Interfaces:**
- Produces: `resume_entries` without `completeness`; `resume_entry_candidates.tags_json NOT NULL DEFAULT '[]'`.

- [ ] Write failing schema tests asserting the removed formal-entry column and new candidate tag column.
- [ ] Run `npm test -- test/resumes/database.test.ts` and confirm the expected schema failure.
- [ ] Update Drizzle schema, generate migration metadata, and edit the generated SQL so dependent history and old entries are explicitly deleted while PDF assets remain and extraction state resets.
- [ ] Re-run database tests and inspect the migration SQL for ordered cleanup statements.

### Task 3: Carry structured fields through manual entry and AI candidate flows

**Files:**
- Modify: `src/features/resumes/actions.ts`
- Modify: `src/features/resumes/ai-schema.ts`
- Modify: `src/features/resumes/prompts.ts`
- Modify: `src/features/resumes/candidate-service.ts`
- Modify: `src/features/resumes/candidate-actions.ts`
- Modify: `src/features/resumes/queries.ts`
- Modify: `src/features/resumes/optimization-actions.ts`
- Test: `test/resumes/ai-schema.test.ts`
- Test: `test/resumes/candidate-service.test.ts`
- Test: `test/resumes/prompts.test.ts`

**Interfaces:**
- Consumes: category-specific schemas and `normalizeResumeEntryTags` from Task 1.
- Produces: AI candidates and formal entries with `{ type, title, content, tags }`; material snapshots without completeness.

- [ ] Write failing tests for strict AI category payloads, AI tags, prepared candidate tag preservation, prompt category instructions, and snapshots without completeness.
- [ ] Run the focused resume tests and confirm expected failures.
- [ ] Update manual payload parsing, AI output contracts/prompts, candidate persistence/acceptance, workspace query mapping, and optimization snapshots.
- [ ] Run the focused resume tests until green.

### Task 4: Render dynamic type-specific forms and grouped summaries

**Files:**
- Modify: `src/features/resumes/components/resume-entry-form.tsx`
- Modify: `src/features/resumes/components/resume-entry-list.tsx`
- Modify: `src/features/resumes/components/resume-candidate-list.tsx`

**Interfaces:**
- Consumes: `ResumeEntryView`, five entry types, proficiency constants.
- Produces: accessible type-specific form controls and list summaries.

- [ ] Add source-level assertions to `test/resumes/files.test.ts` for removal of the completion control and presence of all category labels and proficiency options.
- [ ] Run the focused test and confirm it fails on the current generic form.
- [ ] Implement dynamic controls, comma/newline technology parsing inputs, candidate tag editing, and grouped list summaries.
- [ ] Re-run the focused test and relevant resume tests.

### Task 5: Verify the complete migration and application

**Files:**
- Modify only files needed to resolve verification failures within this feature scope.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: a verified, buildable application.

- [ ] Run `npm test`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Review `git diff --check`, `git status --short`, and migration ordering; fix any feature-scoped issue and repeat the affected command.
