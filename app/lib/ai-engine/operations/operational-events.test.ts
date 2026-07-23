import assert from "node:assert/strict";
import test from "node:test";
import { safeOperationalError, sanitizeOperationalMetadata } from "./operational-events";

test("operational metadata accepts bounded operational facts", () => {
  assert.deepEqual(sanitizeOperationalMetadata({ attempt: 2, categories: { revision: "mismatch" } }), { attempt: 2, categories: { revision: "mismatch" } });
});
test("operational metadata rejects private payload-shaped fields", () => {
  assert.throws(() => sanitizeOperationalMetadata({ prompt: "do not persist" }), /unsafe_key/);
  assert.throws(() => sanitizeOperationalMetadata({ nested: { stackTrace: "do not persist" } }), /unsafe_key/);
});
test("operational errors are bounded and do not preserve stack traces", () => {
  const error = new Error("x".repeat(900));
  (error as Error & { code: string }).code = "unsafe code with spaces";
  const safe = safeOperationalError(error);
  assert.equal(safe.errorCode, "unsafe_code_with_spaces");
  assert.equal(safe.errorMessage.length, 512);
});
