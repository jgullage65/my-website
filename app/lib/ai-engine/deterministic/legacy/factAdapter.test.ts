import assert from "node:assert/strict";
import test from "node:test";
import type { DeterministicFact } from "../contracts";
import { routeLegacyFactsAsObservations } from "../routing/router";
import { runCompatibilitySpecialists } from "../specialists";
import { reportsToLegacyFacts } from "./factAdapter";

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

test("reconstructs exact legacy order including repeated fact IDs", () => {
  const facts = [
    fact("same", "service", "Implementation consulting"),
    fact("same", "service", "Implementation consulting"),
    fact("price", "pricing_plan", "Starter costs $29"),
  ];
  const observations = routeLegacyFactsAsObservations(facts);
  const reports = runCompatibilitySpecialists(observations, facts);

  assert.deepEqual(reportsToLegacyFacts(reports, observations, facts), facts);
});

test("throws when a routed occurrence is missing from reports", () => {
  const facts = [fact("offer", "product", "Atlas platform")];
  const observations = routeLegacyFactsAsObservations(facts);
  const reports = runCompatibilitySpecialists(observations, facts);
  reports.find((report) => report.facts.length)!.facts = [];

  assert.throws(
    () => reportsToLegacyFacts(reports, observations, facts),
    /observation\/fact count mismatch/,
  );
});

test("throws when a fact is placed in the wrong bucket", () => {
  const facts = [fact("offer", "product", "Atlas platform")];
  const observations = routeLegacyFactsAsObservations(facts);
  const reports = runCompatibilitySpecialists(observations, facts);
  const offerReport = reports.find((report) => report.facts.length)!;
  offerReport.bucket = "commercial_rules";

  assert.throws(
    () => reportsToLegacyFacts(reports, observations, facts),
    /does not belong to bucket/,
  );
});

test("throws when any legacy fact field is mutated", () => {
  const facts = [fact("offer", "product", "Atlas platform")];
  const observations = routeLegacyFactsAsObservations(facts);
  const reports = runCompatibilitySpecialists(observations, facts);
  const offerReport = reports.find((report) => report.facts.length)!;
  offerReport.facts[0]!.value = "Changed value";

  assert.throws(
    () => reportsToLegacyFacts(reports, observations, facts),
    /Legacy fact parity mismatch/,
  );
});
