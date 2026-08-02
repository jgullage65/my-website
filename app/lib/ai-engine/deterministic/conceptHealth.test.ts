import assert from "node:assert/strict";
import test from "node:test";
import type { DeterministicFact, MaterialConflict, NormalizedEvidence } from "./contracts";
import { assembleBusinessConcepts } from "./concepts";

function evidence(id: string, provenance: "owner" | "website" = "website"): NormalizedEvidence {
  return {
    url: provenance === "owner" ? "owner://business-information" : `https://example.test/${id}`,
    excerpt: "We provide detailed SEO consulting services for growing businesses.",
    sourceDocumentId: provenance === "website" ? `document-${id}` : undefined,
    sourceBlockId: provenance === "website" ? `block-${id}` : undefined,
    pageType: provenance === "owner" ? "other" : "services",
    sourceType: provenance === "owner" ? "owner" : "html",
    provenance,
    structured: provenance === "owner",
  };
}

function fact(id: string, source: NormalizedEvidence, score = 84, value = source.excerpt): DeterministicFact {
  return {
    id, topicKey: "service:seo", category: "service", title: "Service", value,
    confidence: score >= 78 ? "high" : score >= 52 ? "medium" : "low",
    confidenceScore: score, provenance: source.provenance, evidence: [source], explicit: true,
  };
}

function conflict(id: string): MaterialConflict {
  return {
    id, topicKey: "service:seo", factIds: ["owner", "web"], preferredFactId: "owner",
    websiteFactIds: ["web"], sessionEntryIds: [], reason: "Existing deterministic conflict.",
  };
}

test("strong multi-source health is bounded, deterministic, and low priority", () => {
  const facts = [fact("owner", evidence("owner", "owner")), fact("web", evidence("services"))];
  const original = structuredClone(facts);
  const first = assembleBusinessConcepts(facts)[0]!;
  const second = assembleBusinessConcepts([...facts].reverse())[0]!;

  assert.equal(first.health.status, "strong");
  assert.equal(first.health.reviewPriority, "low");
  assert.ok(first.health.score >= 0 && first.health.score <= 100);
  assert.equal(first.health.supportingFactCount, 2);
  assert.equal(first.health.supportingSourceCount, 2);
  assert.equal(first.health.mixedSourceSupport, true);
  assert.deepEqual(first.health.reasons, [
    "multi_source_support", "owner_supported", "website_supported", "mixed_source_agreement", "strong_evidence",
  ]);
  assert.deepEqual(first, second);
  assert.deepEqual(facts, original, "health projection must not mutate authoritative facts");
});

test("single-source owner-only and website-only concepts are review recommended", () => {
  const owner = assembleBusinessConcepts([fact("owner", evidence("owner", "owner"))])[0]!;
  const website = assembleBusinessConcepts([fact("web", evidence("services"))])[0]!;

  assert.equal(owner.health.status, "review_recommended");
  assert.equal(owner.health.reviewPriority, "medium");
  assert.equal(owner.health.ownerSupported, true);
  assert.equal(owner.health.websiteSupported, false);
  assert.deepEqual(owner.health.reasons, ["single_source_only", "owner_supported"]);
  assert.equal(website.health.ownerSupported, false);
  assert.equal(website.health.websiteSupported, true);
  assert.deepEqual(website.health.reasons, ["single_source_only", "website_supported", "missing_owner_confirmation"]);
});

test("owner and website disagreement links every existing conflict and needs attention", () => {
  const concept = assembleBusinessConcepts(
    [fact("owner", evidence("owner", "owner")), fact("web", evidence("services"))],
    [conflict("conflict-b"), conflict("conflict-a")],
  )[0]!;

  assert.equal(concept.health.hasConflicts, true);
  assert.equal(concept.health.conflictCount, 2);
  assert.deepEqual(concept.health.unresolvedConflictIds, ["conflict-a", "conflict-b"]);
  assert.equal(concept.health.status, "needs_attention");
  assert.equal(concept.health.reviewPriority, "high");
  assert.ok(concept.health.reasons.includes("unresolved_conflict"));
  assert.ok(!concept.health.reasons.includes("mixed_source_agreement"));
});

test("duplicate evidence never inflates source support", () => {
  const shared = evidence("services");
  const concept = assembleBusinessConcepts([fact("one", shared), fact("two", { ...shared })])[0]!;
  assert.equal(concept.supportingEvidence.length, 1);
  assert.equal(concept.supportingSourceCount, 1);
  assert.equal(concept.health.supportingSourceCount, 1);
  assert.ok(concept.health.reasons.includes("single_source_only"));
});

test("category-specific missing signals are conservative and stable", () => {
  const cases: Array<[DeterministicFact["category"], string, string, string[]]> = [
    ["pricing_plan", "pricing_plan:starter", "Starter plan", ["missing_price", "missing_billing_period", "missing_included_features"]],
    ["policy", "policy:refund", "Policy information", ["missing_effective_rule", "missing_timeframe", "missing_conditions"]],
    ["contact_information", "contact:sales", "Reach our team", ["missing_contact_value", "missing_contact_purpose"]],
    ["location_service_area", "location:austin", "Austin", ["missing_location_name", "missing_service_area_detail"]],
    ["product", "product:atlas", "Atlas", ["missing_description"]],
  ];
  for (const [category, topicKey, value, expected] of cases) {
    const source = evidence(category);
    const item = { ...fact(category, source), category, topicKey, value };
    assert.deepEqual(assembleBusinessConcepts([item])[0]?.health.missingSignals, expected);
  }
});

test("low confidence is bounded and produces stable high-priority health", () => {
  const concept = assembleBusinessConcepts([fact("weak", evidence("weak"), 5, "SEO")])[0]!;
  assert.equal(concept.health.score, 0);
  assert.equal(concept.health.status, "needs_attention");
  assert.equal(concept.health.reviewPriority, "high");
  assert.deepEqual(concept.health.reasons, [
    "single_source_only", "website_supported", "missing_owner_confirmation", "low_confidence", "incomplete_evidence",
  ]);
});
