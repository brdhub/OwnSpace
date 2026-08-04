# Autumn Recruitment Opportunities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a locally cached autumn-recruitment company browser that manually synchronizes the approved Feishu view and turns each company into a planned or prefilled application record.

**Architecture:** A source adapter establishes an anonymous Feishu session, decodes the compressed table metadata, loads the target view rank map, pages through records, and normalizes only records in that view. Server Actions validate and persist normalized rows in SQLite; the UI reads only SQLite and reuses the existing application form.

**Tech Stack:** Next.js 15 App Router, TypeScript strict mode, React 19, Drizzle ORM, SQLite, Zod, Node `fetch`, `node:zlib`, Tailwind CSS, Node test runner through `tsx --test`.

## Global Constraints

- The only permitted source is `https://qcn5ycyl8hgi.feishu.cn/base/DEVcbyxZHa0y1Os89MBcr0tNnjd?table=tblSgpBe77jUnejO&view=vewgPKxdon`.
- Synchronization is user-triggered only; no timer, background job, Feishu write, or arbitrary URL input.
- SQLite remains the sole application data source after synchronization.
- A failed or incomplete synchronization must not deactivate or delete previously synchronized rows.
- All database structure changes use a Drizzle migration and preserve existing user data.
- All write inputs are validated with Zod.
- Do not add dependencies.
- Preserve the unrelated untracked `src/app/icon.png` file and exclude it from feature commits.

---

## File Structure

- Create `src/features/applications/opportunities/constants.ts`: fixed Feishu identifiers, source label, page and size limits.
- Create `src/features/applications/opportunities/types.ts`: normalized source and query result contracts.
- Create `src/features/applications/opportunities/source-schema.ts`: Zod schemas for public Feishu responses.
- Create `src/features/applications/opportunities/feishu-source.ts`: cookie bootstrap, gzip decoding, pagination, field normalization.
- Create `src/features/applications/opportunities/feishu-source.test.ts`: deterministic parser and request-orchestration tests using fixtures.
- Create `src/features/applications/opportunities/repository.ts`: transactional opportunity synchronization and idempotent application drafting.
- Create `src/features/applications/opportunities/repository.test.ts`: pure draft and synchronization decision tests.
- Create `src/features/applications/opportunities/actions.ts`: sync and favorite Server Actions.
- Create `src/features/applications/opportunities/queries.ts`: local search/filter query and filter-option aggregation.
- Create `src/features/applications/opportunities/schemas.ts`: action and URL-query validation.
- Create `src/features/applications/opportunities/components/opportunities-workspace.tsx`: filters, sync status, cards, buttons, and prefilled form modal.
- Create `src/features/applications/components/applications-navigation.tsx`: page-local navigation between records and company browser.
- Create `src/app/applications/opportunities/page.tsx`: lightweight Server Component route.
- Modify `src/db/schema.ts`: opportunity table and optional application association.
- Create `drizzle/0015_*.sql` and update `drizzle/meta/*`: generated migration metadata.
- Modify `src/features/applications/components/application-form.tsx`: support validated initial values and opportunity association.
- Modify `src/features/applications/actions.ts`: persist optional opportunity association.
- Modify `src/features/applications/schemas.ts`: accept optional opportunity ID.
- Modify `src/features/applications/components/applications-workspace.tsx`: render application navigation.
- Modify `src/app/applications/page.tsx`: no business logic; continue route composition only.
- Modify `项目工程约束.md`: register the approved application-module source exception.

---

### Task 1: Persist Recruitment Opportunities Safely

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0015_*.sql`
- Modify: `drizzle/meta/_journal.json`
- Create: `drizzle/meta/0015_snapshot.json`

**Interfaces:**
- Produces: `recruitmentOpportunities`, `RecruitmentOpportunity`, and nullable `applications.opportunityId`.
- Consumes: existing `applications` table and Drizzle migration workflow.

- [ ] **Step 1: Add the schema definition**

Add a `recruitment_opportunities` table with `sourceRecordId` unique, normalized display fields, nullable `applicationUrl`, boolean `isActive`, and audit timestamps. Declare it before `applications`, then add:

```ts
opportunityId: integer("opportunity_id").references(
  () => recruitmentOpportunities.id,
  { onDelete: "set null" },
),
```

Export inferred select and insert types.

- [ ] **Step 2: Generate and inspect the migration**

Run: `npm run db:generate`

Expected: a migration creates `recruitment_opportunities`, its unique/index definitions, and safely adds `applications.opportunity_id` without dropping existing application data.

- [ ] **Step 3: Apply the migration to the local database**

Run: `npm run db:migrate`

Expected: exit code 0; existing application rows remain available.

- [ ] **Step 4: Verify types**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the schema unit**

```powershell
git add -- src/db/schema.ts drizzle
git commit -m "feat: add recruitment opportunity storage"
```

---

### Task 2: Parse and Fetch the Approved Feishu View

**Files:**
- Create: `src/features/applications/opportunities/constants.ts`
- Create: `src/features/applications/opportunities/types.ts`
- Create: `src/features/applications/opportunities/source-schema.ts`
- Create: `src/features/applications/opportunities/feishu-source.ts`
- Create: `src/features/applications/opportunities/feishu-source.test.ts`

**Interfaces:**
- Produces: `fetchFeishuOpportunities(fetchImpl?: typeof fetch): Promise<FeishuOpportunitySnapshot>`.
- Produces: `decodeGzipBase64Json(value: string): unknown` and `normalizeFeishuRecord(...)` for isolated tests.
- Consumes: fixed `FEISHU_SOURCE_URL`, base token `DEVcbyxZHa0y1Os89MBcr0tNnjd`, table ID `tblSgpBe77jUnejO`, and view ID `vewgPKxdon`.

- [ ] **Step 1: Write failing decoder and normalizer tests**

Use `node:test` and `node:assert/strict`. Cover gzip/base64 decoding, rich-text extraction, select-option label lookup, boolean values, date conversion, URL rejection, and a fixture whose company is `东风奕派`.

```ts
test("normalizes a Feishu recruitment record", () => {
  const result = normalizeFeishuRecord("rec001", fixtureRecord, fixtureFields);
  assert.equal(result.company, "东风奕派");
  assert.equal(result.batch, "27届秋招");
  assert.equal(result.unrestrictedMajor, false);
  assert.equal(result.applicationUrl, "https://example.com/apply");
});
```

- [ ] **Step 2: Run tests and observe failure**

Run: `npm test -- src/features/applications/opportunities/feishu-source.test.ts`

Expected: FAIL because the source functions do not exist.

- [ ] **Step 3: Implement fixed constants and Zod response boundaries**

Define exact landing, clientvars, views, and records URLs from the verified public-page flow. Set `FEISHU_PAGE_SIZE = 200`, `FEISHU_MAX_RECORDS = 10_000`, and `FEISHU_SOURCE_LABEL = "飞书秋招企业库"`.

Zod-validate only fields the adapter consumes:

```ts
const encodedPayloadSchema = z.object({
  code: z.literal(0),
  data: z.record(z.unknown()),
});
```

- [ ] **Step 4: Implement gzip and field normalization**

Decode with `gunzipSync(Buffer.from(value, "base64"))`. Map source fields by their names (`公司名称`, `批次`, `岗位更新日期`, `企业类型`, `行业`, `岗位`, `工作城市`, `不限专业`, `网申入口`) instead of hard-coding transient field IDs. Resolve single/multi-select IDs through each field's option map.

- [ ] **Step 5: Write failing request-orchestration test**

Provide a fake `fetch` that returns, in order: landing cookies, clientvars metadata, target-view gzip rank map, and paginated gzip record maps. Assert that the adapter:

```ts
assert.deepEqual(calls.map((call) => call.method), ["GET", "GET", "POST", "GET", "GET"]);
assert.equal(snapshot.opportunities.length, 2);
assert.equal(snapshot.totalSourceRecords, 201);
```

Also assert that a missing target-view record throws and returns no partial snapshot.

- [ ] **Step 6: Implement anonymous-session pagination**

The implementation must:

1. GET the approved landing URL and collect only cookie `name=value` pairs from `Set-Cookie`.
2. GET `/space/api/v1/bitable/{token}/clientvars` with the cookie and `Referer` headers.
3. Decode table metadata to obtain `tableRev`, field definitions, and `recordCount`.
4. POST `/space/api/bitable/views/` with `{ token, tableId, tableRev, viewIdList: [viewId], supportRank: true }` and decode `gzipViews`.
5. GET `/space/api/v1/bitable/{token}/records` in pages with `tableID`, `viewID`, `tableRev`, `viewLazyLoad=true`, `offset`, and `limit=200`.
6. Merge page `recordMap` objects, retain only IDs in the target view's `rankMap`, and sort by rank.
7. Throw if any ranked record is missing, the view has no ranks, the table exceeds 10,000 records, or any response violates its schema.

Use an `AbortController` timeout for every request and cap decoded aggregate data before parsing.

- [ ] **Step 7: Run source tests**

Run: `npm test -- src/features/applications/opportunities/feishu-source.test.ts`

Expected: PASS without real network access.

- [ ] **Step 8: Commit the adapter**

```powershell
git add -- src/features/applications/opportunities/constants.ts src/features/applications/opportunities/types.ts src/features/applications/opportunities/source-schema.ts src/features/applications/opportunities/feishu-source.ts src/features/applications/opportunities/feishu-source.test.ts
git commit -m "feat: add Feishu recruitment source adapter"
```

---

### Task 3: Synchronize Locally and Favorite Idempotently

**Files:**
- Create: `src/features/applications/opportunities/schemas.ts`
- Create: `src/features/applications/opportunities/repository.ts`
- Create: `src/features/applications/opportunities/repository.test.ts`
- Create: `src/features/applications/opportunities/actions.ts`
- Modify: `src/features/applications/schemas.ts`
- Modify: `src/features/applications/actions.ts`

**Interfaces:**
- Produces: `syncRecruitmentOpportunitiesAction(previousState, formData)`.
- Produces: `favoriteOpportunityAction(previousState, formData)`.
- Produces: `buildApplicationDraft(opportunity, mode): ApplicationInitialValues`.
- Consumes: `fetchFeishuOpportunities()` and the tables from Task 1.

- [ ] **Step 1: Write failing draft and synchronization-decision tests**

Assert planned and applied drafts differ only where expected:

```ts
assert.equal(buildApplicationDraft(row, "favorite").status, "planned");
assert.equal(buildApplicationDraft(row, "apply").status, "applied");
assert.equal(buildApplicationDraft(row, "apply").opportunityId, row.id);
```

Test that a complete snapshot may deactivate missing source IDs while an exception never reaches the deactivation function.

- [ ] **Step 2: Run tests and observe failure**

Run: `npm test -- src/features/applications/opportunities/repository.test.ts`

Expected: FAIL because repository helpers do not exist.

- [ ] **Step 3: Implement transactional synchronization**

Use one SQLite transaction. Upsert by `sourceRecordId`, set every received row active, then set rows absent from the complete source-ID set inactive. Return `{ inserted, updated, active, syncedAt }`. Never call this transaction until `fetchFeishuOpportunities()` has returned a complete snapshot.

- [ ] **Step 4: Implement validated actions**

`favoriteOpportunityAction` validates an integer `opportunityId`, loads an active opportunity, and either updates its already-associated application to `planned` or creates exactly one application with today's date, source label, normalized company size, and source details in notes.

`syncRecruitmentOpportunitiesAction` exposes concise user-facing success/errors, revalidates `/applications/opportunities` and `/applications`, and never returns raw external response content.

- [ ] **Step 5: Extend application creation validation**

Add `opportunityId: z.coerce.number().int().positive().optional()` to the create schema and persist it in `createApplicationAction`. The update action must preserve the association unless an explicit validated ID is supplied.

- [ ] **Step 6: Run repository and application tests**

Run: `npm test -- src/features/applications/opportunities/repository.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit synchronization behavior**

```powershell
git add -- src/features/applications/opportunities/schemas.ts src/features/applications/opportunities/repository.ts src/features/applications/opportunities/repository.test.ts src/features/applications/opportunities/actions.ts src/features/applications/schemas.ts src/features/applications/actions.ts
git commit -m "feat: sync and favorite recruitment opportunities"
```

---

### Task 4: Add the Autumn Recruitment Browser and Prefilled Apply Form

**Files:**
- Create: `src/features/applications/opportunities/queries.ts`
- Create: `src/features/applications/opportunities/components/opportunities-workspace.tsx`
- Create: `src/features/applications/components/applications-navigation.tsx`
- Create: `src/app/applications/opportunities/page.tsx`
- Modify: `src/features/applications/components/application-form.tsx`
- Modify: `src/features/applications/components/applications-workspace.tsx`

**Interfaces:**
- Produces: `getRecruitmentOpportunities(filters)` and `OpportunitiesWorkspace`.
- Consumes: Task 3 actions and `ApplicationInitialValues`.

- [ ] **Step 1: Implement local queries with validated filters**

Support `query`, `companyType`, `city`, and `unrestrictedMajor`. Always include `isActive = true`; search company and roles with SQL `LIKE`; return associated application status through a left join. Aggregate distinct company types and cities for filter controls.

- [ ] **Step 2: Extend `ApplicationForm` initial values**

Add:

```ts
type ApplicationInitialValues = Partial<Pick<Application,
  "company" | "role" | "source" | "status" | "internshipType" |
  "companySize" | "appliedDate" | "applicationUrl" | "notes" |
  "opportunityId"
>>;
```

When `application` is absent, use `initialValues` before blank defaults and render a hidden `opportunityId` input. Keep edit behavior unchanged.

- [ ] **Step 3: Add page-local navigation**

Render two compact links: `投递记录` → `/applications` and `秋招企业` → `/applications/opportunities`. Use the current pathname for the active style.

- [ ] **Step 4: Build the opportunity workspace**

The client component contains:

- URL-backed search and filters.
- Manual sync form with pending state and last-sync/result copy.
- Responsive opportunity cards showing company, batch, company type, industry, roles, cities, major restriction, and source update date.
- `收藏` form that becomes `已在计划中` after success.
- `投递` button that opens `ApplicationForm` with an applied draft.
- `打开投递页` external link only for validated URLs.
- Empty state explaining that the first manual synchronization is required.

- [ ] **Step 5: Compose the route**

Keep `src/app/applications/opportunities/page.tsx` limited to validating search params, calling the query, and rendering `PageContainer`, navigation, and workspace. Set `dynamic = "force-dynamic"`.

- [ ] **Step 6: Run typecheck and lint**

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 7: Commit the UI unit**

```powershell
git add -- src/app/applications src/features/applications/components src/features/applications/opportunities
git commit -m "feat: add autumn recruitment browser"
```

---

### Task 5: Register the Source Exception and Verify End to End

**Files:**
- Modify: `项目工程约束.md`
- Modify only if commands changed: `README.md`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: documented, verified feature ready for user testing.

- [ ] **Step 1: Update the engineering constraint**

Add an application-module exception that permits user-triggered read-only synchronization from the exact approved Feishu URL and explicitly prohibits background fetching and Feishu writes.

- [ ] **Step 2: Run automated verification**

Run:

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 3: Run one live synchronization smoke test**

Start the app, open `/applications/opportunities`, click `同步飞书`, and verify that the first visible company matches the target view ordering, the displayed active count is non-zero, and no existing application record disappears.

- [ ] **Step 4: Verify favorite and apply paths**

Favorite one opportunity and confirm exactly one planned application exists after clicking twice. Open `投递`, confirm the form is prefilled, save it, and confirm the associated application is shown in `/applications` with status `已投递`.

- [ ] **Step 5: Verify failure preservation**

Temporarily inject a failing fetch in the source adapter test and confirm the synchronization test leaves old active records untouched. Do not alter the production source constant for this check.

- [ ] **Step 6: Inspect the final diff**

Run: `git status --short` and `git diff --check`

Expected: only intended feature files plus the pre-existing untracked `src/app/icon.png`; no whitespace errors or generated build artifacts.

- [ ] **Step 7: Commit documentation and final fixes**

```powershell
git add -- 项目工程约束.md README.md
git commit -m "docs: register recruitment data source"
```

Do not stage `README.md` if it did not change. Do not push without a separate user request.
