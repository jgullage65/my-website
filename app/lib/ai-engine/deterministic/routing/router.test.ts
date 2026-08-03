import assert from "node:assert/strict";
import test from "node:test";
import type { DeterministicFact } from "../contracts";
import { routeLegacyFactsAsObservations } from "./router";

const fact = (id: string, category: DeterministicFact["category"], value: string): DeterministicFact => ({
  id,
  category,
  title: category,
  value,
  topicKey: `${category}:${id}`,
  confidence: "medium",
  confidenceScore: 0,
  provenance: "website",
  evidence: [{
    url: "https://example.test",
    excerpt: value,
    pageType: "home",
    sourceType: "html",
    provenance: "website",
    structured: false,
  }],
  explicit: true,
});

test("routes one immutable observation per legacy fact occurrence", () => {
  const input = [
    fact("duplicate", "service", "Implementation consulting"),
    fact("duplicate", "service", "Implementation consulting"),
    fact("pricing", "pricing_plan", "Starter plan costs $29"),
  ];
  const snapshot = structuredClone(input);

  const observations = routeLegacyFactsAsObservations(input);

  assert.equal(observations.length, input.length);
  assert.equal(new Set(observations.map((item) => item.id)).size, input.length);
  assert.deepEqual(
    observations.map((item) => item.sourceIndex).sort((a, b) => a - b),
    [0, 1, 2],
  );
  assert.deepEqual(input, snapshot);

  observations[0]!.evidence[0]!.excerpt = "changed";
  assert.deepEqual(input, snapshot);
});

test("routes every observation to exactly one primary bucket in Phase 1", () => {
  const observations = routeLegacyFactsAsObservations([
    fact("product", "product", "Atlas platform"),
    fact("trust", "security_compliance", "Data is encrypted"),
  ]);

  for (const observation of observations) {
    assert.deepEqual(observation.assignedBuckets, [observation.primaryBucket]);
    assert.equal(observation.candidateCategories.length, 1);
    assert.deepEqual(observation.routingReasons, [
      "legacy_fact_category",
      "category_primary_owner",
    ]);
  }
});
