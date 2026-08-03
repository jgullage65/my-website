import assert from "node:assert/strict";
import test from "node:test";
import type { DeterministicFact, NormalizedEvidence } from "./contracts";
import { buildBucketShadowArchitecture } from "./shadowArchitecture";

const evidence = (excerpt: string): NormalizedEvidence => ({
  url: "https://example.test",
  excerpt,
  pageType: "home",
  sourceType: "html",
  provenance: "website",
  structured: false,
});

const fact = (
  id: string,
  category: DeterministicFact["category"],
  value: string,
): DeterministicFact => ({
  id,
  category,
  title: category,
  value,
  topicKey: `${category}:${value.toLowerCase().replace(/\s+/g, "-")}`,
  confidence: "medium",
  confidenceScore: 0,
  provenance: "website",
  evidence: [evidence(value)],
  explicit: true,
});

test("reconstructs the exact legacy fact array and always returns eight reports", () => {
  const input = [
    fact("same-id", "service", "Implementation consulting"),
    fact("same-id", "service", "Implementation consulting"),
    fact("price-id", "pricing_plan", "Starter plan costs $29"),
    fact("trust-id", "security_compliance", "Customer data is encrypted"),
  ];
  const snapshot = structuredClone(input);

  const result = buildBucketShadowArchitecture(input);

  assert.deepEqual(result.extracted, input);
  assert.equal(result.diagnostics.observations.length, input.length);
  assert.equal(result.diagnostics.reports.length, 8);
  assert.equal(
    new Set(result.diagnostics.observations.map((item) => item.id)).size,
    input.length,
  );
  assert.deepEqual(input, snapshot);

  result.diagnostics.observations[0]!.evidence[0]!.excerpt = "mutated";
  result.diagnostics.reports[0]!.facts[0]?.evidence.splice(0);
  assert.deepEqual(input, snapshot);
  assert.deepEqual(result.extracted, snapshot);
});

test("preserves each input order while routing deterministically", () => {
  const first = [
    fact("a", "product", "Atlas platform"),
    fact("b", "contact_information", "Email support@example.test"),
  ];
  const reversed = [...first].reverse();

  assert.deepEqual(buildBucketShadowArchitecture(first).extracted, first);
  assert.deepEqual(buildBucketShadowArchitecture(reversed).extracted, reversed);
});

test("returns eight complete empty reports for empty input", () => {
  const result = buildBucketShadowArchitecture([]);

  assert.deepEqual(result.extracted, []);
  assert.equal(result.diagnostics.reports.length, 8);
  for (const report of result.diagnostics.reports) {
    assert.equal(report.status, "complete");
    assert.deepEqual(report.observations, []);
    assert.deepEqual(report.claims, []);
    assert.deepEqual(report.facts, []);
  }
});
