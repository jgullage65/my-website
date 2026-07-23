import assert from "node:assert/strict";
import test from "node:test";
import { ProjectRuntimeAuthorityError, getProjectRuntimeAuthority, parseProjectRuntimeAuthority, setProjectRuntimeAuthority, setProjectRuntimeAuthorityPoolForTests } from "./projectRuntimeAuthority";

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

test("authority writes are owner-scoped, target only authority and updated_at, and always release", async () => {
  const calls: Array<[string, unknown[]]> = [];
  const client = { released: 0, release() { this.released++; }, query: async (query: string, parameters: unknown[]) => {
    calls.push([query, parameters]);
    return { rows: parameters[0] === "missing" ? [] : [{ runtime_authority: parameters[2] }] };
  } };
  setProjectRuntimeAuthorityPoolForTests({ connect: async () => client } as never);
  try {
    assert.equal(await setProjectRuntimeAuthority({ projectId: "project-1", clerkUserId: "owner-1", authority: "canonical" }), "canonical");
    assert.equal(await setProjectRuntimeAuthority({ projectId: "project-1", clerkUserId: "owner-1", authority: "legacy" }), "legacy");
    assert.match(calls[0][0], /SET runtime_authority=\$3,updated_at=NOW\(\)/);
    assert.match(calls[0][0], /WHERE id=\$1 AND clerk_user_id=\$2/);
    assert.doesNotMatch(calls[0][0], /migration_state/);
    assert.deepEqual(calls[0][1], ["project-1", "owner-1", "canonical"]);
    await assert.rejects(setProjectRuntimeAuthority({ projectId: "missing", clerkUserId: "owner-1", authority: "legacy" }), (error: unknown) => error instanceof ProjectRuntimeAuthorityError && error.code === "project_runtime_authority_project_not_found");
    await assert.rejects(setProjectRuntimeAuthority({ projectId: "project-1", clerkUserId: "owner-1", authority: "invalid" as never }), (error: unknown) => error instanceof ProjectRuntimeAuthorityError && error.code === "project_runtime_authority_invalid");
    assert.equal(client.released, 3);
  } finally { setProjectRuntimeAuthorityPoolForTests(null); }
});
