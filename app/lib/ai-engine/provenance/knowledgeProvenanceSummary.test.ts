import assert from "node:assert/strict";
import test from "node:test";
import type { AiBuilderSession, BusinessContextEntry, GeneratedFaqEntry } from "../contracts";
import { buildKnowledgeProvenanceSummaries } from "./knowledgeProvenanceSummary";

const now = "2026-07-31T20:00:00.000Z";

function context(overrides: Partial<BusinessContextEntry> = {}): BusinessContextEntry {
  return {
    id: "context_1",
    sessionId: "project_1",
    category: "service",
    title: "Consulting",
    content: "Consulting is available.",
    confidence: "high",
    confidenceScore: 0.91,
    status: "approved",
    source: { intakeBlockId: "manual_1", excerpt: "Consulting is available.", sourceType: "manual_intake", sourceUrl: null },
    metadata: { generated: false, userEdited: false, conflictingEntryIds: [], tags: [], provenanceClassification: "manual" },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function faq(overrides: Partial<GeneratedFaqEntry> = {}): GeneratedFaqEntry {
  return {
    id: "faq_1",
    sessionId: "project_1",
    question: "Do you consult?",
    answer: "Yes.",
    confidence: "medium",
    confidenceScore: 0.7,
    sourceEntryIds: ["context_1"],
    status: "approved",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function session(contextEntries: BusinessContextEntry[], faqEntries: GeneratedFaqEntry[] = []): AiBuilderSession {
  return {
    id: "project_1",
    status: "ready",
    intakeBlocks: [],
    assistantConfiguration: { name: "Assistant", purpose: "Help", tone: "Professional", responseStyle: "Clear", primaryAudience: null, escalationInstructions: [] },
    contextEntries,
    faqEntries,
    conflicts: [],
    missingInformation: [],
    contextCounts: { total: contextEntries.length + faqEntries.length, approved: contextEntries.length + faqEntries.length, proposed: 0, archived: 0, byCategory: {} },
    buildProgress: [],
    createdAt: now,
    updatedAt: now,
    expiresAt: null,
  };
}

test("returns one compact summary per knowledge item", () => {
  const summaries = buildKnowledgeProvenanceSummaries({ session: session([context()], [faq()]), websiteKnowledge: null });
  assert.deepEqual(Object.keys(summaries.contextEntries), ["context_1"]);
  assert.deepEqual(Object.keys(summaries.faqEntries), ["faq_1"]);
  assert.equal(summaries.contextEntries.context_1.classification, "manual");
  assert.equal(summaries.contextEntries.context_1.evidenceCount, 1);
  assert.equal(summaries.faqEntries.faq_1.relatedEntryCount, 1);
});

test("keeps corrected lineage visible in the compact summary", () => {
  const corrected = context({
    status: "corrected",
    source: { intakeBlockId: "manual_1", excerpt: "Original website statement.", sourceType: "user_edit", sourceUrl: "https://example.com" },
    metadata: {
      generated: true,
      userEdited: true,
      conflictingEntryIds: [],
      tags: [],
      provenanceClassification: "user_corrected",
      originalProvenanceClassification: "website",
      predecessorProvenanceClassification: "website",
    },
  });
  const summary = buildKnowledgeProvenanceSummaries({ session: session([corrected]), websiteKnowledge: null }).contextEntries.context_1;
  assert.equal(summary.classification, "user_corrected");
  assert.equal(summary.originalClassification, "website");
  assert.equal(summary.availability, "partial");
});

test("archived items retain provenance summaries", () => {
  const archived = context({ status: "archived" });
  const summary = buildKnowledgeProvenanceSummaries({ session: session([archived]), websiteKnowledge: null }).contextEntries.context_1;
  assert.equal(summary.classification, "manual");
  assert.equal(summary.evidenceCount, 1);
});
