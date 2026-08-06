import assert from "node:assert/strict";
import test from "node:test";

import nextConfig from "../../next.config";

test("allows a 10 MB resume plus multipart overhead through Server Actions", () => {
  assert.equal(nextConfig.experimental?.serverActions?.bodySizeLimit, "12mb");
});
