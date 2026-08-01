import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const sqlitePath = resolve(process.cwd(), "data", "ownspace.db");

if (!existsSync(sqlitePath)) {
  console.log("No local database found.");
  process.exit(0);
}

const db = new Database(sqlitePath);

db.prepare("delete from interview_note_tags").run();
db.prepare("delete from interview_questions").run();
db.prepare("delete from interview_notes").run();
db.prepare("delete from internship_entries").run();
db.prepare("delete from internship_records").run();
db.prepare("delete from journal_entries").run();
db.prepare("delete from study_checkins").run();
db.prepare("delete from applications").run();
db.prepare("delete from daily_actions").run();
db.prepare(
  "delete from sqlite_sequence where name in ('applications', 'daily_actions', 'internship_entries', 'internship_records', 'interview_notes', 'interview_questions', 'journal_entries', 'study_checkins')",
).run();

console.log("Local application data cleared.");
