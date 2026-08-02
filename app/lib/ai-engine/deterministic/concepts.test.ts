import assert from "node:assert/strict";
import test from "node:test";
import type { DeterministicFact, NormalizedEvidence } from "./contracts";
import { assembleBusinessConcepts, conceptDisplayName } from "./concepts";

function evidence(url: string, excerpt: string, provenance: "owner" | "website" = "website"): NormalizedEvidence {
  return {
    url,
    excerpt,
    sourceDocumentId: provenance === "website" ? `document-${url.split("/").pop() || "home"}` : undefined,
    sourceBlockId: provenance === "website" ? `block-${url.split("/").pop() || "home"}` : undefined,
    pageType: provenance === "owner" ? "other" : "services",
    sourceType: provenance === "owner" ? "owner" : "html",
    provenance,
    structured: provenance === "owner",
  };
}

function fact(
  id: string,
  category: DeterministicFact["category"],
  topicKey: string,
  confidenceScore: number,
  source: NormalizedEvidence,
): DeterministicFact {
  return {
    id, category, topicKey, title: category, value: source.excerpt,
    confidenceScore,
    confidence: confidenceScore >= 78 ? "high" : confidenceScore >= 52 ? "medium" : "low",
    provenance: source.provenance,
    evidence: [source],
    explicit: true,
  };
}

test("repeated services, products, and pricing plans produce one concept per canonical topic", () => {
  const concepts = assembleBusinessConcepts([
    fact("service-home", "service", "service:seo", 60, evidence("https://example.test/", "We provide SEO services.")),
    fact("service-page", "service", "service:seo", 80, evidence("https://example.test/services", "Search engine optimization consulting.")),
    fact("product-home", "product", "product:atlas", 70, evidence("https://example.test/", "Atlas software platform.")),
    fact("product-page", "product", "product:atlas", 90, evidence("https://example.test/products", "Our Atlas product.")),
    fact("plan-pricing", "pricing_plan", "pricing_plan:professional", 82, evidence("https://example.test/pricing", "Professional plan is $99 monthly.")),
    fact("plan-product", "pricing_plan", "pricing_plan:professional", 78, evidence("https://example.test/products", "Choose the Professional tier.")),
  ]);

  assert.deepEqual(concepts.map(concept => concept.canonicalTopicIdentity), [
    "pricing_plan:professional", "product:atlas", "service:seo",
  ]);
  assert.equal(concepts.find(concept => concept.canonicalTopicIdentity === "service:seo")?.supportingFactIds.length, 2);
  assert.equal(concepts.find(concept => concept.canonicalTopicIdentity === "product:atlas")?.supportingFactIds.length, 2);
  assert.equal(concepts.find(concept => concept.canonicalTopicIdentity === "pricing_plan:professional")?.displayName, "Professional Plan");
});

test("owner and website knowledge strengthen one evidence-backed concept", () => {
  const sharedEvidence = evidence("https://example.test/services", "We provide SEO services.");
  const concepts = assembleBusinessConcepts([
    fact("owner-seo", "service", "service:seo", 90, evidence("owner://business-information", "SEO consulting.", "owner")),
    fact("website-seo", "service", "service:seo", 70, sharedEvidence),
    fact("website-seo-second", "service", "service:seo", 80, sharedEvidence),
  ]);
  const concept = concepts[0]!;

  assert.equal(concept.ownerKnowledgeContributes, true);
  assert.equal(concept.websiteKnowledgeContributes, true);
  assert.equal(concept.confidenceScore, 80);
  assert.equal(concept.overallConfidence, "high");
  assert.equal(concept.supportingSourceCount, 2);
  assert.equal(concept.supportingEvidence.length, 2, "duplicate evidence references are associated only once");
  assert.deepEqual(new Set(concept.supportingEvidence.map(item => item.excerpt)), new Set(["SEO consulting.", "We provide SEO services."]));
  assert.ok(concept.firstSeenSource);
  assert.ok(concept.lastSeenSource);
});

test("display names are deterministic and derived from canonical identities", () => {
  assert.equal(conceptDisplayName("service:seo"), "SEO");
  assert.equal(conceptDisplayName("pricing_plan:professional"), "Professional Plan");
  assert.equal(conceptDisplayName("integration:google_workspace"), "Google Workspace");
  assert.equal(conceptDisplayName("policy:refund"), "Refund Policy");
  assert.equal(conceptDisplayName("certification:soc_2"), "SOC 2");
});

test("concepts are stable across repeated crawls and FAQs remain independent", () => {
  const facts = [
    fact("faq-1", "faq", "faq:what_is_seo", 75, evidence("https://example.test/faq", "What is SEO?")),
    fact("service-1", "service", "service:seo", 80, evidence("https://example.test/services", "SEO consulting.")),
    fact("service-2", "service", "service:seo", 70, evidence("https://example.test/", "Search engine optimization.")),
  ];
  const first = assembleBusinessConcepts(facts);
  const second = assembleBusinessConcepts([...facts].reverse());

  assert.deepEqual(first, second);
  assert.equal(first.length, 1);
  assert.equal(first[0]?.canonicalTopicIdentity, "service:seo");
  assert.ok(!first.some(concept => concept.category === "faq"));
});
