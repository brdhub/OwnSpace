import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("the v3.4 migration preserves legacy versions and changes task deletion to set null", () => {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(`
    CREATE TABLE resume_optimization_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      target_role TEXT NOT NULL,
      jd_text TEXT DEFAULT '' NOT NULL
    );
    CREATE TABLE resume_optimization_suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL
    );
    CREATE TABLE resume_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      task_id INTEGER NOT NULL,
      accepted_content_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES resume_optimization_tasks(id) ON DELETE CASCADE
    );
    INSERT INTO resume_optimization_tasks(id, target_role, jd_text)
      VALUES (4, 'Java 开发', '历史 JD');
    INSERT INTO resume_versions(id, task_id, accepted_content_json, created_at)
      VALUES (9, 4, '{"suggestions":[{"materialId":7,"proposedText":"历史描述"}]}', '2026-08-01T00:00:00.000Z');
  `);

  const migration = readFileSync(resolve(process.cwd(), "drizzle", "0019_yellow_red_skull.sql"), "utf8");
  migration.split("--> statement-breakpoint").map((statement) => statement.trim()).filter(Boolean)
    .forEach((statement) => sqlite.exec(statement));

  assert.deepEqual(sqlite.prepare(`
    SELECT id, task_id AS taskId, name, version_number AS versionNumber,
      schema_version AS schemaVersion, template_version AS templateVersion,
      idempotency_key AS idempotencyKey, accepted_content_json AS contentJson
    FROM resume_versions
  `).get(), {
    id: 9,
    taskId: 4,
    name: "历史版本 9",
    versionNumber: 9,
    schemaVersion: 0,
    templateVersion: "classic-v1",
    idempotencyKey: null,
    contentJson: '{"suggestions":[{"materialId":7,"proposedText":"历史描述"}]}',
  });
  assert.equal(sqlite.prepare("SELECT input_revision FROM resume_optimization_tasks WHERE id = 4").pluck().get(), 1);

  sqlite.prepare(`
    INSERT INTO resume_ai_runs(
      id, task_id, operation, input_revision, input_hash, status, prompt_version, started_at
    ) VALUES (?, 4, 'optimization', 1, 'hash', 'running', 'v1', '2026-09-05T00:00:00.000Z')
  `).run("run-1");
  assert.throws(() => sqlite.prepare(`
    INSERT INTO resume_ai_runs(
      id, task_id, operation, input_revision, input_hash, status, prompt_version, started_at
    ) VALUES (?, 4, 'optimization', 1, 'hash', 'running', 'v1', '2026-09-05T00:00:00.000Z')
  `).run("run-2"), /UNIQUE constraint failed/);

  sqlite.prepare("DELETE FROM resume_optimization_tasks WHERE id = 4").run();
  assert.equal(sqlite.prepare("SELECT task_id FROM resume_versions WHERE id = 9").pluck().get(), null);
  assert.equal(sqlite.prepare("SELECT task_id FROM resume_ai_runs WHERE id = 'run-1'").pluck().get(), null);
});
