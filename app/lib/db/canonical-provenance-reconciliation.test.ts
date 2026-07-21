import assert from "node:assert/strict";
import test from "node:test";

import { reconcileCanonicalProjection } from "./canonical-provenance-reconciliation";

const source = { type: "source" as const, identity: "source:one", owner: "project:one", fields: { kind: "manual" }, repairable: true };
const evidence = { type: "evidence" as const, identity: "evidence:one", owner: "snapshot:one", fields: { content: "proof" }, repairable: true };

test("reconciliation reports missing identities and requires repair", () => {
  const report = reconcileCanonicalProjection([source, evidence], [source]);
  assert.deepEqual(report.missing.map((item) => item.identity), ["evidence:one"]);
  assert.equal(report.readiness, "repair_required");
});

test("reconciliation rejects ownership collisions and metadata drift", () => {
  const ownership = reconcileCanonicalProjection([source], [{ ...source, owner: "project:two" }]);
  assert.equal(ownership.readiness, "integrity_failure");
  assert.deepEqual(ownership.integrityFailures, ["ownership:source:source:one"]);
  const metadata = reconcileCanonicalProjection([source], [{ ...source, fields: { kind: "website" } }]);
  assert.equal(metadata.mismatched.length, 1);
  assert.equal(metadata.readiness, "repair_required");
});

test("metadata object key order is not deterministic drift", () => {
  const expected = { ...source, fields: { metadata: { alpha: 1, beta: { first: true, second: false } } } };
  const actual = { ...source, fields: { metadata: { beta: { second: false, first: true }, alpha: 1 } } };
  assert.equal(reconcileCanonicalProjection([expected], [actual]).mismatched.length, 0);
});

test("unexpected governance rows remain historical gaps", () => {
  const report = reconcileCanonicalProjection([source], [source, { type: "claim_review", identity: "review:past", owner: "project:one", fields: {}, repairable: false }]);
  assert.equal(report.unexpected[0]?.classification, "historical");
  assert.equal(report.readiness, "historical_gap");
});

test("duplicate canonical identities are integrity failures independent of row order", () => {
  const duplicate = { ...source, fields: { kind: "manual", duplicate: true } };
  const first = reconcileCanonicalProjection([source], [source, duplicate], "project:one");
  const second = reconcileCanonicalProjection([source], [duplicate, source], "project:one");
  assert.equal(first.readiness, "integrity_failure");
  assert.deepEqual(first.integrityFailures, second.integrityFailures);
});

test("unexpected rows need projection metadata before they are repairable stale drift", () => {
  const stale = { ...evidence, identity: "evidence:old", owner: "project:one", fields: { metadata: { legacyProjectId: "project:one" } } };
  assert.equal(reconcileCanonicalProjection([source], [source, stale], "project:one").unexpected[0]?.classification, "repairable_stale_projection");
  assert.equal(reconcileCanonicalProjection([source], [source, { ...stale, fields: {} }], "project:one").unexpected[0]?.classification, "unknown");
});
