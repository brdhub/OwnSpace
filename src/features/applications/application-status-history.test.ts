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

test("轮次迁移保留旧数据，二面到三面会留痕，相同轮次不会重复记录", () => {
  const sqlite = new Database(":memory:");
  try {
    sqlite.exec("CREATE TABLE applications (id integer PRIMARY KEY, status text NOT NULL, created_at text NOT NULL, updated_at text NOT NULL, notes text)");
    sqlite.exec("INSERT INTO applications VALUES (1, 'laterInterview', '2025-01-01', '2025-01-01', '保留备注')");
    for (const file of ["0024_mute_stryfe.sql", "0026_application_interview_round.sql"]) {
      for (const statement of readFileSync(join(process.cwd(), "drizzle", file), "utf8").split("--> statement-breakpoint")) sqlite.exec(statement);
    }
    assert.deepEqual(sqlite.prepare("SELECT notes, interview_round FROM applications WHERE id=1").get(), {notes: "保留备注", interview_round: null});
    sqlite.exec("UPDATE applications SET interview_round=2 WHERE id=1");
    sqlite.exec("UPDATE applications SET interview_round=3 WHERE id=1");
    sqlite.exec("UPDATE applications SET status='laterInterview', interview_round=3 WHERE id=1");
    assert.deepEqual(sqlite.prepare("SELECT interview_round FROM application_status_events ORDER BY id").all(), [{interview_round: null}, {interview_round: 2}, {interview_round: 3}]);
    sqlite.exec("UPDATE applications SET status='offer', interview_round=NULL WHERE id=1");
    assert.deepEqual(sqlite.prepare("SELECT to_status, interview_round FROM application_status_events ORDER BY id DESC LIMIT 1").get(), {to_status: "offer", interview_round: null});
    sqlite.exec("INSERT INTO applications (id,status,created_at,updated_at,interview_round) VALUES (2,'laterInterview','2025-01-02','2025-01-02',4)");
    assert.deepEqual(sqlite.prepare("SELECT interview_round FROM application_status_events WHERE application_id=2").get(), {interview_round: 4});
  } finally {sqlite.close();}
});
