import assert from "node:assert/strict";
import test from "node:test";
import type { DeterministicFact, MaterialConflict, NormalizedEvidence } from "./contracts";
import { assembleBusinessConcepts } from "./concepts";

function evidence(id: string, excerpt: string): NormalizedEvidence {
  return {
    url: `https://example.test/${id}`, excerpt,
    sourceDocumentId: `document-${id}`, sourceBlockId: `block-${id}`,
    pageType: "other", sourceType: "html", provenance: "website", structured: false,
  };
}

function fact(
  id: string,
  category: DeterministicFact["category"],
  topicKey: string,
  value: string,
  confidenceScore = 80,
): DeterministicFact {
  return {
    id, category, topicKey, title: topicKey, value, confidenceScore,
    confidence: confidenceScore >= 78 ? "high" : confidenceScore >= 52 ? "medium" : "low",
    provenance: "website", evidence: [evidence(id, value)], explicit: true,
  };
}

function conflict(topicKey: string): MaterialConflict {
  return {
    id: "conflict-1", topicKey, factIds: ["a", "b"], preferredFactId: "a",
    websiteFactIds: ["a", "b"], sessionEntryIds: [], reason: "Existing conflict",
  };
}

test("critical purchase and customer-rights concepts have stable reasons", () => {
  const concepts = assembleBusinessConcepts([
    fact("price", "pricing_plan", "pricing_plan:pro", "Pro is $99 monthly and includes support."),
    fact("refund", "policy", "policy:refund", "Refunds are available within 30 days when eligible."),
    fact("cancel", "policy", "policy:cancellation", "Cancellation is allowed at any time."),
  ]);
  const price = concepts.find(item => item.category === "pricing_plan")!;
  assert.equal(price.importance.level, "critical");
  assert.deepEqual(price.importance.reasons, ["pricing_affects_purchase"]);
  for (const policy of concepts.filter(item => item.category === "policy")) {
    assert.equal(policy.importance.level, "critical");
    assert.ok(policy.importance.reasons.includes("policy_affects_customer_rights"));
  }
});

test("support and billing contacts are high importance", () => {
  for (const [id, purpose, reason] of [["support", "Official support email support@example.test", "support_contact"], ["billing", "Billing phone +1 555 555 1212", "billing_contact"]]) {
    const concept = assembleBusinessConcepts([fact(id!, "contact_information", `contact:${id}`, purpose!)])[0]!;
    assert.equal(concept.importance.level, "high");
    assert.ok(concept.importance.reasons.includes(reason!));
  }
});

test("explicit primary offers rank above secondary and peripheral offers", () => {
  const concepts = assembleBusinessConcepts([
    fact("primary-service", "service", "service:consulting", "Our primary consulting service for customers."),
    fact("secondary-service", "service", "service:training", "A secondary training service."),
    fact("primary-product", "product", "product:atlas", "Atlas is our flagship primary product."),
    fact("peripheral-product", "product", "product:stickers", "Peripheral sticker product."),
  ]);
  const score = (key: string) => concepts.find(item => item.canonicalTopicIdentity === key)!.importance.score;
  assert.ok(score("service:consulting") > score("service:training"));
  assert.ok(score("product:atlas") > score("product:stickers"));
  assert.ok(concepts.find(item => item.canonicalTopicIdentity === "product:atlas")!.importance.reasons.includes("primary_offer"));
});

test("security and compliance elevate concepts while ordinary integrations stay medium", () => {
  const ordinary = assembleBusinessConcepts([fact("slack", "integration", "integration:slack", "Connect with Slack.")])[0]!;
  const essential = assembleBusinessConcepts([fact("sso", "integration", "integration:sso", "SSO is essential and required.")])[0]!;
  const security = assembleBusinessConcepts([fact("soc", "certification", "certification:soc_2", "Official SOC 2 security certification.")])[0]!;
  const compliance = assembleBusinessConcepts([fact("gdpr", "certification", "certification:gdpr", "GDPR compliant.")])[0]!;
  assert.equal(ordinary.importance.level, "medium");
  assert.ok(essential.importance.score > ordinary.importance.score);
  assert.ok(security.importance.reasons.includes("security_claim"));
  assert.ok(compliance.importance.reasons.includes("compliance_claim"));
  assert.equal(security.importance.level, "high");
});

test("minor locations remain low and FAQs remain outside concepts", () => {
  const concepts = assembleBusinessConcepts([
    fact("office", "location_service_area", "location:warehouse", "Minor peripheral office detail in Austin."),
    fact("faq", "faq", "faq:hours", "What are your hours?"),
  ]);
  assert.equal(concepts.length, 1);
  assert.equal(concepts[0]!.importance.level, "low");
  assert.ok(concepts[0]!.importance.reasons.includes("low_customer_impact"));
});

test("importance is independent of health confidence and repeated mentions", () => {
  const strongFact = fact("strong", "pricing_plan", "pricing_plan:pro", "Pro costs $99 monthly and includes analytics.", 95);
  const weakFact = fact("weak", "pricing_plan", "pricing_plan:pro", "Pro costs $99 monthly and includes analytics.", 5);
  const strong = assembleBusinessConcepts([strongFact])[0]!;
  const weak = assembleBusinessConcepts([weakFact])[0]!;
  const repeated = assembleBusinessConcepts([strongFact, { ...strongFact, id: "repeat", evidence: [evidence("repeat", strongFact.value)] }])[0]!;
  assert.notEqual(strong.health.score, weak.health.score);
  assert.equal(strong.importance.score, weak.importance.score);
  assert.equal(strong.importance.level, "critical");
  assert.equal(repeated.importance.score, strong.importance.score);
});

test("critical conflicts are severe while strong critical concepts remain critical", () => {
  const item = fact("price", "pricing_plan", "pricing_plan:pro", "Pro costs $99 monthly and includes analytics.");
  const conflicted = assembleBusinessConcepts([item], [conflict(item.topicKey)])[0]!;
  const healthy = assembleBusinessConcepts([item])[0]!;
  assert.equal(conflicted.importance.riskIfWrong, "severe");
  assert.ok(conflicted.importance.reasons.includes("unresolved_high_impact_conflict"));
  assert.equal(healthy.importance.level, "critical");
  assert.equal(healthy.importance.riskIfWrong, "high");
});

test("importance is bounded, deterministic, and does not mutate facts, health, identity, or evidence", () => {
  const facts = [
    fact("service-b", "service", "service:seo", "Our main SEO service."),
    fact("service-a", "service", "service:seo", "Our core SEO service."),
    fact("location", "location_service_area", "location:annex", "Minor annex office detail."),
  ];
  const original = structuredClone(facts);
  const first = assembleBusinessConcepts(facts);
  const second = assembleBusinessConcepts([...facts].reverse());
  assert.deepEqual(first, second);
  assert.deepEqual(facts, original);
  assert.deepEqual(first.map(item => item.canonicalTopicIdentity), ["location:annex", "service:seo"]);
  for (const concept of first) assert.ok(concept.importance.score >= 0 && concept.importance.score <= 100);
  assert.deepEqual(first[1]!.supportingFactIds, ["service-a", "service-b"]);
  assert.deepEqual(first[1]!.supportingEvidence.map(item => item.sourceBlockId), ["block-service-a", "block-service-b"]);
});
