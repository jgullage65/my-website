import assert from "node:assert/strict";
import test from "node:test";
import { buildDeterministicBusinessBrain } from "./index";
import { buildLegacyDeterministicBusinessBrain } from "./legacyPipeline";

function comparable<T extends { executionTimeMs: number; bucketShadow?: unknown }>(
  value: T,
) {
  const {
    executionTimeMs: _executionTimeMs,
    bucketShadow: _bucketShadow,
    ...rest
  } = value;
  return rest;
}

const input = {
  now: "2026-08-03T00:00:00.000Z",
  owner: {
    businessName: "Atlas",
    industry: "Marketing agencies",
    productsServices:
      "Atlas software platform. We provide implementation consulting.",
    policiesOperations:
      "The Starter plan costs $29 per month. Refunds are available within 30 days.",
  },
  pages: [
    {
      url: "https://example.test/pricing",
      title: "Pricing",
      pageType: "pricing" as const,
      text: "The Pro plan costs $79 per month.",
    },
    {
      url: "https://example.test/security",
      title: "Security",
      pageType: "security" as const,
      text: "Customer data is encrypted and SSO is supported.",
    },
  ],
} as const;

test("optional bucket diagnostics do not change deterministic output", () => {
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

test("bucket pipeline matches the isolated legacy pipeline exactly", () => {
  const legacy = buildLegacyDeterministicBusinessBrain(input);
  const bucketed = buildDeterministicBusinessBrain(input);

  assert.deepEqual(comparable(bucketed), comparable(legacy));
});
