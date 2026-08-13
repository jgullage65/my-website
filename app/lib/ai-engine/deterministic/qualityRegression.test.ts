import assert from "node:assert/strict";
import test from "node:test";
import { buildDeterministicBusinessBrain } from "./index";
import type { DeterministicEngineInput } from "./contracts";
import type {
  WebsiteSourceBlockRecord,
  WebsiteSourceDocumentRecord,
} from "../crawler/websiteSourceRecords";

function doc(id: string, url: string): WebsiteSourceDocumentRecord {
  return {
    schemaVersion: 1,
    id,
    crawlAttemptId: "attempt",
    actualFetchedUrl: url,
    canonicalUrl: url,
    redirectChain: [],
    sourceType: "html",
    contentType: "text/html",
    status: "retained",
    fetchedAt: "2026-08-13T00:00:00Z",
    sourceContentHash: "a".repeat(64),
    extractedContentHash: "b".repeat(64),
    language: "en",
    sourceTruncated: false,
    extractionTruncated: false,
    discoveryMethod: "submitted",
    discoveredFromUrl: null,
  };
}

function block(
  id: string,
  sourceDocumentId: string,
  type: WebsiteSourceBlockRecord["type"],
  normalizedText: string,
): WebsiteSourceBlockRecord {
  return {
    schemaVersion: 1,
    id,
    sourceDocumentId,
    crawlAttemptId: "attempt",
    type,
    normalizedText,
    coordinates: { lineStart: 1, lineEnd: 1 },
    extractionMethod: "semantic_html",
  };
}

function brain(pageType: string, heading: string, paragraphs: string[]) {
  const url = `https://example.test/${pageType}`;
  const input: DeterministicEngineInput = {
    pages: [{
      url,
      pageType,
      title: heading,
      sourceDocumentId: "d",
    }],
    sourceDocuments: [doc("d", url)],
    sourceBlocks: [
      block("h", "d", "heading", heading),
      ...paragraphs.map((text, index) => block(`p${index}`, "d", "paragraph", text)),
    ],
  };
  return buildDeterministicBusinessBrain(input);
}

test("multiple testimonials become one customer-proof fact while retaining all evidence", () => {
  const result = brain("home", "Patient Reviews", [
    "I highly recommend this clinic because the treatment helped me tremendously.",
    "This place goes above and beyond in providing excellent customer service.",
    "The results have been life-changing and the care worked wonders for me.",
  ]);

  const proof = result.facts.filter(
    fact => fact.category === "additional_business_knowledge" && fact.topicKey === "additional_business_knowledge:customer_proof",
  );

  assert.equal(proof.length, 1);
  assert.equal(proof[0]?.title, "Customer proof");
  assert.ok((proof[0]?.evidence.length ?? 0) >= 3);
});

test("privacy and tracking prose cannot masquerade as commercial intelligence", () => {
  const result = brain("home", "Privacy", [
    "To personalize and develop our Services and the services we provide to you, we collect device information and IP address data.",
    "Not all browsers offer a DNT option and DNT signals are not yet uniform.",
  ]);

  assert.equal(result.facts.some(fact => fact.category === "service"), false);
  assert.equal(result.facts.some(fact => fact.category === "pricing_plan"), false);
  assert.equal(result.facts.some(fact => fact.category === "location_service_area"), false);
});

test("full verified claims are preserved and titles are semantic instead of chopped prose", () => {
  const claim = "Dr. Kim has been treating and helping patients utilizing his unique approaches for over a decade.";
  const result = brain("about", "Provider Experience", [claim]);
  const fact = result.facts.find(item => item.category === "competitive_differentiator");

  assert.ok(fact);
  assert.equal(fact?.value, claim);
  assert.equal(fact?.title, "Provider Experience");
  assert.notEqual(fact?.title, claim);
});
