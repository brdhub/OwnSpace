# Resume Copy and Application JD Linkage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make every structured resume field easy to copy, persist an optional JD on applications, connect applications to resume JD matching, and expose a non-functional interview-simulator entry for a later iteration.

**Architecture:** Add `applications.jobDescription` and nullable `resumeOptimizationTasks.applicationId` through a forward-only Drizzle migration. Keep application data authoritative while every JD task stores its own role/JD snapshot; route application IDs through server-validated page context rather than putting JD text in URLs. Resume copying uses a pure field-model function plus a small clipboard client component, and the AI hub only renders a read-only placeholder.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict mode, Server Actions, Zod, Drizzle ORM, SQLite, Tailwind CSS, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-23-resume-application-jd-linkage-design.md`

## Global Constraints

- Do not add “copy all”; only copy individual visible fields.
- Do not expose copy controls for internal resume tags.
- Copy technology arrays as one plain-text string joined with the Chinese delimiter `、`.
- `jobDescription` is optional in the UI, stored as `TEXT NOT NULL DEFAULT ''`, and limited to 20,000 characters.
- JD matching tasks keep `targetRole` and `jdText` snapshots even if the source application changes or is deleted.
- Deleting an application sets a linked task’s `applicationId` to `NULL`; it never deletes the task.
- Navigating from an application never calls DeepSeek automatically.
- The interview simulator is a read-only “coming later” entry; it does not read resume entries, build prompts, call external services, or add a conversation table.
- Every incoming application ID is parsed as a positive integer and verified against SQLite on the server.
- Do not add npm dependencies or broaden the project’s external-call allowlist.

---

### Task 1: Add the application JD and optimization-task association

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/features/applications/schemas.ts`
- Modify: `src/features/applications/schemas.test.ts`
- Modify: `test/resumes/database.test.ts`
- Create (generated): next `drizzle/0018_*.sql`
- Create (generated): `drizzle/meta/0018_snapshot.json`
- Modify (generated): `drizzle/meta/_journal.json`

**Interfaces:**
- Produces: `applications.jobDescription: string`
- Produces: `resumeOptimizationTasks.applicationId: number | null`
- Produces: `applicationFormSchema` output with normalized `jobDescription: string`
- Consumes: existing `applications` and `resumeOptimizationTasks` tables.

- [x] **Step 1: Write failing schema and database-contract tests**

Add `jobDescription: ""` to `validApplication` and append these tests to `src/features/applications/schemas.test.ts`:

```ts
test("accepts an empty or complete optional job description", () => {
  assert.equal(applicationFormSchema.parse({ ...validApplication, jobDescription: "" }).jobDescription, "");
  assert.equal(
    applicationFormSchema.parse({ ...validApplication, jobDescription: "  负责 AI Agent 平台开发  " }).jobDescription,
    "负责 AI Agent 平台开发",
  );
  assert.equal(
    applicationFormSchema.safeParse({ ...validApplication, jobDescription: "岗".repeat(20_001) }).success,
    false,
  );
});
```

Import `applications` and `resumeOptimizationTasks` in `test/resumes/database.test.ts`, then append:

```ts
test("application JDs persist and optimization tasks retain snapshots after application deletion", () => {
  const applicationColumns = Object.fromEntries(
    getTableConfig(applications).columns.map((column) => [column.name, column]),
  );
  assert.equal(applicationColumns.job_description.notNull, true);
  assert.equal(applicationColumns.job_description.default, "");

  const taskConfig = getTableConfig(resumeOptimizationTasks);
  const applicationId = taskConfig.columns.find((column) => column.name === "application_id");
  const applicationReference = taskConfig.foreignKeys
    .map((foreignKey) => ({ ...foreignKey.reference(), onDelete: foreignKey.onDelete }))
    .find((reference) => reference.columns[0].name === "application_id");
  assert.equal(applicationId?.notNull, false);
  assert.equal(applicationReference?.foreignColumns[0].name, "id");
  assert.equal(applicationReference?.onDelete, "set null");
  assert.equal(taskConfig.indexes.some((index) => index.config.name === "resume_optimization_tasks_application_id_idx"), true);
});
```

- [x] **Step 2: Run the focused tests and confirm RED**

Run:

```powershell
node.exe node_modules\tsx\dist\cli.mjs --test src/features/applications/schemas.test.ts test/resumes/database.test.ts
```

Expected: FAIL because neither Drizzle table exposes the new columns and `applicationFormSchema` drops `jobDescription`.

- [x] **Step 3: Implement the minimal schema changes**

Add to `applications` in `src/db/schema.ts`:

```ts
jobDescription: text("job_description").notNull().default(""),
```

Add to `applicationFormSchema` in `src/features/applications/schemas.ts`:

```ts
jobDescription: z.string().trim().max(20_000, "岗位描述不要超过 20000 个字符").optional().default(""),
```

Convert `resumeOptimizationTasks` to the indexed `sqliteTable` callback form and add:

```ts
applicationId: integer("application_id").references(() => applications.id, { onDelete: "set null" }),
```

```ts
(table) => ({
  applicationIndex: index("resume_optimization_tasks_application_id_idx").on(table.applicationId),
}),
```

- [x] **Step 4: Generate and inspect the forward migration**

Run:

```powershell
npm.cmd run db:generate
```

Inspect the generated `0018` SQL and require both statements, with no `DROP TABLE`, `DELETE`, or table recreation:

```sql
ALTER TABLE `applications` ADD `job_description` text DEFAULT '' NOT NULL;
ALTER TABLE `resume_optimization_tasks` ADD `application_id` integer REFERENCES applications(id) ON DELETE set null;
CREATE INDEX `resume_optimization_tasks_application_id_idx` ON `resume_optimization_tasks` (`application_id`);
```

- [x] **Step 5: Run focused tests and migration on the local database**

Run:

```powershell
node.exe node_modules\tsx\dist\cli.mjs --test src/features/applications/schemas.test.ts test/resumes/database.test.ts
npm.cmd run db:migrate
```

Expected: tests PASS and migration exits 0 without modifying or deleting existing rows.

- [x] **Step 6: Commit the data contract**

```powershell
git add src/db/schema.ts src/features/applications/schemas.ts src/features/applications/schemas.test.ts test/resumes/database.test.ts drizzle
git commit -m "feat: persist application JDs and resume task links"
```

### Task 2: Save and expose an optional JD on application records

**Files:**
- Modify: `src/features/applications/actions.ts`
- Modify: `src/features/applications/components/application-form.tsx`
- Modify: `src/features/applications/components/applications-workspace.tsx`

**Interfaces:**
- Consumes: `Application.jobDescription` and normalized `applicationFormSchema` from Task 1.
- Produces: application create/update persistence for `jobDescription`.
- Produces: application-card entry URLs `/resumes?tab=jd&applicationId=<id>` and `/ai-hub?applicationId=<id>#interview-simulator`.

- [x] **Step 1: Extend action persistence explicitly**

In both `createApplicationAction` and `updateApplicationAction`, set:

```ts
jobDescription: parsed.data.jobDescription ?? "",
```

Keep existing URL/null and notes normalization unchanged. This explicit assignment makes the empty-string storage contract visible even if the form schema changes later.

- [x] **Step 2: Add the optional JD form field**

Extend `ApplicationFormInitialValues` with `jobDescription`, then insert this field after `applicationUrl` and before `notes`:

```tsx
<div className="space-y-2">
  <Label htmlFor="jobDescription">岗位描述（可选）</Label>
  <Textarea
    id="jobDescription"
    name="jobDescription"
    rows={9}
    defaultValue={application?.jobDescription ?? initialValues?.jobDescription ?? ""}
    placeholder="粘贴完整 JD，之后可以直接用于简历匹配"
  />
  <FieldError errors={state.errors?.jobDescription} />
</div>
```

- [x] **Step 3: Add application-card JD state and links**

Import `FileSearch`, `MessagesSquare`, and `FilePlus2` from Lucide. For an application with `application.jobDescription.trim()`:

```tsx
<span className="rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-primary">已有 JD</span>
```

Add links:

```tsx
<Link href={`/resumes?tab=jd&applicationId=${application.id}`}>
  <FileSearch className="h-3.5 w-3.5" />JD 匹配
</Link>
<Link href={`/ai-hub?applicationId=${application.id}#interview-simulator`}>
  <MessagesSquare className="h-3.5 w-3.5" />面试模拟
</Link>
```

For an application without JD, replace both links with a `补充 JD` button using `FilePlus2` that calls `setEditing(application)`. Do not render the full JD in the card.

- [x] **Step 4: Run application tests, typecheck, and lint**

Run:

```powershell
node.exe node_modules\tsx\dist\cli.mjs --test src/features/applications/schemas.test.ts
npm.cmd run typecheck
npm.cmd run lint
```

Expected: all commands exit 0.

- [x] **Step 5: Commit the application experience**

```powershell
git add src/features/applications/actions.ts src/features/applications/components/application-form.tsx src/features/applications/components/applications-workspace.tsx
git commit -m "feat: add reusable JDs to application records"
```

### Task 3: Model and render field-level resume copying

**Files:**
- Create: `src/features/resumes/copy-fields.ts`
- Create: `test/resumes/copy-fields.test.ts`
- Create: `src/features/resumes/components/resume-copy-button.tsx`
- Modify: `src/features/resumes/components/resume-entry-detail.tsx`

**Interfaces:**
- Produces: `ResumeCopyField = { key: string; label: string; value: string; multiline: boolean }`.
- Produces: `ResumeCopyEntry = { type: ResumeEntryType; title: string; content: ResumeEntryContent }`.
- Produces: `getResumeCopyFields(entry: ResumeCopyEntry): ResumeCopyField[]`.
- Produces: `<ResumeCopyButton value label />` with local copied/error feedback.
- Consumes: the existing structured content contract for five resume entry types.

- [x] **Step 1: Write the failing copy-field contract tests**

Create `test/resumes/copy-fields.test.ts` with one literal case per type. The project case must assert exact output:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { getResumeCopyFields } from "../../src/features/resumes/copy-fields";

test("project copy fields expose visible values without tags or a combined copy", () => {
  assert.deepEqual(getResumeCopyFields({
    type: "project",
    title: "OwnSpace",
    content: { projectCategory: "个人项目", techStack: ["Next.js", "SQLite"], content: "实现本地优先求职工作台" },
  }), [
    { key: "title", label: "条目名称", value: "OwnSpace", multiline: false },
    { key: "projectCategory", label: "项目分类", value: "个人项目", multiline: false },
    { key: "techStack", label: "技术栈", value: "Next.js、SQLite", multiline: false },
    { key: "content", label: "项目内容", value: "实现本地优先求职工作台", multiline: true },
  ]);
});
```

Add the remaining literal cases:

```ts
test("every resume type exposes only its visible non-empty fields", () => {
  assert.deepEqual(getResumeCopyFields({
    type: "experience",
    title: "平台研发实习",
    content: { position: "后端实习生", techStack: ["Java", "Redis"], responsibilities: "负责接口开发", workContent: "完成缓存治理" },
  }), [
    { key: "title", label: "条目名称", value: "平台研发实习", multiline: false },
    { key: "position", label: "岗位", value: "后端实习生", multiline: false },
    { key: "techStack", label: "技术栈", value: "Java、Redis", multiline: false },
    { key: "responsibilities", label: "工作职责", value: "负责接口开发", multiline: true },
    { key: "workContent", label: "工作内容", value: "完成缓存治理", multiline: true },
  ]);
  assert.deepEqual(getResumeCopyFields({
    type: "education",
    title: "示例大学",
    content: { degree: "硕士", major: "计算机技术", dateRange: "2025-2028", content: "研究方向：大模型应用" },
  }), [
    { key: "title", label: "条目名称", value: "示例大学", multiline: false },
    { key: "degree", label: "学历", value: "硕士", multiline: false },
    { key: "major", label: "专业", value: "计算机技术", multiline: false },
    { key: "dateRange", label: "时间", value: "2025-2028", multiline: false },
    { key: "content", label: "教育经历", value: "研究方向：大模型应用", multiline: true },
  ]);
  assert.deepEqual(getResumeCopyFields({
    type: "skill",
    title: "Java",
    content: { proficiency: "熟练", content: "掌握并发与常用框架" },
  }), [
    { key: "title", label: "条目名称", value: "Java", multiline: false },
    { key: "proficiency", label: "掌握程度", value: "熟练", multiline: false },
    { key: "content", label: "技能说明", value: "掌握并发与常用框架", multiline: true },
  ]);
  assert.deepEqual(getResumeCopyFields({
    type: "honor",
    title: "程序设计竞赛",
    content: { award: "省级二等奖" },
  }), [
    { key: "title", label: "条目名称", value: "程序设计竞赛", multiline: false },
    { key: "award", label: "奖项 / 等级", value: "省级二等奖", multiline: false },
  ]);
  assert.deepEqual(getResumeCopyFields({
    type: "project",
    title: "仅标题",
    content: { projectCategory: "", techStack: [], content: "" },
  }), [
    { key: "title", label: "条目名称", value: "仅标题", multiline: false },
  ]);
});
```

- [x] **Step 2: Run the copy test and confirm RED**

Run:

```powershell
node.exe node_modules\tsx\dist\cli.mjs --test test/resumes/copy-fields.test.ts
```

Expected: FAIL because `copy-fields.ts` does not exist.

- [x] **Step 3: Implement the pure field builder**

In `copy-fields.ts`, define a small `field` helper that trims only for emptiness but preserves the original string when returning it. Join list values with `、`, and return a type-specific literal array filtered to non-empty values. Never accept or return `tags`.

The type switch must cover all `ResumeEntryType` values and return the exact fields listed in Step 1. There must be no aggregate field or `copyAll` function.

- [x] **Step 4: Run the copy test and confirm GREEN**

Run:

```powershell
node.exe node_modules\tsx\dist\cli.mjs --test test/resumes/copy-fields.test.ts
```

Expected: all copy-field tests PASS.

- [x] **Step 5: Implement the focused clipboard control**

Create `resume-copy-button.tsx` as a client component. Required behavior:

```tsx
type CopyState = "idle" | "copied" | "error";

async function copyValue() {
  try {
    await navigator.clipboard.writeText(value);
    setState("copied");
  } catch {
    setState("error");
  }
}
```

Render an outline/ghost-sized button with a `Copy` icon. Accessible labels are `复制${label}`, `已复制${label}`, and `${label}复制失败，请手动选择`. Reset feedback to idle after 1.6 seconds and clear the timer on unmount.

- [x] **Step 6: Refactor the detail dialog to consume copy fields**

Call `getResumeCopyFields(entry)` once. Keep the current visual grouping and type-specific hierarchy, but place the matching `ResumeCopyButton` beside every rendered title/value/section. Give the actual content text `select-text` so a clipboard failure still permits manual selection.

Specific rules:

```text
title button sits beside the dialog heading
fact-card button sits in its upper-right corner
technology-stack button copies the joined stack, not individual badges
content-section button sits beside the section heading
tags section remains unchanged and has no copy control
footer keeps only Close and Edit Entry
```

- [x] **Step 7: Run focused and full resume tests**

Run:

```powershell
$resumeTests = @(rg --files test/resumes | Where-Object { $_ -match '\.test\.ts$' })
node.exe node_modules\tsx\dist\cli.mjs --test @resumeTests
npm.cmd run typecheck
npm.cmd run lint
```

Expected: all commands exit 0.

- [x] **Step 8: Commit field-level copying**

```powershell
git add src/features/resumes/copy-fields.ts src/features/resumes/components/resume-copy-button.tsx src/features/resumes/components/resume-entry-detail.tsx test/resumes/copy-fields.test.ts
git commit -m "feat: make resume entry fields easy to copy"
```

### Task 4: Persist and validate an application source on JD tasks

**Files:**
- Modify: `src/features/resumes/schema.ts`
- Modify: `test/resumes/schema.test.ts`
- Modify: `src/features/resumes/optimization-actions.ts`
- Modify: `src/features/resumes/queries.ts`

**Interfaces:**
- Produces: `runJdRecommendationSchema` output with `applicationId?: number`.
- Produces: `JdTaskView.applicationId: number | null`.
- Consumes: Task 1’s `resumeOptimizationTasks.applicationId` and `applications.jobDescription`.

- [x] **Step 1: Write failing JD task-link schema tests**

Append to `test/resumes/schema.test.ts`:

```ts
test("accepts only a positive optional application source for JD matching", () => {
  const base = { targetRole: "后端开发实习生", jdText: "负责服务端研发" };
  assert.equal(runJdRecommendationSchema.parse({ ...base, applicationId: "8" }).applicationId, 8);
  assert.equal(runJdRecommendationSchema.parse(base).applicationId, undefined);
  assert.equal(runJdRecommendationSchema.safeParse({ ...base, applicationId: "0" }).success, false);
});
```

- [x] **Step 2: Run the schema test and confirm RED**

Run:

```powershell
node.exe node_modules\tsx\dist\cli.mjs --test test/resumes/schema.test.ts
```

Expected: FAIL because the strict desired output does not yet contain a coerced positive `applicationId`.

- [x] **Step 3: Extend the task input contract**

Add to `runJdRecommendationSchema`:

```ts
applicationId: z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.coerce.number().int().positive().optional(),
),
```

- [x] **Step 4: Validate application ownership in the Server Action**

In `runJdRecommendationAction`, when creating a new task with `applicationId`:

```ts
const linkedApplication = db.select({
  id: applications.id,
  jobDescription: applications.jobDescription,
}).from(applications).where(eq(applications.id, applicationId)).get();
if (!linkedApplication || !linkedApplication.jobDescription.trim()) {
  return { success: false, message: "对应投递不存在或尚未填写岗位描述。" };
}
```

Write `applicationId` into the insert. When retrying an existing task, select its stored `applicationId`; reject a submitted non-empty ID that differs from the stored source. Do not overwrite the source association during retries.

- [x] **Step 5: Return the association in workspace queries**

Add to `JdTaskView`:

```ts
applicationId: number | null;
```

Map `task.applicationId` into every task view returned by `getResumeWorkspaceData`.

- [x] **Step 6: Run resume schema tests, typecheck, and lint**

Run:

```powershell
node.exe node_modules\tsx\dist\cli.mjs --test test/resumes/schema.test.ts
npm.cmd run typecheck
npm.cmd run lint
```

Expected: all commands exit 0.

- [x] **Step 7: Commit persistent task linkage**

```powershell
git add src/features/resumes/schema.ts src/features/resumes/optimization-actions.ts src/features/resumes/queries.ts test/resumes/schema.test.ts
git commit -m "feat: link resume JD tasks to applications"
```

### Task 5: Import application JD context into the resume workspace

**Files:**
- Modify: `src/features/applications/queries.ts`
- Create: `src/features/applications/jd-context.ts`
- Create: `src/features/resumes/jd-import.ts`
- Create: `test/resumes/jd-import.test.ts`
- Modify: `src/app/resumes/page.tsx`
- Modify: `src/features/resumes/components/resume-workspace.tsx`
- Modify: `src/features/resumes/components/jd-matching-workspace.tsx`

**Interfaces:**
- Produces: `ApplicationJdContext = { id: number; company: string; role: string; jobDescription: string }`.
- Produces: `getApplicationJdContext(applicationId: number): Promise<ApplicationJdContext | null>`.
- Produces: `resolveJdImportState(tasks, context): { activeTaskId: number | null; targetRole: string; jdText: string }`.
- Consumes: `JdTaskView.applicationId` from Task 4.

- [x] **Step 1: Write failing import-state tests**

Create `test/resumes/jd-import.test.ts` with hand-authored task objects and assert:

```ts
test("opens the newest linked task instead of overwriting it with current application text", () => {
  const state = resolveJdImportState([
    { id: 2, applicationId: 7, targetRole: "旧岗位", jdText: "历史快照", updatedAt: "2026-08-20T00:00:00Z" },
    { id: 3, applicationId: 7, targetRole: "新任务岗位", jdText: "最新快照", updatedAt: "2026-08-22T00:00:00Z" },
  ], { id: 7, company: "示例公司", role: "当前岗位", jobDescription: "当前 JD" });
  assert.deepEqual(state, { activeTaskId: 3, targetRole: "新任务岗位", jdText: "最新快照" });
});

test("prefills a new task when the application has no linked history", () => {
  assert.deepEqual(resolveJdImportState([], {
    id: 7,
    company: "示例公司",
    role: "后端开发实习生",
    jobDescription: "负责服务端研发",
  }), { activeTaskId: null, targetRole: "后端开发实习生", jdText: "负责服务端研发" });
});
```

- [x] **Step 2: Run the import test and confirm RED**

Run:

```powershell
node.exe node_modules\tsx\dist\cli.mjs --test test/resumes/jd-import.test.ts
```

Expected: FAIL because `jd-import.ts` does not exist.

- [x] **Step 3: Implement the shared context type and pure import resolver**

Create `src/features/applications/jd-context.ts`:

```ts
export type ApplicationJdContext = {
  id: number;
  company: string;
  role: string;
  jobDescription: string;
};
```

Then implement `src/features/resumes/jd-import.ts` without importing a server-only query module:

```ts
import type { ApplicationJdContext } from "@/features/applications/jd-context";

export function resolveJdImportState(
  tasks: Array<{ id: number; applicationId: number | null; targetRole: string; jdText: string; updatedAt: string }>,
  context: ApplicationJdContext | null,
) {
  if (!context) return { activeTaskId: null, targetRole: "", jdText: "" };
  const linkedTask = tasks
    .filter((task) => task.applicationId === context.id)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  return linkedTask
    ? { activeTaskId: linkedTask.id, targetRole: linkedTask.targetRole, jdText: linkedTask.jdText }
    : { activeTaskId: null, targetRole: context.role, jdText: context.jobDescription };
}
```

- [x] **Step 4: Run the import tests and confirm GREEN**

Run:

```powershell
node.exe node_modules\tsx\dist\cli.mjs --test test/resumes/jd-import.test.ts
```

Expected: all tests PASS.

- [x] **Step 5: Add the server-only application context query**

In `src/features/applications/queries.ts`, add:

```ts
export async function getApplicationJdContext(applicationId: number): Promise<ApplicationJdContext | null> {
  const row = await db.select({
    id: applications.id,
    company: applications.company,
    role: applications.role,
    jobDescription: applications.jobDescription,
  }).from(applications).where(eq(applications.id, applicationId)).limit(1);
  const context = row[0];
  return context?.jobDescription.trim() ? context : null;
}
```

- [x] **Step 6: Parse resume-page context on the server**

Change `src/app/resumes/page.tsx` to accept `searchParams: Promise<{ tab?: string; applicationId?: string }>`.

- `tab === "jd"` selects the JD tab; every other value selects the vault.
- Parse `applicationId` with the existing positive `applicationIdSchema` shape or an equivalent safe Zod parse.
- Query only a valid ID.
- Pass `initialTab`, `applicationContext`, and an import error string to `ResumeWorkspace`.
- Distinguish malformed/not-found/empty-JD with a generic user message: `未找到可导入的投递 JD，请返回投递记录补充后重试。`

- [x] **Step 7: Initialize the workspace and JD form from context**

Add props to `ResumeWorkspace` and initialize `workspaceTab` from `initialTab`. Pass application context into `JdMatchingWorkspace`.

In `JdMatchingWorkspace`:

- initialize `activeTaskId`, `targetRole`, and `jdText` from `resolveJdImportState`;
- include `<input type="hidden" name="applicationId" value={applicationContext?.id ?? ""} />` only for a new imported task;
- show a small source banner such as `来自投递：示例公司 · 后端开发实习生`;
- show the server import error locally above the form;
- selecting `新建匹配` while an import context exists resets to the application role/JD rather than empty strings;
- selecting an existing task always loads that task’s own snapshot.

- [x] **Step 8: Run import/resume tests, typecheck, and lint**

Run:

```powershell
node.exe node_modules\tsx\dist\cli.mjs --test test/resumes/jd-import.test.ts test/resumes/schema.test.ts
npm.cmd run typecheck
npm.cmd run lint
```

Expected: all commands exit 0.

- [x] **Step 9: Commit the JD import flow**

```powershell
git add src/features/applications/queries.ts src/features/applications/jd-context.ts src/features/resumes/jd-import.ts test/resumes/jd-import.test.ts src/app/resumes/page.tsx src/features/resumes/components/resume-workspace.tsx src/features/resumes/components/jd-matching-workspace.tsx
git commit -m "feat: import application JDs into resume matching"
```

### Task 6: Add the read-only interview simulator entry

**Files:**
- Create: `src/features/ai-hub/components/interview-simulator-entry.tsx`
- Modify: `src/app/ai-hub/page.tsx`
- Modify: `src/features/applications/jd-context.ts`
- Modify: `src/features/applications/queries.ts`

**Interfaces:**
- Consumes: server-validated application lookup from Task 5.
- Produces: a read-only `#interview-simulator` section with optional company/role context.
- Does not produce or call any AI interface.

- [x] **Step 1: Add a safe summary query for the placeholder**

Add this type to `src/features/applications/jd-context.ts`, then add a query that does not require a non-empty JD:

```ts
export type ApplicationAiContext = { id: number; company: string; role: string };

export async function getApplicationAiContext(applicationId: number): Promise<ApplicationAiContext | null> {
  const rows = await db.select({
    id: applications.id,
    company: applications.company,
    role: applications.role,
  }).from(applications).where(eq(applications.id, applicationId)).limit(1);
  return rows[0] ?? null;
}
```

- [x] **Step 2: Build the placeholder component**

Create a server-compatible presentational component with `id="interview-simulator"`. It receives:

```ts
{
  context: ApplicationAiContext | null;
  invalidContext: boolean;
}
```

Render:

```text
Title: 面试模拟
Default: 后续版本会在这里组合岗位 JD 与已选简历条目。
Valid context: 已关联投递：<company> · <role>
Invalid context: 未找到对应投递，请从投递记录重新进入。
Status badge/button: 规划中（disabled, no form, no link, no client effect）
```

Do not accept JD text or resume entries as props.

- [x] **Step 3: Parse AI-hub query context on the server**

Change `src/app/ai-hub/page.tsx` to accept `searchParams: Promise<{ applicationId?: string }>` and safely parse a positive integer. Query only valid IDs, render `InterviewSimulatorEntry` before the existing external-tool groups, and leave every existing external link unchanged.

- [x] **Step 4: Verify the placeholder has no external behavior**

Run:

```powershell
rg -n "fetch\(|Invoke-|openai|DeepSeek|navigator\.clipboard|window\.open" src/features/ai-hub src/app/ai-hub
npm.cmd run typecheck
npm.cmd run lint
```

Expected: `rg` returns no new network/clipboard/open calls in the placeholder; typecheck and lint exit 0.

- [x] **Step 5: Commit the future interview entry**

```powershell
git add src/features/ai-hub/components/interview-simulator-entry.tsx src/app/ai-hub/page.tsx src/features/applications/jd-context.ts src/features/applications/queries.ts
git commit -m "feat: reserve an interview simulator entry"
```

### Task 7: Document and verify the integrated workflow

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-08-23-resume-application-jd-linkage.md`

**Interfaces:**
- Consumes: all Tasks 1–6.
- Produces: verified user instructions and completed plan state.

- [x] **Step 1: Document the user workflow**

Add a concise README section that says:

```text
投递记录可以选择保存完整岗位描述。有 JD 的记录可直接进入“简历 → JD 匹配”，系统会复用该投递最近一次匹配任务，或用岗位和 JD 预填新任务；页面跳转不会自动调用 AI。

结构化简历条目在“查看”详情中支持逐字段复制，不提供容易误贴多余内容的“复制全部”。

投递记录中的“面试模拟”当前是下一阶段功能入口，不会发送 JD 或简历数据。
```

- [x] **Step 2: Run every TypeScript test explicitly**

Run with a compatible Node runtime on PATH:

```powershell
$testFiles = @(rg --files src test | Where-Object { $_ -match '\.test\.ts$' })
if ($testFiles.Count -eq 0) { throw "No TypeScript tests found." }
node.exe node_modules\tsx\dist\cli.mjs --test @testFiles
```

Expected: more than zero tests run and every test passes.

- [x] **Step 3: Run all PowerShell release/update tests**

Run:

```powershell
$result = Invoke-Pester test/*.Tests.ps1 -PassThru
if ($result.FailedCount -gt 0) { exit 1 }
```

Expected: every PowerShell test passes.

- [x] **Step 4: Run type, lint, build, migration, and diff checks**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run db:migrate
npm.cmd run build
git diff --check
```

Expected: every command exits 0. If the sandbox blocks Next.js child processes with `EPERM`, rerun the same build outside the sandbox with the approved compatible Node runtime; do not treat an environment error as a product failure.

- [x] **Step 5: Inspect the migration and final diff against the spec**

Confirm all of the following:

```text
No DROP TABLE or DELETE in the 0018 migration
No “copy all” control
No tag copy control
No external AI or Web Search call
No full JD in URL
No interview-simulator data table
Application deletion leaves JD tasks intact through ON DELETE SET NULL
```

- [x] **Step 6: Mark plan checkboxes and commit the completed iteration**

```powershell
git add README.md docs/superpowers/plans/2026-08-23-resume-application-jd-linkage.md
git commit -m "docs: complete the application JD workflow"
```

Do not push or create a GitHub Release unless the user explicitly requests publication after reviewing the completed local commits.
