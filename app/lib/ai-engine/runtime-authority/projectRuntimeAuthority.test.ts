import assert from "node:assert/strict";
import test from "node:test";
import { ProjectRuntimeAuthorityError, getProjectRuntimeAuthority, parseProjectRuntimeAuthority } from "./projectRuntimeAuthority";

test("runtime authority defaults are represented by the durable legacy value and only allowed values parse", () => {
  assert.equal(parseProjectRuntimeAuthority("legacy"), "legacy");
  assert.equal(parseProjectRuntimeAuthority("canonical"), "canonical");
  assert.throws(() => parseProjectRuntimeAuthority(undefined), (error: unknown) => error instanceof ProjectRuntimeAuthorityError && error.code === "project_runtime_authority_invalid");
});

test("runtime authority read is project scoped", async () => {
  const calls: unknown[][] = [];
  const client = { query: async (query: string, parameters: unknown[]) => { calls.push([query, parameters]); return { rows: [{ runtime_authority: "canonical" }] }; } };
  assert.equal(await getProjectRuntimeAuthority(client as never, "project-1"), "canonical");
  assert.match(String(calls[0][0]), /WHERE id=\$1/);
  assert.deepEqual(calls[0][1], ["project-1"]);
});
