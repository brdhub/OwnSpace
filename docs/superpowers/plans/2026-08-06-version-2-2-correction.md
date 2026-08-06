# OwnSpace v2.2 Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 以新增提交把错误的 v1.2 当前版本纠正为 v2.2，并推送到 `origin/master`。

**Architecture:** 沿用 `src/config/app-version.ts` 作为 UI 版本和更新日志的唯一来源，并同步 npm 根项目版本。修改仅限版本元数据与对应测试，不触及业务或数据库。

**Tech Stack:** TypeScript、Node.js、Next.js、Node test runner、Git

## Global Constraints

- 当前展示版本必须为 `2.2`。
- npm 包版本必须为 `2.2.0`。
- 当前发布日期必须为 `2026-08-06`。
- 历史版本必须为 `2.2`、`2.1`、`2.0`，不得继续展示错误的 `1.2`。
- 必须新增普通提交，不得改写历史或强推。

---

### Task 1: 纠正版本契约与元数据

**Files:**
- Modify: `test/layout/app-version.test.ts`
- Modify: `src/config/app-version.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `appReleases`, `appRelease`, `appVersion`
- Produces: 当前版本 `2.2`、npm 版本 `2.2.0` 与正确历史发布数组

- [ ] **Step 1: 写入失败测试**

将版本数组期望值改为 `["2.2", "2.1", "2.0"]`，并断言首条发布日期为 `2026-08-06`。

- [ ] **Step 2: 验证测试因旧版本失败**

Run: `npm.cmd test -- test/layout/app-version.test.ts`
Expected: FAIL，实际首项仍为 `1.2`。

- [ ] **Step 3: 最小化纠正版本元数据**

将 `appReleases[0]` 的版本和日期改为 `2.2`、`2026-08-06`，并将 npm 根版本改为 `2.2.0`；保持秋招企业日志内容不变。

- [ ] **Step 4: 验证定向测试通过**

Run: `npm.cmd test -- test/layout/app-version.test.ts`
Expected: 2 tests PASS。

- [ ] **Step 5: 完整验证**

Run: `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`, `git diff --check`
Expected: 全部退出码为 0。

- [ ] **Step 6: 新增提交并正常推送**

```powershell
git add package.json package-lock.json src/config/app-version.ts test/layout/app-version.test.ts docs/superpowers
git commit -m "fix: correct version to 2.2"
git push origin master
```
