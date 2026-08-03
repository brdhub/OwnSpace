# 2.1 Interaction Patch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为历史更新日志增加外部点击收起，并让首页日历按日期展示投递数量。

**Architecture:** 将日历活动聚合提取为无数据库依赖的纯函数，由 Dashboard 查询层提供日记、学习与投递行数据。Sidebar 在弹窗开启期间注册文档级事件监听，并在关闭或卸载时清理；日历组件只消费聚合后的 `applicationCount`。

**Tech Stack:** Next.js、React、TypeScript、SQLite、Drizzle ORM、Node.js test runner、Tailwind CSS

## Global Constraints

- 不增加数据库字段、迁移或第三方依赖。
- 同日多条投递按记录数累加。
- 日历使用蓝色表示投递，保留现有橙色日记、红色面试和绿色学习视觉语义。
- 历史日志点击容器外或按 Esc 收起，容器内部点击保持展开。
- 本补丁追加到 v2.1 历史更新日志。

---

### Task 1: 日历活动聚合

**Files:**
- Create: `src/features/dashboard/calendar-activity.ts`
- Create: `test/dashboard/calendar-activity.test.ts`
- Modify: `src/features/dashboard/queries.ts`

**Interfaces:**
- Produces: `CalendarActivityDay`，字段为 `date`、`hasJournal`、`completedStudyCount`、`applicationCount`。
- Produces: `buildCalendarActivityDays(input: CalendarActivityInput): CalendarActivityDay[]`。
- Consumes: 查询结果中的日记日期、学习完成状态与投递日期。

- [ ] **Step 1: 写入失败测试**

```ts
const days = buildCalendarActivityDays({
  journals: [{ date: "2026-08-03" }],
  studyCheckins: [
    { date: "2026-08-03", completed: true },
    { date: "2026-08-03", completed: false },
  ],
  applications: [
    { date: "2026-08-03" },
    { date: "2026-08-03" },
    { date: "2026-08-04" },
  ],
});

assert.deepEqual(days, [
  { date: "2026-08-03", hasJournal: true, completedStudyCount: 1, applicationCount: 2 },
  { date: "2026-08-04", hasJournal: false, completedStudyCount: 0, applicationCount: 1 },
]);
```

- [ ] **Step 2: 运行测试并确认因模块尚不存在而失败**

Run: `C:\Users\brddd\tools\node-v22.22.3-win-x64\node.exe node_modules/tsx/dist/cli.mjs --test test/dashboard/calendar-activity.test.ts`
Expected: FAIL，提示无法导入 `calendar-activity`。

- [ ] **Step 3: 实现聚合函数并接入查询**

```ts
export function buildCalendarActivityDays(input: CalendarActivityInput): CalendarActivityDay[] {
  const activityByDate = new Map<string, CalendarActivityDay>();
  // 按日期合并日记、已完成学习项和投递数量，最后升序返回。
}
```

`getCalendarActivityDays()` 使用 `Promise.all` 查询三类数据，并将结果传入该函数。

- [ ] **Step 4: 运行单元测试并确认通过**

Run: `C:\Users\brddd\tools\node-v22.22.3-win-x64\node.exe node_modules/tsx/dist/cli.mjs --test test/dashboard/calendar-activity.test.ts`
Expected: PASS，0 failures。

### Task 2: 日历投递标记与更新日志收起

**Files:**
- Modify: `src/features/dashboard/components/interview-calendar.tsx`
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/config/app-version.ts`

**Interfaces:**
- Consumes: `CalendarActivityDay.applicationCount`。
- Consumes: Sidebar 容器的 `HTMLElement.contains()` 判断外部点击。

- [ ] **Step 1: 更新日历状态条、图例、说明与选中日期详情**

```tsx
<span className={cn("h-1.5 rounded-[2px]", activity?.applicationCount ? "bg-sky-500" : "bg-muted")} />
```

日期无障碍说明包含 `投递 ${activity?.applicationCount ?? 0} 份`，选中日期显示“已投递 N 份”或“未投递”。

- [ ] **Step 2: 增加日志弹窗关闭监听**

```tsx
const releaseNotesRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!releaseNotesOpen) return;
  const closeOutside = (event: PointerEvent) => {
    if (!releaseNotesRef.current?.contains(event.target as Node)) setReleaseNotesOpen(false);
  };
  const closeOnEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") setReleaseNotesOpen(false);
  };
  document.addEventListener("pointerdown", closeOutside);
  document.addEventListener("keydown", closeOnEscape);
  return () => {
    document.removeEventListener("pointerdown", closeOutside);
    document.removeEventListener("keydown", closeOnEscape);
  };
}, [releaseNotesOpen]);
```

- [ ] **Step 3: 追加 v2.1 日志内容**

在 v2.1 `notes` 末尾加入外部收起与日历投递标记两条说明。

### Task 3: 验证与发布准备

**Files:**
- Modify: `docs/superpowers/plans/2026-08-03-release-popover-calendar-applications.md`

- [ ] **Step 1: 运行完整自动化验证**

Run: `C:\Users\brddd\tools\node-v22.22.3-win-x64\node.exe node_modules/tsx/dist/cli.mjs --test`

Run: `C:\Users\brddd\tools\node-v22.22.3-win-x64\node.exe node_modules/typescript/bin/tsc --noEmit`

Run: `C:\Users\brddd\tools\node-v22.22.3-win-x64\node.exe node_modules/eslint/bin/eslint.js .`

Run: `C:\Users\brddd\tools\node-v22.22.3-win-x64\node.exe node_modules/next/dist/bin/next build`

Expected: 所有命令 exit 0，完整测试 0 failures。

- [ ] **Step 2: 实际页面验证**

在本地生产页面完成以下检查：

- 点击 v2.1 展开日志，再点击主内容区，日志收起。
- 再次展开后按 Esc，日志收起。
- 首页日历图例包含“投递”。
- 至少一个已有投递日期的按钮说明包含“投递 N 份”。

- [ ] **Step 3: 提交 2.1 版本**

仅在确认全部工作区改动均属于 2.1 后，暂存并提交，提交信息为 `release: OwnSpace 2.1`。
