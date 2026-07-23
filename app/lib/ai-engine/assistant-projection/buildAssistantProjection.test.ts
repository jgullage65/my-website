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

test("canonicalizes collection, nested set-like array, and object insertion order for fingerprints", () => {
  const input = memory(); const baseline = buildAssistantProjection(input).businessMemoryFingerprint;
  const reordered = structuredClone(input);
  reordered.entities.reverse(); reordered.assertions.reverse(); reordered.relationships.reverse(); reordered.sources.reverse(); reordered.evidence.reverse(); reordered.conflicts.reverse(); reordered.missingInformation.reverse();
  reordered.entities[0].aliases.reverse(); reordered.entities[0].assertionIds.reverse(); reordered.assistant.escalationInstructions.reverse();
  reordered.assertions[0].confidence = { score: .9, level: "high" };
  assert.equal(buildAssistantProjection(reordered).businessMemoryFingerprint, baseline);
});

test("includes captured timestamps but excludes operational mutation timestamps from fingerprints", () => {
  const input = memory(); const baseline = buildAssistantProjection(input).businessMemoryFingerprint;
  const updated = structuredClone(input); updated.updatedAt = "2099-01-01T00:00:00.000Z"; updated.entities[0].updatedAt = updated.updatedAt;
  assert.equal(buildAssistantProjection(updated).businessMemoryFingerprint, baseline);
  const sourceCaptured = structuredClone(input); sourceCaptured.sources[0].capturedAt = "2099-01-01T00:00:00.000Z";
  assert.notEqual(buildAssistantProjection(sourceCaptured).businessMemoryFingerprint, baseline);
  const evidenceCaptured = structuredClone(input); evidenceCaptured.evidence[0].capturedAt = "2099-01-01T00:00:00.000Z";
  assert.notEqual(buildAssistantProjection(evidenceCaptured).businessMemoryFingerprint, baseline);
});

test("sets identity status for resolved, ambiguous, and missing canonical businesses", () => {
  const input = memory(); const projection = buildAssistantProjection(input);
  assert.equal(projection.identity.status, "resolved"); assert.equal(projection.identity.canonicalEntityId, "business"); assert.deepEqual(projection.identity.contactEntityIds, ["contact"]);
  input.entities.push({ ...input.entities[0], id: "second-business", name: "Second" }); input.assertions.push({ ...input.assertions[0], id: "a-second", entityId: "second-business" });
  const ambiguous = buildAssistantProjection(input); assert.equal(ambiguous.identity.status, "ambiguous"); assert.equal(ambiguous.identity.canonicalEntityId, null); assert.equal(ambiguous.identity.businessName, null); assert.deepEqual(ambiguous.identity.contactEntityIds, []);
  const missing = memory(); missing.entities = missing.entities.filter((entity) => entity.type !== "business");
  const missingProjection = buildAssistantProjection(missing); assert.equal(missingProjection.identity.status, "missing"); assert.equal(missingProjection.identity.canonicalEntityId, null); assert.equal(missingProjection.identity.businessName, null); assert.deepEqual(missingProjection.identity.contactEntityIds, []);
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

test("equivalent rules select a deterministic display string regardless of input order", () => {
  const forward = memory(); const reverse = structuredClone(forward);
  reverse.assistant.behaviorRules!.reverse(); reverse.assistant.prohibitedClaims = ["  Don't   promise outcomes. ", "Don't promise outcomes."];
  forward.assistant.prohibitedClaims = ["Don't promise outcomes.", "  Don't   promise outcomes. "];
  assert.deepEqual(buildAssistantProjection(forward), buildAssistantProjection(reverse));
  assert.equal(buildAssistantProjection(forward).restrictions.find((item) => item.type === "behavior_rule")?.instruction, "Be accurate!");
});

test("preserves duplicate approved assertions across merged entities as independently addressable provenance", () => {
  const input = memory();
  input.entities.push({ ...input.entities[3], id: "old-service", assertionIds: ["a-old-service"] });
  input.entityMerges = [{ canonicalEntityId: "service", mergedEntityIds: ["old-service"], approvedAliases: [], mergedAt: time }];
  input.assertions.push({ ...input.assertions[3], id: "a-old-service", entityId: "old-service", value: input.assertions[3].value });
  const services = buildAssistantProjection(input).services.filter((item) => item.value === "service");
  assert.deepEqual(services.map((item) => item.assertionId).sort(), ["a-old-service", "a-service"]);
  assert.ok(services.every((item) => item.entityId === "service"));
});

test("projects conflicting assertions together with their suppression restriction", () => {
  const projection = buildAssistantProjection(memory()); const restriction = projection.restrictions.find((item) => item.type === "conflict_suppression")!;
  assert.ok(projection.services.some((item) => item.assertionId === "a-service"));
  assert.deepEqual(restriction.relatedAssertionIds, ["a-service"]); assert.deepEqual(restriction.evidenceIds, ["evidence"]);
});

test("filters archived assertions and invalid evidence references without mutating input", () => {
  const input = memory(); input.assertions[3].reviewState = "archived"; input.assertions[3].evidenceIds.push("missing-evidence"); const before = structuredClone(input);
  const projection = buildAssistantProjection(input); assert.equal(projection.services.length, 0); assert.deepEqual(input, before);
  assert.equal(projection.relationships.every((item) => !("active" in item) && !("resolved" in item) && !("confidence" in item)), true);
});
