import assert from "node:assert/strict";
import test from "node:test";
import {
  BUSINESS_MEMORY_SCHEMA_VERSION,
  type BusinessMemory,
  type KnowledgeSourceOrigin,
  type ReviewState,
} from "./contracts";

const timestamp = "2026-07-20T00:00:00.000Z";

test("the authoritative BusinessMemory root is versioned and retains lossless provenance", () => {
  const memory: BusinessMemory = {
    id: "memory-1",
    schemaVersion: BUSINESS_MEMORY_SCHEMA_VERSION,
    projectId: "project-1",
    assistant: {
      name: "Northstar Assistant",
      purpose: "Help customers",
      tone: "Warm",
      responseStyle: "Concise",
      primaryAudience: "Owners",
      escalationInstructions: ["Contact the owner"],
      behaviorRules: ["Use approved facts"],
      prohibitedClaims: ["Do not promise outcomes"],
    },
    entities: [
      { id: "entity-service", type: "service", name: "Planning", aliases: ["Planning"], tags: ["service"], assertionIds: ["assertion-service"], sourceIds: ["source-manual", "source-web"], evidenceIds: ["evidence-manual", "evidence-web-1", "evidence-web-2"], createdAt: timestamp, updatedAt: timestamp },
      { id: "entity-pricing", type: "pricing_concept", name: "Planning price", aliases: [], tags: ["pricing"], assertionIds: ["assertion-pricing"], sourceIds: ["source-manual"], evidenceIds: ["evidence-manual"], createdAt: timestamp, updatedAt: timestamp },
    ],
    assertions: [
      { id: "assertion-service", entityId: "entity-service", value: "Planning is available remotely.", confidence: { level: "high", score: 0.9 }, reviewState: "corrected", authority: "corrected", sourceIds: ["source-manual", "source-web"], evidenceIds: ["evidence-manual", "evidence-web-1", "evidence-web-2"], tags: ["service"], legacyEntryId: "context-1", createdAt: timestamp, updatedAt: timestamp },
      { id: "assertion-pricing", entityId: "entity-pricing", value: "$100 per session.", confidence: { level: "medium", score: 0.7 }, reviewState: "approved", authority: "provided", sourceIds: ["source-manual"], evidenceIds: ["evidence-manual"], tags: ["pricing"], legacyEntryId: "context-2", createdAt: timestamp, updatedAt: timestamp },
    ],
    relationships: [{ id: "relationship-1", type: "has_pricing", fromEntityId: "entity-service", toEntityId: "entity-pricing", fromAssertionId: "assertion-service", toAssertionId: "assertion-pricing", sourceEntryIds: ["context-1", "context-2"], reviewState: "approved", createdAt: timestamp, updatedAt: timestamp }],
    sources: [
      { id: "source-manual", origin: "manual_intake", sourceEntryId: "context-1", intakeBlockId: "intake-1", url: null, label: "Service intake", capturedAt: timestamp, crawlAttemptId: null, pageType: null, importedAt: timestamp },
      { id: "source-web", origin: "website", sourceEntryId: null, intakeBlockId: null, url: "https://example.test/services", label: "Services", capturedAt: timestamp, crawlAttemptId: "crawl-1", pageType: "service", importedAt: timestamp },
    ],
    evidence: [
      { id: "evidence-manual", sourceId: "source-manual", excerpt: "Remote planning", url: null, capturedAt: timestamp },
      { id: "evidence-web-1", sourceId: "source-web", excerpt: "Planning is remote.", url: "https://example.test/services", capturedAt: timestamp },
      { id: "evidence-web-2", sourceId: "source-web", excerpt: "Planning price details.", url: "https://example.test/pricing", capturedAt: timestamp },
    ],
    conflicts: [{ id: "conflict-1", projectId: "project-1", topic: "Planning price", conflictingStatements: ["$100", "$120"], relatedEntityIds: ["entity-service", "entity-pricing"], relatedAssertionIds: ["assertion-service", "assertion-pricing"], sourceIds: ["source-manual", "source-web"], evidenceIds: ["evidence-manual", "evidence-web-1"], suggestedClarificationQuestion: "Which price is current?", resolved: false, resolution: null, createdAt: timestamp, updatedAt: timestamp }],
    missingInformation: [{ id: "missing-1", projectId: "project-1", topic: "Service hours", reason: "No source states hours.", suggestedQuestion: "What are your hours?", relatedEntityTypes: ["service", "contact_method"], relatedEntityIds: ["entity-service"], relatedAssertionIds: ["assertion-service"], resolved: false, createdAt: timestamp, updatedAt: timestamp }],
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  assert.equal(memory.schemaVersion, 1);
  assert.equal(memory.assistant.name, "Northstar Assistant");
  assert.equal(memory.sources.length, 2);
  assert.equal(memory.evidence.length, 3);
  assert.deepEqual(memory.assertions[0].sourceIds, ["source-manual", "source-web"]);
  assert.deepEqual(memory.assertions[0].evidenceIds, ["evidence-manual", "evidence-web-1", "evidence-web-2"]);
  assert.ok(memory.entities.some((entity) => entity.id === memory.relationships[0].fromEntityId));
  assert.ok(memory.entities.some((entity) => entity.id === memory.relationships[0].toEntityId));
  assert.ok(memory.assertions.some((assertion) => assertion.id === memory.relationships[0].fromAssertionId));
  assert.ok(memory.assertions.some((assertion) => assertion.id === memory.relationships[0].toAssertionId));
  assert.equal(memory.conflicts.length, 1);
  assert.equal(memory.missingInformation.length, 1);
});

test("legacy review states and required source origins remain accepted", () => {
  const reviewStates: ReviewState[] = ["proposed", "approved", "corrected", "archived"];
  const sourceOrigins: KnowledgeSourceOrigin[] = ["website", "manual_intake", "generated_qa", "generated", "user_edit", "imported_data", "system"];

  assert.deepEqual(reviewStates, ["proposed", "approved", "corrected", "archived"]);
  assert.deepEqual(sourceOrigins, ["website", "manual_intake", "generated_qa", "generated", "user_edit", "imported_data", "system"]);
});
