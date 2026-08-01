# Resume Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Build one local-first 简历 module: PDF originals, reusable entries, JD text/image input, and confirmable DeepSeek V4 suggestions.

**Architecture:** The route src/app/resumes/page.tsx only composes feature data. src/features/resumes owns schemas, SQLite access, Server Actions, local-file adapters, AI/OCR adapters, and UI. OCR is local and confirmed before a narrowly scoped AI call; accepted suggestions become immutable snapshots.

**Tech Stack:** Next.js 15, React 19, TypeScript, SQLite/Drizzle, Zod, Tailwind/shadcn, tsx built-in test runner, pdf-parse, tesseract.js, DeepSeek OpenAI-compatible Chat Completions.

## Global Constraints

- SQLite is the sole business-data source; use Drizzle migrations and never reset user data.
- Keep code under src/features/resumes; no generic services directory.
- Use Zod plus Server Actions for all writes.
- Secrets live only in .env.local.
- Never invent resume facts, metrics, responsibilities, skills, or results.
- Send only confirmed JD text and explicitly selected material snapshots to AI.
- Only manually sync the one approved Feishu URL, without bypassing access controls.

---

## Planned File Structure

~~~text
src/app/resumes/page.tsx
src/config/navigation.ts
src/db/schema.ts
drizzle/0012_add_resume_module.sql
drizzle/0013_add_feishu_job_sync.sql
src/features/resumes/{constants,types,schema,actions,queries,files,pdf,ocr,ai,prompts,feishu}.ts
src/features/resumes/components/{resume-workspace,resume-asset-list,resume-asset-upload-form,resume-entry-list,resume-entry-form,optimization-workspace,jd-input-form,material-selector,optimization-result}.tsx
test/resumes/{schema,files,pdf,ocr,ai,feishu}.test.ts
.env.example
README.md
项目工程约束.md
~~~

### Task 1: Set the allowed boundary and test harness

**Files:** Modify package.json, .gitignore, 项目工程约束.md. Create .env.example, src/features/resumes/schema.ts, and test/resumes/schema.test.ts.

**Interfaces:** Add npm run test as the cross-platform `tsx --test` auto-discovery command. All resume tests belong under test/resumes so Node test discovery includes them automatically. Export resumeEntrySchema for profile, education, experience, project, and skill. Define empty-only DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, and DEEPSEEK_MODEL variables.

- [ ] **Step 1: Write the failing test.**

~~~ts
test("rejects a project entry without a title", () => {
  assert.equal(resumeEntrySchema.safeParse({ type: "project", title: "", content: {} }).success, false);
});
~~~

- [ ] **Step 2: Verify it fails.**

Run: npx tsx --test test/resumes/schema.test.ts

Expected: FAIL because the schema does not exist.

- [ ] **Step 3: Write the minimal implementation.**

~~~ts
export const resumeEntrySchema = z.object({
  type: z.enum(["profile", "education", "experience", "project", "skill"]),
  title: z.string().trim().min(1).max(120),
  content: z.record(z.string()),
});
~~~

Install pdf-parse and tesseract.js. Ignore data/resume-assets/. Narrow 项目工程约束.md to allow only user-initiated local PDF/JD-image processing, user-confirmed DeepSeek requests, and manual sync for the exact Feishu URL.

- [ ] **Step 4: Verify.**

Run: npm run test && npm run typecheck && npm run lint

Expected: all exit 0.

- [ ] **Step 5: Commit.**

~~~bash
git add package.json package-lock.json .gitignore .env.example 项目工程约束.md src/features/resumes/schema.ts test/resumes/schema.test.ts
git commit -m "chore: prepare resume module boundaries"
~~~

### Task 2: Add vault and optimization data model

**Files:** Modify src/db/schema.ts and resume schema tests. Create resume constants/types and drizzle/0012_add_resume_module.sql.

**Interfaces:** Create resume_assets, resume_entries, resume_optimization_tasks, resume_optimization_materials, resume_optimization_suggestions, resume_versions. Export optimizationTaskInputSchema and aiOptimizationResponseSchema.

- [ ] **Step 1: Write failing tests.**

~~~ts
test("accepts a bounded project entry", () => {
  assert.equal(resumeEntrySchema.safeParse({
    type: "project", title: "多智能体协作研究", content: { responsibilities: "编写评测脚本" },
  }).success, true);
});
test("rejects an evidence-free suggestion", () => {
  assert.equal(aiOptimizationResponseSchema.safeParse({ suggestions: [{ proposedText: "提升 80%" }] }).success, false);
});
~~~

- [ ] **Step 2: Verify failure.**

Run: npx tsx --test test/resumes/schema.test.ts

Expected: FAIL because AI response validation is absent.

- [ ] **Step 3: Implement tables and migration.**

Use JSON text for extensible entry content and immutable material/version snapshots; retain relational IDs and state fields. Assets hold original name, key, MIME, size, extracted text, parse state/error. Entries hold type/title/content/tags/completeness. Tasks hold JD source/image key/text/role/status/output. Materials snapshot selected assets or entries. Suggestions cite a material and store original/proposed text, rationale, accepted state, and order. Versions contain accepted content only. Use cascade delete for task-owned records and set-null optional source references.

- [ ] **Step 4: Generate and verify migration.**

Run: npm run db:generate && npm run db:migrate && npm run test && npm run typecheck && npm run lint

Expected: new tables are created without modifying existing records.

- [ ] **Step 5: Commit.**

~~~bash
git add src/db/schema.ts src/features/resumes drizzle
git commit -m "feat: add resume vault schema"
~~~

### Task 3: Build PDF vault and structured entry warehouse

**Files:** Create the resume route, files.ts, pdf.ts, queries.ts, actions.ts, vault/entry components, files.test.ts and pdf.test.ts. Modify src/config/navigation.ts.

**Interfaces:** saveResumePdf(file) returns storageKey and byteSize for PDF only. extractPdfText(path) returns text and optional error without throwing. getResumeWorkspaceData returns assets and entries. Actions return success/errors/message and revalidate /resumes.

- [ ] **Step 1: Write failing tests.**

~~~ts
test("rejects a non-PDF upload", async () => {
  await assert.rejects(() => saveResumePdf(new File(["x"], "resume.png", { type: "image/png" })));
});
test("returns an error object for unreadable PDFs", async () => {
  const result = await extractPdfText("C:/missing/not-a-pdf.pdf");
  assert.equal(result.text, "");
  assert.ok(result.error);
});
~~~

- [ ] **Step 2: Verify failure.**

Run: npx tsx --test test/resumes/files.test.ts test/resumes/pdf.test.ts

Expected: FAIL because adapters do not exist.

- [ ] **Step 3: Implement the warehouse.**

Save randomized asset keys under data/resume-assets while retaining original filename metadata. Enforce a documented size limit; create the asset even if parsing fails. Add exactly one 简历 item to navigation. The default tab shows a compact PDF list and filterable/searchable five-type entries with add/edit dialogs patterned after existing feature forms.

- [ ] **Step 4: Verify.**

Run: npm run test && npm run typecheck && npm run lint

Manual: upload PDF, reject image, create/edit/filter project entry, refresh /resumes, verify persistence.

- [ ] **Step 5: Commit.**

~~~bash
git add src/app/resumes/page.tsx src/config/navigation.ts src/features/resumes
git commit -m "feat: add resume warehouse"
~~~

### Task 4: Implement JD text/image intake and OCR confirmation

**Files:** Create ocr.ts, ocr.test.ts, optimization workspace, JD form and material selector. Modify resume schema/actions/queries.

**Interfaces:** recognizeJdImage(file) accepts PNG/JPEG/WebP and returns text/confidence. createOptimizationTaskAction stores draft only. confirmOptimizationTaskAction requires reviewed text and at least one asset or entry, then snapshots material and moves draft to ready.

- [ ] **Step 1: Write failing tests.**

~~~ts
test("rejects a PDF as a JD image", async () => {
  await assert.rejects(() => recognizeJdImage(new File(["x"], "jd.pdf", { type: "application/pdf" })));
});
test("requires reviewed JD text", () => {
  assert.equal(confirmOptimizationTaskSchema.safeParse({ taskId: 1, jdText: "", entryIds: [] }).success, false);
});
~~~

- [ ] **Step 2: Verify failure.**

Run: npx tsx --test test/resumes/ocr.test.ts test/resumes/schema.test.ts

Expected: FAIL because OCR and confirmation validation are absent.

- [ ] **Step 3: Implement intake.**

Run Tesseract locally, retain JD images under local assets, show extracted text in an editable textarea, and use the same review flow for pasted text. Do not expose AI generation until confirmed. Snapshot selected assets/entries. Provide an error state with retry and paste-text fallback.

- [ ] **Step 4: Verify.**

Run: npm run test && npm run typecheck && npm run lint

Manual: create text and image tasks, change OCR text, and prove a task cannot become ready without reviewed JD and material.

- [ ] **Step 5: Commit.**

~~~bash
git add src/features/resumes
git commit -m "feat: add JD intake and OCR review"
~~~

### Task 5: Integrate DeepSeek and confirmable text versions

**Files:** Create prompts.ts, ai.ts, ai.test.ts, optimization-result component. Modify resume schema/actions/queries and .env.example.

**Interfaces:** getDeepSeekConfig returns API key/base URL/model with defaults https://api.deepseek.com and deepseek-v4-pro. generateOptimization accepts confirmed snapshots and returns validated output. applySuggestionDecisionAction updates one choice. createResumeVersionAction creates immutable accepted content.

- [ ] **Step 1: Write failing privacy/output tests.**

~~~ts
test("builds a request from confirmed materials only", () => {
  const request = buildOptimizationRequest({ jdText: "岗位 JD", materials: [{ kind: "entry", snapshot: { title: "项目" } }] });
  assert.match(request.user, /岗位 JD/);
  assert.doesNotMatch(request.user, /未选择的简历/);
});
test("rejects an unsupported metric", () => {
  assert.equal(parseOptimizationResponse('{"suggestions":[{"proposedText":"提升 80%"}]}').success, false);
});
~~~

- [ ] **Step 2: Verify failure.**

Run: npx tsx --test test/resumes/ai.test.ts

Expected: FAIL because the adapter is absent.

- [ ] **Step 3: Implement adapter and review view.**

Call POST /chat/completions with response_format json_object using the configured DeepSeek endpoint/model. Prompt for information hygiene, business-value translation, concise fact questions, and a material citation per rewrite. Reject unsupported claims. Retain ready tasks and give retryable messages for missing config, HTTP, JSON, or Zod errors. Create versions from accepted suggestions/material snapshots only.

- [ ] **Step 4: Verify.**

Run: npm run test && npm run typecheck && npm run lint

Manual: test missing key, malformed mocked response, valid request preview, accept/reject controls, and immutable version after editing its source entry.

- [ ] **Step 5: Commit.**

~~~bash
git add src/features/resumes .env.example
git commit -m "feat: add DeepSeek resume optimization"
~~~

### Task 6: Add the one-source Feishu manual sync foundation

**Files:** Modify schema, resume constants/actions/queries, optimization workspace, README. Create drizzle/0013_add_feishu_job_sync.sql, feishu.ts, feishu.test.ts.

**Interfaces:** APPROVED_FEISHU_SOURCE_URL equals the user-supplied Base URL. Create feishu_sync_runs and job_opportunities with companyName, recruitmentType, companyType, role, applicationUrl, sourceRecordKey. syncApprovedFeishuSourceAction is manual. normalizeFeishuRecord is pure.

- [ ] **Step 1: Write failing tests.**

~~~ts
test("normalizes permitted Feishu fields", () => {
  assert.deepEqual(normalizeFeishuRecord({ "公司名称": "示例公司", "批次": "暑期实习", "岗位": "后端实习生" }), {
    companyName: "示例公司", recruitmentType: "暑期实习", companyType: "", role: "后端实习生", applicationUrl: "",
  });
});
test("rejects every non-approved URL", () => {
  assert.throws(() => assertApprovedFeishuUrl("https://example.com"));
});
~~~

- [ ] **Step 2: Verify failure.**

Run: npx tsx --test test/resumes/feishu.test.ts

Expected: FAIL because adapter is absent.

- [ ] **Step 3: Implement safe manual sync.**

Fetch the exact approved URL with a bounded timeout and no automatic retries. Never use browser automation, credentials extraction, CAPTCHA handling, alternate URLs, or access-control bypass. Save a readable run report for inaccessible/non-exportable/changed pages; retain existing jobs after failure; upsert accessible rows by source record key. Show Sync岗位数据 only inside the optimization tab; imported positions are not automatic AI input.

- [ ] **Step 4: Verify.**

Run: npm run db:migrate && npm run test && npm run typecheck && npm run lint

Manual: invoke inaccessible sync and verify a report plus preserved prior rows; if accessible, verify normalized fields and timestamp.

- [ ] **Step 5: Commit.**

~~~bash
git add src/db/schema.ts drizzle src/features/resumes README.md
git commit -m "feat: add Feishu job sync foundation"
~~~

### Task 7: Document and release-verify

**Files:** Modify README.md; modify design spec only if an implementation discovery requires a user-approved correction.

- [ ] **Step 1: Add a failing setup checklist.**

~~~md
- [ ] DEEPSEEK_API_KEY is configured without source control.
- [ ] Assets are stored locally under data/resume-assets/.
- [ ] Feishu sync is manual, source-limited, and never bypasses permissions.
~~~

- [ ] **Step 2: Verify it is currently incomplete.**

Run: rg -n "DEEPSEEK_API_KEY|resume-assets|Feishu|飞书" README.md

Expected: at least one required statement is absent.

- [ ] **Step 3: Document the exact setup and acceptance flow.**

~~~bash
npm install
npm run db:migrate
copy .env.example .env.local
npm run dev
npm run test
npm run typecheck
npm run lint
npm run build
~~~

Document: upload PDF → add entry → paste/scan JD → confirm text → choose materials → generate → accept suggestion → save text version. State that PDF/Word export is not included.

- [ ] **Step 4: Execute release verification.**

Run: npm run test && npm run typecheck && npm run lint && npm run build

Expected: all exit 0, followed by the browser acceptance path with a local PDF and JD image.

- [ ] **Step 5: Commit.**

~~~bash
git add README.md docs/superpowers/specs/2026-08-01-resume-module-design.md
git commit -m "docs: document resume module setup"
~~~

## Plan Self-Review

- Spec coverage maps to Tasks 1–7: policy/data, warehouse, JD/OCR, DeepSeek, Feishu, and release documentation.
- Scope excludes generic crawling, export, cloud sync, queues, multi-user work, and automatic mutation of source resumes.
- Task 2 creates all schema/interfaces that Tasks 3–6 consume; all AI inputs are confirmed snapshots.
- The plan contains explicit failure behavior and verification commands, with no deferred placeholders.

