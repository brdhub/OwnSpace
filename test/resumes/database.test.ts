import assert from "node:assert/strict";
import test from "node:test";
import { getTableConfig } from "drizzle-orm/sqlite-core";

import {
  applications,
  resumeAssets,
  resumeEntries,
  resumeEntryCandidates,
  resumeOptimizationTasks,
} from "../../src/db/schema";

test("resume assets keep AI extraction state separate from PDF parsing", () => {
  const columns = Object.fromEntries(getTableConfig(resumeAssets).columns.map((column) => [column.name, column]));

  assert.equal(columns.entry_extraction_status.default, "idle");
  assert.equal(columns.entry_extraction_status.notNull, true);
  assert.equal(columns.entry_extraction_error.notNull, false);
  assert.equal(columns.entry_extracted_at.notNull, false);
});

test("resume candidates cascade with assets and retain set-null duplicate links", () => {
  const config = getTableConfig(resumeEntryCandidates);
  const foreignKeys = config.foreignKeys.map((foreignKey) => ({
    ...foreignKey.reference(),
    onDelete: foreignKey.onDelete,
  }));
  const assetReference = foreignKeys.find((reference) => reference.columns[0].name === "resume_asset_id");
  const duplicateReference = foreignKeys.find((reference) => reference.columns[0].name === "duplicate_entry_id");

  assert.equal(assetReference?.foreignColumns[0].name, "id");
  assert.equal(assetReference?.onDelete, "cascade");
  assert.equal(duplicateReference?.foreignColumns[0].name, "id");
  assert.equal(duplicateReference?.onDelete, "set null");
});

test("structured resume storage removes completeness and persists candidate tags", () => {
  const entryColumns = Object.fromEntries(getTableConfig(resumeEntries).columns.map((column) => [column.name, column]));
  const candidateColumns = Object.fromEntries(getTableConfig(resumeEntryCandidates).columns.map((column) => [column.name, column]));

  assert.equal("completeness" in entryColumns, false);
  assert.equal(candidateColumns.tags_json.notNull, true);
  assert.equal(candidateColumns.tags_json.default, "[]");
});

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
  assert.equal(
    taskConfig.indexes.some((taskIndex) => taskIndex.config.name === "resume_optimization_tasks_application_id_idx"),
    true,
  );
});
