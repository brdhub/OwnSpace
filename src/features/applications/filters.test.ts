import assert from "node:assert/strict";
import test from "node:test";
import {
  buildApplicationFiltersHref,
  getApplicationStatusesForFilter,
  resolveApplicationFilters,
} from "@/features/applications/filters";

test("defaults the applications page to active autumn applications", () => {
  assert.deepEqual(resolveApplicationFilters({}), {
    query: "",
    status: "active",
    internshipType: "autumn",
  });
});

test("preserves explicit all filters instead of replacing them with defaults", () => {
  assert.deepEqual(resolveApplicationFilters({ status: "all", internshipType: "all" }), {
    query: "",
    status: "all",
    internshipType: "all",
  });
});

test("active status includes every status except closed", () => {
  assert.deepEqual(getApplicationStatusesForFilter("active"), [
    "planned",
    "applied",
    "assessment",
    "firstInterview",
    "laterInterview",
    "offer",
  ]);
  assert.equal(getApplicationStatusesForFilter("all"), null);
  assert.deepEqual(getApplicationStatusesForFilter("closed"), ["closed"]);
});

test("invalid filter values fall back to the page defaults", () => {
  assert.deepEqual(resolveApplicationFilters({ status: "unknown", internshipType: "unknown" }), {
    query: "",
    status: "active",
    internshipType: "autumn",
  });
});

test("builds explicit filter links without allowing page defaults to change their meaning", () => {
  assert.equal(
    buildApplicationFiltersHref({ status: "closed", internshipType: "all" }),
    "/applications?status=closed&internshipType=all",
  );
  assert.equal(
    buildApplicationFiltersHref({ status: "all", internshipType: "summer" }),
    "/applications?status=all&internshipType=summer",
  );
  assert.equal(
    buildApplicationFiltersHref({ status: "all", internshipType: "all" }),
    "/applications?status=all&internshipType=all",
  );
});
