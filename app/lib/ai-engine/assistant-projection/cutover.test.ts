import assert from "node:assert/strict";
import test from "node:test";
import { cutoverEligibilityFailure } from "./cutover";

const artifact = { projectionVersion: 1, schemaVersion: 1, generatedAt: "2026-01-01T00:00:00.000Z" };
const evidence = { status: "MATCH", projectionVersion: 1, schemaVersion: 1, activeRuntimeAuthority: "canonical", comparedAt: "2026-01-01T00:00:00.000Z" };
const check = (overrides: Record<string, unknown> = {}) => cutoverEligibilityFailure({ runtimeAuthority: "canonical", artifact, evidence, ...overrides });

test("only an exact canonical MATCH permits cutover", () => {
  assert.equal(check(), null);
  assert.equal(check({ runtimeAuthority: "legacy" }), "assistant_projection_migration_required");
  assert.equal(check({ evidence: null }), "assistant_projection_runtime_unavailable_parity_evidence_unavailable");
  for (const status of ["MINOR_DIFFERENCE", "MAJOR_DIFFERENCE", "COMPARISON_FAILURE"]) assert.equal(check({ evidence: { ...evidence, status } }), "assistant_projection_runtime_unavailable_parity_status_unacceptable");
});

test("cutover evidence is bound to the current projection artifact", () => {
  assert.equal(check({ evidence: { ...evidence, projectionVersion: 2 } }), "assistant_projection_runtime_unavailable_parity_evidence_stale");
  assert.equal(check({ evidence: { ...evidence, schemaVersion: 2 } }), "assistant_projection_runtime_unavailable_parity_evidence_stale");
  assert.equal(check({ evidence: { ...evidence, activeRuntimeAuthority: "legacy" } }), "assistant_projection_runtime_unavailable_parity_authority_invalid");
  assert.equal(check({ evidence: { ...evidence, comparedAt: "2025-12-31T23:59:59.000Z" } }), "assistant_projection_runtime_unavailable_parity_evidence_stale");
});
