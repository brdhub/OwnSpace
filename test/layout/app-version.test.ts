import assert from "node:assert/strict";
import test from "node:test";

import { appRelease, appReleases } from "../../src/config/app-version";

test("release history keeps the current release first and every entry complete", () => {
  assert.equal(appReleases.length >= 2, true);
  assert.equal(appRelease, appReleases[0]);
  assert.deepEqual(
    appReleases.map((release) => release.version),
    ["3.6", "3.5", "3.3", "3.2", "3.1", "2.3", "2.2", "2.1", "2.0"],
  );
  assert.equal(appRelease.updatedAtIso, "2026-09-23");
  assert.equal(
    appReleases.every(
      (release) =>
        release.version.trim().length > 0 &&
        release.updatedAt.trim().length > 0 &&
        release.updatedAtIso.trim().length > 0 &&
        release.notes.length > 0 &&
        release.notes.every((note) => note.trim().length > 0),
    ),
    true,
  );
});

test("release history is ordered newest first", () => {
  const dates = appReleases.map((release) => release.updatedAtIso);

  assert.deepEqual(dates, [...dates].sort().reverse());
});
