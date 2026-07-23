import assert from "node:assert/strict";
import test from "node:test";
import { safeOperationalError, sanitizeOperationalMetadata, unresolvedDriftEvents } from "./operational-events";

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
  const safe = safeOperationalError(error, ["unsafe code with spaces"]);
  assert.equal(safe.errorCode, "unsafe_code_with_spaces");
  assert.equal(safe.errorMessage.length, 512);
});
test("unknown errors use a generic safe message",()=>{
  assert.deepEqual(safeOperationalError(new Error("database row secret")),{errorCode:"operational_error",errorMessage:"The operation failed unexpectedly."});
  const spoofed=new Error("provider secret");(spoofed as Error&{code:string}).code="PROVIDER_FAILURE";
  assert.deepEqual(safeOperationalError(spoofed),{errorCode:"operational_error",errorMessage:"The operation failed unexpectedly."});
});
test("unresolved drift excludes signatures with a later resolution",async()=>{
  let sql="";const client={query:async(text:string)=>{sql=text;return {rows:[]};}};
  await unresolvedDriftEvents(client as any,"project");
  assert.match(sql,/event_type='drift_unresolved'/);
  assert.match(sql,/NOT EXISTS/);
  assert.match(sql,/event_type='drift_resolved'/);
});
