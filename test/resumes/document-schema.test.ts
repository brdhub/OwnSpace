import assert from "node:assert/strict";
import test from "node:test";
import { getTableConfig } from "drizzle-orm/sqlite-core";

import {
  resumeAiRuns,
  resumeDrafts,
  resumeOptimizationSuggestions,
  resumeOptimizationTasks,
  resumeVersions,
} from "../../src/db/schema";

function columnsOf(table: Parameters<typeof getTableConfig>[0]) {
  return Object.fromEntries(getTableConfig(table).columns.map((column) => [column.name, column]));
}

test("document tables store optimistic revisions and legacy suggestions start invalid", () => {
  const taskColumns = columnsOf(resumeOptimizationTasks);
  const suggestionColumns = columnsOf(resumeOptimizationSuggestions);
  const draftColumns = columnsOf(resumeDrafts);

  assert.equal(taskColumns.input_revision.notNull, true);
  assert.equal(taskColumns.input_revision.default, 1);
  assert.equal(suggestionColumns.input_revision.notNull, true);
  assert.equal(suggestionColumns.input_revision.default, 0);
  assert.equal(draftColumns.task_id.primary, true);
  assert.equal(draftColumns.schema_version.default, 1);
  assert.equal(draftColumns.revision.default, 1);
});

test("resume versions remain available after their source task is deleted", () => {
  const config = getTableConfig(resumeVersions);
  const columns = columnsOf(resumeVersions);
  const taskReference = config.foreignKeys
    .map((foreignKey) => ({ ...foreignKey.reference(), onDelete: foreignKey.onDelete }))
    .find((reference) => reference.columns[0].name === "task_id");

  assert.equal(columns.task_id.notNull, false);
  assert.equal(taskReference?.onDelete, "set null");
  assert.equal(columns.name.notNull, true);
  assert.equal(columns.version_number.notNull, true);
  assert.equal(columns.schema_version.notNull, true);
  assert.equal(columns.template_version.notNull, true);
  assert.equal(
    config.indexes.some((tableIndex) => tableIndex.config.name === "resume_versions_idempotency_key_unique" && tableIndex.config.unique),
    true,
  );
});

test("AI runs allow one running operation per task through a partial unique index", () => {
  const config = getTableConfig(resumeAiRuns);
  const columns = columnsOf(resumeAiRuns);
  const runningIndex = config.indexes.find(
    (tableIndex) => tableIndex.config.name === "resume_ai_runs_task_operation_running_unique",
  );

  assert.equal(columns.id.primary, true);
  assert.equal(columns.task_id.notNull, false);
  assert.equal(columns.input_tokens.notNull, false);
  assert.equal(columns.output_tokens.notNull, false);
  assert.equal(runningIndex?.config.unique, true);
  assert.ok(runningIndex?.config.where);
});
