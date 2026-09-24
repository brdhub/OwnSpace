import assert from "node:assert/strict";
import test from "node:test";
import { buildApplicationStatistics, buildDashboardApplicationStatistics } from "./application-statistics";

test("statistics count records by status and recruitment type within the selected rows", () => {
  const result = buildApplicationStatistics([
    { appliedDate: "2026-09-01", status: "applied", internshipType: "autumn" },
    { appliedDate: "2026-09-01", status: "offer", internshipType: "autumn" },
    { appliedDate: "2026-09-03", status: "planned", internshipType: "daily" },
  ], "2026-09-01", "2026-09-03");

  assert.equal(result.total, 3);
  assert.deepEqual(result.statusCounts.filter((item) => item.count), [
    { key: "planned", count: 1 },
    { key: "applied", count: 1 },
    { key: "offer", count: 1 },
  ]);
  assert.deepEqual(result.typeCounts.filter((item) => item.count), [
    { key: "daily", count: 1 },
    { key: "autumn", count: 2 },
  ]);
  assert.deepEqual(result.trend, [
    { label: "09-01", count: 2 },
    { label: "09-02", count: 0 },
    { label: "09-03", count: 1 },
  ]);
});

test("long ranges group earlier months while preserving the total", () => {
  const result = buildApplicationStatistics([
    { appliedDate: "2025-01-15", status: "applied", internshipType: "daily" },
    { appliedDate: "2026-08-08", status: "offer", internshipType: "autumn" },
  ], "2025-01-01", "2026-09-30");

  assert.equal(result.trend[0].label, "更早");
  assert.equal(result.trend[0].count, 1);
  assert.deepEqual(result.trend.at(-2), { label: "2026-08", count: 1 });
  assert.equal(result.trend.reduce((sum, item) => sum + item.count, 0), 2);
});

test("empty ranges have zero counts and no trend bars", () => {
  const result = buildApplicationStatistics([], "", "");
  assert.equal(result.total, 0);
  assert.deepEqual(result.trend, []);
});

test("dashboard statistics keep the full history and limit the recent view to 30 days", () => {
  const rows = [
    { appliedDate: "2026-08-25", status: "applied" as const, internshipType: "summer" as const },
    { appliedDate: "2026-08-26", status: "offer" as const, internshipType: "autumn" as const },
    { appliedDate: "2026-09-24", status: "applied" as const, internshipType: "autumn" as const },
  ];

  assert.equal(buildDashboardApplicationStatistics(rows, "2026-09-24", "all").total, 3);
  const recent = buildDashboardApplicationStatistics(rows, "2026-09-24", "recent30");
  assert.equal(recent.total, 2);
  assert.equal(recent.trend.reduce((sum, point) => sum + point.count, 0), 2);
});
