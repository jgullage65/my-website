import assert from "node:assert/strict";
import test from "node:test";
import type { DeterministicFact, NormalizedSourceBlock } from "./contracts";
import { assignFactsToOwners } from "./specialists";
import { routeSourceBlocks } from "./routing";

function block(
  id: string,
  pageType: NormalizedSourceBlock["pageType"],
  heading: string,
  text: string,
  type: NormalizedSourceBlock["type"] = "paragraph",
): NormalizedSourceBlock {
  return {
    id,
    text,
    type,
    pageType,
    heading,
    evidence: {
      url: `https://example.test/${pageType}`,
      excerpt: text,
      sourceBlockId: id,
      heading,
      pageTitle: heading,
      pageType,
      sourceType: "html",
      provenance: "website",
      structured: false,
    },
  };
}

function fact(category: DeterministicFact["category"], sourceBlockId: string, value: string): DeterministicFact {
  return {
    id: `${category}:${sourceBlockId}`,
    topicKey: `${category}:${sourceBlockId}`,
    category,
    title: category,
    value,
    confidence: "medium",
    confidenceScore: 0.5,
    provenance: "website",
    evidence: [{
      url: "https://example.test/source",
      excerpt: value,
      sourceBlockId,
      pageType: "other",
      sourceType: "html",
      provenance: "website",
      structured: false,
    }],
    explicit: true,
  };
}

test("legal sections cannot authorize commercial service facts", () => {
  const routed = routeSourceBlocks([
    block("legal", "policies", "Refund Policy", "Our services are non-refundable."),
  ]);
  const owned = assignFactsToOwners([
    fact("service", "legal", "Our services are non-refundable."),
    fact("policy", "legal", "Our services are non-refundable."),
  ], routed);

  assert.equal(owned.some((item) => item.category === "service"), false);
  assert.equal(owned.some((item) => item.category === "policy" && item.ownerId === "operations_context"), true);
});

test("editorial sections cannot authorize commercial or market facts", () => {
  const routed = routeSourceBlocks([
    block("blog", "other", "Five Marketing Tips", "Businesses should use limited-time offers to create urgency."),
  ]);
  const owned = assignFactsToOwners([
    fact("service", "blog", "Businesses should use limited-time offers to create urgency."),
    fact("primary_use_case", "blog", "Businesses should use limited-time offers to create urgency."),
  ], routed);

  assert.equal(owned.some((item) => item.category === "service"), false);
  assert.equal(owned.some((item) => item.category === "primary_use_case"), false);
});

test("commercial sections authorize commercial facts without granting other owners authority", () => {
  const routed = routeSourceBlocks([
    block("service", "services", "Brand Strategy Services", "We provide brand strategy and campaign planning."),
  ]);
  const owned = assignFactsToOwners([
    fact("service", "service", "We provide brand strategy and campaign planning."),
  ], routed);

  assert.equal(owned.length, 1);
  assert.equal(owned[0]?.ownerId, "commercial");
});

test("catalog-style substrate routes an otherwise unknown category page to Commercial", () => {
  const routed = routeSourceBlocks([
    block("item-a", "other", "Seasonal Collection", "Option A $12.00", "list_item"),
    block("item-b", "other", "Seasonal Collection", "Option B $18.00", "list_item"),
    block("item-c", "other", "Seasonal Collection", "Option C $24.00", "list_item"),
  ]);

  assert.equal(routed.every((item) => item.evidenceLane === "commercial"), true);
  assert.equal(routed.some((item) => item.routingReasons.includes("page_structure_catalog_or_price_bearing")), true);
});
