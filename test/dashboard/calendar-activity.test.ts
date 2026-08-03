import assert from "node:assert/strict";
import test from "node:test";

import { buildCalendarActivityDays } from "../../src/features/dashboard/calendar-activity";

test("combines journal, completed study, and application counts by date", () => {
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
});

test("returns activity days in date order", () => {
  const days = buildCalendarActivityDays({
    journals: [{ date: "2026-08-05" }],
    studyCheckins: [],
    applications: [{ date: "2026-08-02" }],
  });

  assert.deepEqual(
    days.map((day) => day.date),
    ["2026-08-02", "2026-08-05"],
  );
});
