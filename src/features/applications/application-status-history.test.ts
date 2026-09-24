import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";

test("状态历史迁移保留旧记录快照，并只记录真实状态变化", () => {
  const sqlite = new Database(":memory:");
  try {
    sqlite.pragma("foreign_keys = ON");
    sqlite.exec("CREATE TABLE applications (id integer PRIMARY KEY, status text NOT NULL, created_at text NOT NULL, updated_at text NOT NULL, notes text)");
    sqlite.prepare("INSERT INTO applications VALUES (1, 'assessment', '2025-01-01T00:00:00Z', '2025-01-02T00:00:00Z', '')").run();

    const migration = readFileSync(join(process.cwd(), "drizzle", "0024_mute_stryfe.sql"), "utf8");
    for (const statement of migration.split("--> statement-breakpoint")) sqlite.exec(statement);

    const rows = () => sqlite.prepare("SELECT application_id, from_status, to_status, kind FROM application_status_events ORDER BY id").all();
    assert.deepEqual(rows(), [{ application_id: 1, from_status: null, to_status: "assessment", kind: "baseline" }]);

    sqlite.prepare("UPDATE applications SET notes = 'edited' WHERE id = 1").run();
    sqlite.prepare("UPDATE applications SET status = 'assessment' WHERE id = 1").run();
    assert.equal(rows().length, 1);

    sqlite.prepare("UPDATE applications SET status = 'firstInterview', updated_at = '2025-01-03T00:00:00Z' WHERE id = 1").run();
    sqlite.prepare("UPDATE applications SET status = 'offer', updated_at = '2025-01-04T00:00:00Z' WHERE id = 1").run();
    sqlite.prepare("INSERT INTO applications VALUES (2, 'applied', '2025-01-05T00:00:00Z', '2025-01-05T00:00:00Z', '')").run();
    assert.deepEqual(rows(), [
      { application_id: 1, from_status: null, to_status: "assessment", kind: "baseline" },
      { application_id: 1, from_status: "assessment", to_status: "firstInterview", kind: "changed" },
      { application_id: 1, from_status: "firstInterview", to_status: "offer", kind: "changed" },
      { application_id: 2, from_status: null, to_status: "applied", kind: "created" },
    ]);

    sqlite.prepare("INSERT INTO application_status_events (application_id, from_status, to_status, kind, occurred_at) VALUES (1, NULL, 'applied', 'manual', '2025-01-01')").run();
    assert.deepEqual(sqlite.prepare("SELECT kind FROM application_status_events WHERE application_id = 1 ORDER BY occurred_at DESC, id DESC").all(), [
      { kind: "baseline" }, { kind: "changed" }, { kind: "changed" }, { kind: "manual" },
    ]);

    sqlite.prepare("DELETE FROM applications WHERE id = 1").run();
    assert.deepEqual(rows(), [{ application_id: 2, from_status: null, to_status: "applied", kind: "created" }]);
  } finally {
    sqlite.close();
  }
});
