import assert from "node:assert/strict";
import test from "node:test";
import type { DeterministicEngineInput } from "./contracts";
import { extractOwnerFacts, extractWebsiteFacts } from "./extraction";
import { normalizeSources } from "./normalization";
import { buildBucketShadowArchitecture } from "./shadowArchitecture";

function assertExtractedParity(input: DeterministicEngineInput): void {
  const normalizedBlocks = normalizeSources(input);
  const legacyExtracted = [
    ...extractOwnerFacts(input),
    ...extractWebsiteFacts(normalizedBlocks),
  ];
  const shadow = buildBucketShadowArchitecture(legacyExtracted);

  assert.deepEqual(shadow.extracted, legacyExtracted);
}

test("preserves owner-only extraction exactly", () => {
  assertExtractedParity({
    owner: {
      businessName: "Atlas",
      industry: "Marketing agencies",
      productsServices: "Atlas software platform. We provide implementation consulting.",
      policiesOperations: "The Starter plan costs $29 per month. Refunds are available within 30 days.",
    },
  });
});

test("preserves website-only extraction exactly", () => {
  assertExtractedParity({
    pages: [
      {
        url: "https://example.test/pricing",
        title: "Pricing",
        pageType: "pricing",
        text: "The Starter plan costs $29 per month. The Pro plan costs $79 per month.",
      },
      {
        url: "https://example.test/security",
        title: "Security",
        pageType: "security",
        text: "Customer data is encrypted and SSO is supported.",
      },
    ],
  });
});

test("preserves mixed-source and empty extraction exactly", () => {
  assertExtractedParity({
    owner: {
      productsServices: "Atlas software platform.",
    },
    pages: [
      {
        url: "https://example.test/services",
        title: "Services",
        pageType: "services",
        text: "We provide implementation consulting and training services.",
      },
    ],
  });

  assertExtractedParity({});
});
