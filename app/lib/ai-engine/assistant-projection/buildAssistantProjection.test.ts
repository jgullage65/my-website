import assert from "node:assert/strict";
import test from "node:test";
import type { BusinessMemory } from "../business-memory/contracts";
import { buildAssistantProjection } from "./buildAssistantProjection";

const time = "2026-07-19T10:00:00.000Z";
function memory(): BusinessMemory {
  return { id: "memory", schemaVersion: 1, projectId: "project", createdAt: time, updatedAt: time,
    assistant: { name: "Ava", purpose: "Help", tone: "warm", responseStyle: "brief", primaryAudience: null, escalationInstructions: ["Escalate"], behaviorRules: ["  Be   accurate! ", "be accurate!"], prohibitedClaims: ["Don't promise outcomes."] },
    entities: [
      { id: "business", type: "business", name: "Acme", aliases: ["Acme Inc"], tags: [], assertionIds: ["a-business"], sourceIds: [], evidenceIds: [], createdAt: time, updatedAt: time },
      { id: "contact", type: "contact_method", name: "Phone", aliases: [], tags: [], assertionIds: ["a-contact"], sourceIds: ["source"], evidenceIds: ["evidence"], createdAt: time, updatedAt: time },
      { id: "unrelated-contact", type: "contact_method", name: "Other phone", aliases: [], tags: [], assertionIds: ["a-other"], sourceIds: [], evidenceIds: [], createdAt: time, updatedAt: time },
      { id: "service", type: "service", name: "Planning", aliases: [], tags: [], assertionIds: ["a-service"], sourceIds: ["source"], evidenceIds: ["evidence"], createdAt: time, updatedAt: time },
    ],
    assertions: ["business", "contact", "unrelated-contact", "service"].map((entityId) => ({ id: `a-${entityId === "unrelated-contact" ? "other" : entityId}`, entityId, value: entityId, confidence: { level: "high" as const, score: .9 }, reviewState: "approved" as const, authority: "confirmed" as const, sourceIds: entityId === "service" || entityId === "contact" ? ["source"] : [], evidenceIds: entityId === "service" || entityId === "contact" ? ["evidence"] : [], tags: [], legacyEntryId: null, createdAt: time, updatedAt: time })),
    relationships: [
      { id: "business-contact", type: "supports", fromEntityId: "business", toEntityId: "contact", fromAssertionId: "a-business", toAssertionId: "a-contact", sourceEntryIds: [], reviewState: "corrected", createdAt: time, updatedAt: time },
      { id: "archived", type: "supports", fromEntityId: "business", toEntityId: "unrelated-contact", fromAssertionId: "a-business", toAssertionId: "a-other", sourceEntryIds: [], reviewState: "archived", createdAt: time, updatedAt: time },
    ], sources: [{ id: "source", origin: "website", sourceEntryId: null, intakeBlockId: null, url: "https://acme.test", label: "Acme", capturedAt: time, crawlAttemptId: "crawl" }], evidence: [{ id: "evidence", sourceId: "source", excerpt: "Planning", url: null, capturedAt: time }],
    conflicts: [{ id: "conflict", projectId: "project", topic: "price", conflictingStatements: [], relatedEntityIds: ["service"], relatedAssertionIds: ["a-service"], sourceIds: ["source"], evidenceIds: ["evidence"], suggestedClarificationQuestion: "Confirm price", resolved: false, resolution: null, createdAt: time, updatedAt: time }],
    missingInformation: [{ id: "missing", projectId: "project", topic: "hours", reason: "unknown", suggestedQuestion: "What hours?", relatedEntityTypes: ["business"], relatedEntityIds: ["business"], relatedAssertionIds: ["a-business"], resolved: false, createdAt: time, updatedAt: time }],
  };
}

test("is deterministic, timestamp-independent, and preserves resolvable source references", () => {
  const input = memory(); const before = structuredClone(input); const first = buildAssistantProjection(input);
  input.updatedAt = "2099-01-01T00:00:00.000Z"; input.entities[0].updatedAt = input.updatedAt; input.assertions[0].updatedAt = input.updatedAt;
  const second = buildAssistantProjection(input);
  assert.equal(first.businessMemoryFingerprint, second.businessMemoryFingerprint);
  assert.deepEqual(before, memory()); assert.equal("businessMemoryVersion" in first, false); assert.equal("identityKeys" in first.identity, false);
  assert.ok(first.evidence.every((item) => first.sources.some((source) => source.id === item.canonicalSourceId)));
  assert.ok(first.services.flatMap((item) => item.sourceIds).every((id) => first.sources.some((source) => source.id === id)));
  assert.equal("provenanceClassification" in first.evidence[0], false);
});

test("selects only an unambiguous canonical business and only related contacts", () => {
  const input = memory(); const projection = buildAssistantProjection(input);
  assert.equal(projection.identity.canonicalEntityId, "business"); assert.deepEqual(projection.identity.contactEntityIds, ["contact"]);
  input.entities.push({ ...input.entities[0], id: "second-business", name: "Second" }); input.assertions.push({ ...input.assertions[0], id: "a-second", entityId: "second-business" });
  const ambiguous = buildAssistantProjection(input); assert.equal(ambiguous.identity.canonicalEntityId, null); assert.deepEqual(ambiguous.identity.contactEntityIds, []);
});

test("uses merge redirects, rejects redirect cycles, and honors canonical lifecycle", () => {
  const input = memory(); input.entityMerges = [{ canonicalEntityId: "business", mergedEntityIds: ["old-business"], approvedAliases: ["Old Acme"], mergedAt: time }];
  input.entities.push({ ...input.entities[0], id: "old-business" }); input.assertions.push({ ...input.assertions[0], id: "a-old", entityId: "old-business" });
  input.relationships[0] = { ...input.relationships[0], fromEntityId: "old-business", fromAssertionId: "a-old" };
  const projection = buildAssistantProjection(input); assert.equal(projection.relationships[0].sourceEntityId, "business"); assert.equal(projection.relationships.some((item) => item.id === "archived"), false);
  input.entityMerges = [{ canonicalEntityId: "cycle-b", mergedEntityIds: ["cycle-a"], approvedAliases: [], mergedAt: time }, { canonicalEntityId: "cycle-a", mergedEntityIds: ["cycle-b"], approvedAliases: [], mergedAt: time }];
  input.entities.push({ ...input.entities[3], id: "cycle-a" }, { ...input.entities[3], id: "cycle-b" }); input.assertions.push({ ...input.assertions[3], id: "a-cycle", entityId: "cycle-a" });
  assert.equal(buildAssistantProjection(input).services.some((item) => item.id === "a-cycle"), false);
});

test("maps only explicit rules and conflicts with stable bounded normalized identifiers", () => {
  const projection = buildAssistantProjection(memory());
  assert.deepEqual(projection.restrictions.map((item) => item.type), ["behavior_rule", "prohibited_claim", "conflict_suppression"]);
  const behavior = projection.restrictions.find((item) => item.type === "behavior_rule")!; assert.match(behavior.id, /^assistant_behavior_rule_[a-f0-9]{24}$/); assert.equal(projection.restrictions.some((item) => item.id === "missing"), false);
  assert.equal(projection.missingInformation[0].resolved, false); assert.deepEqual(projection.missingInformation[0].relatedEntityTypes, ["business"]);
});

test("filters superseded assertions and invalid evidence references without mutating input", () => {
  const input = memory(); input.assertions[3].reviewState = "archived"; input.assertions[3].evidenceIds.push("missing-evidence"); const before = structuredClone(input);
  const projection = buildAssistantProjection(input); assert.equal(projection.services.length, 0); assert.deepEqual(input, before);
  assert.equal(projection.relationships.every((item) => !("active" in item) && !("resolved" in item) && !("confidence" in item)), true);
});
