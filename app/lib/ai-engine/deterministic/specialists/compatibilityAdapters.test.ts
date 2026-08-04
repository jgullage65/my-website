import assert from "node:assert/strict";
import test from "node:test";
import type { DeterministicFact } from "../contracts";
import { KNOWLEDGE_BUCKETS } from "../routing/buckets";
import { routeLegacyFactsAsObservations } from "../routing/router";
import { runCompatibilitySpecialists } from "./index";

const fact = (id: string, category: DeterministicFact["category"]): DeterministicFact => ({
  id,
  category,
  title: category,
  value: `${category} value`,
  topicKey: `${category}:${id}`,
  confidence: "medium",
  confidenceScore: 0,
  provenance: "owner",
  evidence: [{
    url: "owner://intake",
    excerpt: `${category} value`,
    pageType: "other",
    sourceType: "owner",
    provenance: "owner",
    structured: true,
  }],
  explicit: true,
});

test("always invokes all eight compatibility specialists in canonical order", () => {
  const facts = [
    fact("identity", "company_overview"),
    fact("offer", "product"),
    fact("market", "industry_served"),
    fact("commercial", "pricing_plan"),
    fact("trust", "certification"),
    fact("operations", "support_onboarding"),
    fact("ecosystem", "integration"),
    fact("proof", "competitive_differentiator"),
  ];
  const reports = runCompatibilitySpecialists(
    routeLegacyFactsAsObservations(facts),
    facts,
  );

  assert.deepEqual(reports.map((report) => report.bucket), KNOWLEDGE_BUCKETS);
  assert.equal(reports.length, 8);
  assert.equal(reports.flatMap((report) => report.facts).length, facts.length);

  for (const report of reports) {
    assert.equal(report.status, "complete");
    assert.deepEqual(report.claims, []);
    assert.deepEqual(report.duplicateGroups, []);
    assert.deepEqual(report.conflicts, []);
    assert.deepEqual(report.concepts, []);
    assert.deepEqual(report.unresolvedQuestions, []);
    assert.deepEqual(report.crossBucketReferences, []);
  }
});

test("keeps report observation identity ordering stable across reversed input", () => {
  const facts = [
    fact("offer-b", "product"),
    fact("offer-a", "service"),
    fact("commercial", "pricing_plan"),
  ];

  const forward = runCompatibilitySpecialists(
    routeLegacyFactsAsObservations(facts),
    facts,
  );
  const reversedFacts = [...facts].reverse();
  const reversed = runCompatibilitySpecialists(
    routeLegacyFactsAsObservations(reversedFacts),
    reversedFacts,
  );

  assert.deepEqual(
    forward.map((report) => report.observations.map((item) => item.id)),
    reversed.map((report) => report.observations.map((item) => item.id)),
  );
});

test("returns complete empty reports for buckets without owned facts", () => {
  const facts = [fact("offer", "service")];
  const reports = runCompatibilitySpecialists(
    routeLegacyFactsAsObservations(facts),
    facts,
  );

  assert.equal(reports.length, 8);
  assert.equal(reports.filter((report) => report.facts.length === 0).length, 7);
});
