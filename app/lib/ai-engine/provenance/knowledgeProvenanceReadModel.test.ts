import assert from "node:assert/strict";
import test from "node:test";
import type { AiBuilderSession, BusinessContextEntry, GeneratedFaqEntry } from "../contracts";
import {
  WEBSITE_KNOWLEDGE_COVERAGE_FIELDS,
  websiteFactReviewIdentity,
  type PersistedWebsiteKnowledge,
} from "../knowledge/websiteKnowledge";
import { buildKnowledgeProvenanceReadModel } from "./knowledgeProvenanceReadModel";

const now = "2026-07-31T20:00:00.000Z";

function contextEntry(overrides: Partial<BusinessContextEntry> = {}): BusinessContextEntry {
  return {
    id: "entry_1",
    sessionId: "project_1",
    category: "service",
    title: "Strategy workshops",
    content: "Remote strategy workshops are available.",
    confidence: "high",
    confidenceScore: 0.92,
    status: "approved",
    source: {
      intakeBlockId: "manual_services",
      excerpt: "Remote strategy workshops are available.",
      sourceType: "manual_intake",
      sourceUrl: null,
    },
    metadata: {
      generated: false,
      userEdited: false,
      conflictingEntryIds: [],
      tags: [],
    },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function faqEntry(overrides: Partial<GeneratedFaqEntry> = {}): GeneratedFaqEntry {
  return {
    id: "faq_1",
    sessionId: "project_1",
    question: "Do you offer strategy workshops?",
    answer: "Yes, including remote workshops.",
    confidence: "medium",
    confidenceScore: 0.76,
    sourceEntryIds: ["entry_1"],
    status: "approved",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function session(overrides: Partial<AiBuilderSession> = {}): AiBuilderSession {
  return {
    id: "project_1",
    status: "ready",
    intakeBlocks: [],
    assistantConfiguration: {
      name: "Assistant",
      purpose: "Help",
      tone: "Professional",
      responseStyle: "Clear",
      primaryAudience: null,
      escalationInstructions: [],
    },
    contextEntries: [contextEntry()],
    faqEntries: [],
    conflicts: [],
    missingInformation: [],
    contextCounts: { total: 1, approved: 1, proposed: 0, archived: 0, byCategory: { service: 1 } },
    buildProgress: [],
    createdAt: now,
    updatedAt: now,
    expiresAt: null,
    ...overrides,
  };
}

function websiteKnowledge(): PersistedWebsiteKnowledge {
  const coverage = Object.fromEntries(
    WEBSITE_KNOWLEDGE_COVERAGE_FIELDS.map((field) => [field, 0]),
  ) as PersistedWebsiteKnowledge["knowledge"]["coverage"];
  const fact = {
    category: "service" as const,
    title: "Strategy workshops",
    value: "Remote strategy workshops are available.",
    confidence: "high" as const,
    evidence: [
      {
        url: "https://example.com/services",
        excerpt: "Remote strategy workshops are available.",
        sourceDocumentId: "document_1",
        sourceBlockId: "block_1",
        crawlAttemptId: "crawl_1",
        sourceCoordinates: { startOffset: 120, endOffset: 160 },
      },
      {
        url: "https://example.com/about",
        excerpt: "Our workshops can be delivered remotely.",
        sourceDocumentId: "document_2",
        sourceBlockId: "block_2",
        crawlAttemptId: "crawl_1",
      },
    ],
  };
  return {
    schema_version: 2,
    document_version: 1,
    current_crawl_attempt_id: "crawl_1",
    imported_at: now,
    requested_url: "https://example.com",
    resolved_url: "https://example.com",
    pages: [],
    warnings: [],
    knowledge: { facts: [fact], coverage, unresolvedQuestions: [] },
    source_documents: [],
    source_blocks: [],
  };
}

test("returns all exact website evidence instead of flattening to the first excerpt", () => {
  const knowledge = websiteKnowledge();
  const fact = knowledge.knowledge.facts[0];
  const entry = contextEntry({
    id: websiteFactReviewIdentity("project_1", fact),
    source: {
      intakeBlockId: "website_knowledge",
      excerpt: fact.evidence[0].excerpt,
      sourceType: "website",
      sourceUrl: fact.evidence[0].url,
    },
    metadata: {
      generated: true,
      userEdited: false,
      conflictingEntryIds: [],
      tags: ["service"],
      provenanceClassification: "website",
    },
  });
  const model = buildKnowledgeProvenanceReadModel({
    session: session({ contextEntries: [entry] }),
    websiteKnowledge: knowledge,
    itemKind: "context_entry",
    itemId: entry.id,
  });

  assert.equal(model?.availability, "exact");
  assert.equal(model?.classification, "website");
  assert.equal(model?.evidence.length, 2);
  assert.equal(model?.evidence[0].sourceDocumentId, "document_1");
  assert.equal(model?.evidence[0].sourceBlockId, "block_1");
  assert.equal(model?.evidence[0].crawlAttemptId, "crawl_1");
});

test("returns partial provenance for legacy URL and excerpt only", () => {
  const entry = contextEntry({
    source: {
      intakeBlockId: "website_knowledge",
      excerpt: "Legacy supporting excerpt.",
      sourceType: "website",
      sourceUrl: "https://example.com/legacy",
    },
    metadata: {
      generated: true,
      userEdited: false,
      conflictingEntryIds: [],
      tags: [],
      provenanceClassification: "website",
    },
  });
  const model = buildKnowledgeProvenanceReadModel({
    session: session({ contextEntries: [entry] }),
    websiteKnowledge: null,
    itemKind: "context_entry",
    itemId: entry.id,
  });

  assert.equal(model?.availability, "partial");
  assert.equal(model?.evidence[0].url, "https://example.com/legacy");
  assert.equal(model?.evidence[0].sourceBlockId, null);
});

test("preserves original and predecessor provenance after a correction", () => {
  const entry = contextEntry({
    status: "corrected",
    source: {
      intakeBlockId: "website_knowledge",
      excerpt: "Original excerpt.",
      sourceType: "user_edit",
      sourceUrl: "https://example.com/services",
    },
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
  const model = buildKnowledgeProvenanceReadModel({
    session: session({ contextEntries: [entry] }),
    websiteKnowledge: null,
    itemKind: "context_entry",
    itemId: entry.id,
  });

  assert.equal(model?.classification, "user_corrected");
  assert.equal(model?.originalClassification, "website");
  assert.equal(model?.predecessorClassification, "website");
});

test("resolves FAQ relationships and combines supporting evidence", () => {
  const first = contextEntry({ id: "entry_1" });
  const second = contextEntry({
    id: "entry_2",
    title: "Delivery",
    content: "Workshops are delivered online.",
    source: {
      intakeBlockId: "manual_delivery",
      excerpt: "Workshops are delivered online.",
      sourceType: "manual_intake",
      sourceUrl: null,
    },
  });
  const faq = faqEntry({ sourceEntryIds: [first.id, second.id] });
  const model = buildKnowledgeProvenanceReadModel({
    session: session({ contextEntries: [first, second], faqEntries: [faq] }),
    websiteKnowledge: null,
    itemKind: "faq",
    itemId: faq.id,
  });

  assert.deepEqual(model?.relatedEntryIds, ["entry_1", "entry_2"]);
  assert.equal(model?.evidence.length, 2);
  assert.equal(model?.availability, "partial");
});

test("returns null for an item outside the loaded project", () => {
  assert.equal(
    buildKnowledgeProvenanceReadModel({
      session: session(),
      websiteKnowledge: null,
      itemKind: "context_entry",
      itemId: "missing",
    }),
    null,
  );
});
