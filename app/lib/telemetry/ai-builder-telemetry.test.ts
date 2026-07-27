import assert from "node:assert/strict";
import test from "node:test";
import { safePublicUrl } from "./ai-builder-telemetry";

test("sanitizes operational and durable telemetry URLs", () => {
  assert.equal(safePublicUrl("https://user:secret@example.test/path?token=sensitive#fragment"), "https://example.test/path");
  assert.equal(safePublicUrl("not a URL?token=sensitive"), "[invalid URL]");
});
