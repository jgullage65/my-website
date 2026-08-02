import assert from "node:assert/strict";
import test from "node:test";
import { buildDeterministicBusinessBrain } from "./index";
import type { WebsiteSourceBlockRecord, WebsiteSourceDocumentRecord } from "../crawler/websiteSourceRecords";

const document = (id: string, url: string): WebsiteSourceDocumentRecord => ({
  schemaVersion: 1,
  id,
  crawlAttemptId: "attempt-1",
  actualFetchedUrl: url,
  canonicalUrl: url,
  redirectChain: [],
  sourceType: "html",
  contentType: "text/html",
  status: "retained",
  fetchedAt: "2026-08-02T00:00:00.000Z",
  sourceContentHash: "a".repeat(64),
  extractedContentHash: "b".repeat(64),
  language: "en",
  sourceTruncated: false,
  extractionTruncated: false,
  discoveryMethod: "submitted",
  discoveredFromUrl: null,
});

const block = (
  id: string,
  sourceDocumentId: string,
  type: WebsiteSourceBlockRecord["type"],
  normalizedText: string,
  line: number,
): WebsiteSourceBlockRecord => ({
  schemaVersion: 1,
  id,
  sourceDocumentId,
  crawlAttemptId: "attempt-1",
  type,
  normalizedText,
  coordinates: { lineStart: line, lineEnd: line },
  extractionMethod: "semantic_html",
});

test("uses structure, separates owner products and services, and retains session evidence", () => {
  const sourceDocuments = [
    document("pricing-document", "https://example.test/pricing"),
    document("home-document", "https://example.test/"),
  ];
  const sourceBlocks = [
    block("pricing-heading", "pricing-document", "heading", "Starter plan", 1),
    block("pricing-body", "pricing-document", "paragraph", "The Starter plan costs $29 per month.", 2),
    block("home-heading", "home-document", "heading", "Welcome", 1),
    block("home-body", "home-document", "paragraph", "Our team values good work and customer satisfaction.", 2),
  ];

  const result = buildDeterministicBusinessBrain({
    now: "2026-08-02T00:00:00.000Z",
    pages: [
      { url: "https://example.test/pricing", title: "Pricing", pageType: "pricing", sourceDocumentId: "pricing-document" },
      { url: "https://example.test/", title: "Home", pageType: "home", sourceDocumentId: "home-document" },
    ],
    sourceDocuments,
    sourceBlocks,
    owner: {
      productsServices: "Atlas software platform. We provide implementation consulting.",
    },
  });

  assert.ok(result.facts.some(fact => fact.category === "pricing_plan"));
  assert.ok(result.facts.some(fact => fact.category === "product"));
  assert.ok(result.facts.some(fact => fact.category === "service"));
  assert.ok(!result.facts.some(fact => /customer satisfaction/i.test(fact.value)));
  assert.ok(result.concepts.some(concept => concept.category === "pricing_plan"));
  assert.ok(result.concepts.some(concept => concept.category === "product"));
  assert.ok(result.concepts.some(concept => concept.category === "service"));
  assert.ok(result.concepts.every(concept => concept.supportingFactIds.every(id => result.facts.some(fact => fact.id === id))));

  const pricingEntry = result.session?.contextEntries.find(entry => entry.category === "pricing");
  assert.equal(pricingEntry?.metadata.supportingEvidence?.[0]?.sourceBlockId, "pricing-body");
  assert.equal(pricingEntry?.metadata.supportingEvidence?.[0]?.heading, "Starter plan");
});
