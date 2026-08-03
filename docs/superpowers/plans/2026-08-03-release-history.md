# Release History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将版本弹窗升级为可持续追加的历史更新日志，并保留现有当前版本导出接口。

**Architecture:** 使用 `src/config/app-version.ts` 中按日期倒序排列的静态只读数组作为唯一数据源，数组首项派生当前版本。Sidebar 仅负责遍历并展示历史记录，通过最大高度和滚动控制长期增长后的尺寸。

**Tech Stack:** TypeScript、React、Next.js、Node.js test runner、Tailwind CSS

## Global Constraints

- 不增加数据库、迁移或第三方依赖。
- 保持版本号按钮的位置与开关交互不变。
- 历史版本按发布日期从新到旧排列。
- 后续版本更新只需在 `appReleases` 数组顶部追加一项。
- 保留现有 `appRelease`、`appVersion`、`appUpdatedAt` 导出。

---

### Task 1: 历史版本配置

**Files:**
- Modify: `test/layout/app-version.test.ts`
- Modify: `src/config/app-version.ts`

**Interfaces:**
- Produces: `appReleases` 只读版本数组。
- Produces: `appRelease = appReleases[0]` 当前版本别名。

- [ ] **Step 1: 写入失败测试**

```ts
import { appRelease, appReleases } from "../../src/config/app-version";

test("release history keeps current release first and every entry complete", () => {
  assert.equal(appReleases.length >= 2, true);
  assert.equal(appRelease, appReleases[0]);
  assert.deepEqual(appReleases.map((release) => release.version), ["2.1", "2.0"]);
  assert.equal(appReleases.every((release) => release.notes.length > 0), true);
});

test("release history is ordered newest first", () => {
  const dates = appReleases.map((release) => release.updatedAtIso);
  assert.deepEqual(dates, [...dates].sort().reverse());
});
```

- [ ] **Step 2: 运行测试并确认因 `appReleases` 尚不存在而失败**

Run: `C:\Users\brddd\tools\node-v22.22.3-win-x64\node.exe node_modules/tsx/dist/cli.mjs --test test/layout/app-version.test.ts`
Expected: FAIL，提示缺少 `appReleases` 导出。

- [ ] **Step 3: 实现最小配置**

```ts
export const appReleases = [
  {
    version: "2.1",
    updatedAt: "2026年8月3日",
    updatedAtIso: "2026-08-03",
    notes: [
      "简历仓库采用更紧凑的左右分栏布局。",
      "JD 匹配增加完整性校验与稳定的默认选材。",
      "开放针对 JD 的条目描述优化与建议审核。",
      "修复 Windows 更新依赖时的文件占用问题。",
    ],
  },
  {
    version: "2.0",
    updatedAt: "2026年8月2日",
    updatedAtIso: "2026-08-02",
    notes: [
      "新增简历 PDF 上传、文本解析与原件管理。",
      "接入 DeepSeek 生成并审核结构化候选条目。",
      "新增正式简历条目去重与 JD 匹配选材。",
    ],
  },
] as const;

export const appRelease = appReleases[0];
```

- [ ] **Step 4: 运行配置测试并确认通过**

Run: `C:\Users\brddd\tools\node-v22.22.3-win-x64\node.exe node_modules/tsx/dist/cli.mjs --test test/layout/app-version.test.ts`
Expected: PASS，0 failures。

### Task 2: 历史日志弹窗

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

**Interfaces:**
- Consumes: `appRelease` 用于按钮文字和悬浮日期。
- Consumes: `appReleases` 用于历史列表。

- [ ] **Step 1: 将弹窗数据源切换为历史数组**

```tsx
<h2>历史更新日志</h2>
<div className="mt-3 max-h-80 space-y-4 overflow-y-auto pr-1">
  {appReleases.map((release) => (
    <section key={release.version} aria-labelledby={`release-${release.version}`}>
      <h3 id={`release-${release.version}`}>v{release.version}</h3>
      <time dateTime={release.updatedAtIso}>{release.updatedAt}</time>
      <ul>{release.notes.map((note) => <li key={note}>· {note}</li>)}</ul>
    </section>
  ))}
</div>
```

- [ ] **Step 2: 运行完整验证**

Run: `C:\Users\brddd\tools\node-v22.22.3-win-x64\node.exe node_modules/tsx/dist/cli.mjs --test`
Expected: 全部测试通过。

Run: `C:\Users\brddd\tools\node-v22.22.3-win-x64\node.exe node_modules/typescript/bin/tsc --noEmit`
Expected: exit 0。

Run: `C:\Users\brddd\tools\node-v22.22.3-win-x64\node.exe node_modules/eslint/bin/eslint.js .`
Expected: exit 0。

Run: `C:\Users\brddd\tools\node-v22.22.3-win-x64\node.exe node_modules/next/dist/bin/next build`
Expected: production build 成功。
