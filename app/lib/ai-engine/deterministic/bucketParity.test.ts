import assert from "node:assert/strict";
import test from "node:test";
import { buildDeterministicBusinessBrain } from "./index";

function comparable<T extends { executionTimeMs: number; bucketShadow?: unknown }>(
  value: T,
) {
  const { executionTimeMs: _executionTimeMs, bucketShadow: _bucketShadow, ...rest } = value;
  return rest;
}

test("optional bucket diagnostics do not change deterministic output", () => {
  const input = {
    now: "2026-08-03T00:00:00.000Z",
    owner: {
      businessName: "Atlas",
      industry: "Marketing agencies",
      productsServices: "Atlas software platform. We provide implementation consulting.",
      policiesOperations: "The Starter plan costs $29 per month. Refunds are available within 30 days.",
    },
  } as const;

  const withoutDiagnostics = buildDeterministicBusinessBrain(input);
  const withDiagnostics = buildDeterministicBusinessBrain({
    ...input,
    shadowBuckets: true,
  });

  assert.equal(withoutDiagnostics.bucketShadow, undefined);
  assert.equal(withDiagnostics.bucketShadow?.reports.length, 8);
  assert.deepEqual(
    comparable(withDiagnostics),
    comparable(withoutDiagnostics),
  );
});
