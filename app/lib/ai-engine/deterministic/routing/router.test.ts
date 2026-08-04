import assert from "node:assert/strict";
import test from "node:test";
import { WEBSITE_KNOWLEDGE_CATEGORIES } from "../../knowledge/websiteKnowledge";
import type { DeterministicFact } from "../contracts";
import { primaryBucketForCategory } from "./buckets";
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

test("keeps distinct observation identities stable across source reordering", () => {
  const input = [
    fact("product", "product", "Atlas platform"),
    fact("pricing", "pricing_plan", "Starter plan costs $29"),
    fact("trust", "security_compliance", "Data is encrypted"),
  ];

  const forwardIds = routeLegacyFactsAsObservations(input)
    .map((item) => item.id)
    .sort();
  const reversedIds = routeLegacyFactsAsObservations([...input].reverse())
    .map((item) => item.id)
    .sort();

  assert.deepEqual(reversedIds, forwardIds);
});

test("keeps repeated occurrence identity multisets stable across reordering", () => {
  const input = [
    fact("same", "service", "Implementation consulting"),
    fact("same", "service", "Implementation consulting"),
    fact("other", "service", "Training"),
  ];

  const forwardIds = routeLegacyFactsAsObservations(input)
    .map((item) => item.id)
    .sort();
  const reorderedIds = routeLegacyFactsAsObservations([
    input[2]!,
    input[0]!,
    input[1]!,
  ])
    .map((item) => item.id)
    .sort();

  assert.deepEqual(reorderedIds, forwardIds);
});

test("routes every supported category to exactly its canonical primary owner", () => {
  const facts = WEBSITE_KNOWLEDGE_CATEGORIES.map((category, index) =>
    fact(`category-${index}`, category, `${category} value`),
  );
  const observations = routeLegacyFactsAsObservations(facts);

  assert.equal(observations.length, WEBSITE_KNOWLEDGE_CATEGORIES.length);
  assert.equal(new Set(observations.map((item) => item.id)).size, facts.length);

  for (const observation of observations) {
    const category = observation.candidateCategories[0]!;
    assert.deepEqual(observation.candidateCategories, [category]);
    assert.equal(observation.primaryBucket, primaryBucketForCategory(category));
    assert.deepEqual(observation.assignedBuckets, [observation.primaryBucket]);
    assert.deepEqual(observation.routingReasons, [
      "legacy_fact_category",
      "category_primary_owner",
    ]);
  }
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
