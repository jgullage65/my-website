import assert from "node:assert/strict";
import test from "node:test";
import type { BusinessMemory } from "../business-memory/contracts";
import { AssistantProjectionGenerationError, buildAssistantProjection } from "./buildAssistantProjection";

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
    conflicts: [],
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
  assert.equal(projection.identity.status, "resolved"); assert.equal(projection.identity.canonicalEntityId, "business"); assert.deepEqual(projection.identity.contactEntityIds, []);
  input.entities.push({ ...input.entities[0], id: "second-business", name: "Second" }); input.assertions.push({ ...input.assertions[0], id: "a-second", entityId: "second-business" });
  assert.throws(() => buildAssistantProjection(input), (error: unknown) => error instanceof AssistantProjectionGenerationError && error.code === "assistant_projection_ambiguous_identity");
  const missing = memory(); missing.entities = missing.entities.filter((entity) => entity.type !== "business");
  const missingProjection = buildAssistantProjection(missing); assert.equal(missingProjection.identity.status, "missing"); assert.equal(missingProjection.identity.canonicalEntityId, null); assert.equal(missingProjection.identity.businessName, null); assert.deepEqual(missingProjection.identity.contactEntityIds, []);
});

test("uses merge redirects, rejects redirect cycles, and honors canonical lifecycle", () => {
  const input = memory(); input.entityMerges = [{ canonicalEntityId: "business", mergedEntityIds: ["old-business"], approvedAliases: ["Old Acme"], mergedAt: time }];
  input.entities.push({ ...input.entities[0], id: "old-business" }); input.assertions.push({ ...input.assertions[0], id: "a-old", entityId: "old-business" });
  input.relationships[0] = { ...input.relationships[0], fromEntityId: "old-business", fromAssertionId: "a-old" };
  const projection = buildAssistantProjection(input); assert.equal(projection.relationships.length, 0); assert.equal(projection.relationships.some((item) => item.id === "archived"), false);
  input.entityMerges = [{ canonicalEntityId: "cycle-b", mergedEntityIds: ["cycle-a"], approvedAliases: [], mergedAt: time }, { canonicalEntityId: "cycle-a", mergedEntityIds: ["cycle-b"], approvedAliases: [], mergedAt: time }];
  input.entities.push({ ...input.entities[3], id: "cycle-a" }, { ...input.entities[3], id: "cycle-b" }); input.assertions.push({ ...input.assertions[3], id: "a-cycle", entityId: "cycle-a" });
  assert.throws(() => buildAssistantProjection(input), (error: unknown) => error instanceof AssistantProjectionGenerationError);
});

test("maps only explicit authoritative rules with stable bounded normalized identifiers", () => {
  const projection = buildAssistantProjection(memory());
  assert.deepEqual(projection.restrictions, []); // legacy assistant config is not reviewed Business Memory knowledge.
  assert.equal(projection.missingInformation[0].resolved, false); assert.deepEqual(projection.missingInformation[0].relatedEntityTypes, ["business"]);
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

test("rejects unresolved conflicts rather than serializing ambiguous runtime knowledge", () => {
  const input = memory(); input.conflicts = [{ id: "conflict", projectId: "project", topic: "price", conflictingStatements: [], relatedEntityIds: ["service"], relatedAssertionIds: ["a-service"], sourceIds: ["source"], evidenceIds: ["evidence"], suggestedClarificationQuestion: "Confirm price", resolved: false, resolution: null, createdAt: time, updatedAt: time }];
  assert.throws(() => buildAssistantProjection(input), (error: unknown) => error instanceof AssistantProjectionGenerationError && error.code === "assistant_projection_unresolved_conflict");
});

test("filters archived assertions and invalid evidence references without mutating input", () => {
  const input = memory(); input.assertions[3].reviewState = "archived"; input.assertions[3].evidenceIds.push("missing-evidence"); const before = structuredClone(input);
  const projection = buildAssistantProjection(input); assert.equal(projection.services.length, 0); assert.deepEqual(input, before);
  assert.equal(projection.relationships.every((item) => !("active" in item) && !("resolved" in item) && !("confidence" in item)), true);
});

test("projects only approved or corrected knowledge for every supported runtime type and preserves provenance", () => {
  const input = memory();
  const add = (id: string, type: BusinessMemory["entities"][number]["type"], state: BusinessMemory["assertions"][number]["reviewState"]) => {
    input.entities.push({ ...input.entities[3], id: `${id}-entity`, type, name: id, assertionIds: [id] });
    input.assertions.push({ ...input.assertions[3], id, entityId: `${id}-entity`, reviewState: state, authority: state === "corrected" ? "corrected" : "confirmed", sourceIds: ["source"], evidenceIds: ["evidence"] });
  };
  add("faq-approved", "faq", "approved"); add("pricing-corrected", "pricing_concept", "corrected"); add("policy-proposed", "policy", "proposed");
  for (const state of ["proposed", "archived"] as const) add(`service-${state}`, "service", state);
  const projection = buildAssistantProjection(input);
  assert.deepEqual(projection.services.map((item) => item.id), ["a-service"]);
  assert.deepEqual(projection.pricing.map((item) => item.id), ["pricing-corrected"]);
  assert.deepEqual(projection.policies, []); assert.deepEqual(projection.faqs.map((item) => item.id), ["faq-approved"]);
  assert.deepEqual(projection.services[0].sourceIds, ["source"]); assert.deepEqual(projection.services[0].evidenceIds, ["evidence"]);
});


test("projects only reviewed restriction assertions with provenance and rejects revision ambiguity", () => {
  const input = memory();
  const restriction = (id: string, reviewState: BusinessMemory["assertions"][number]["reviewState"], predecessorAssertionId?: string) => ({ ...input.assertions[3], id, value: id, reviewState, tags: ["behavior_rule"], sourceIds: ["source"], evidenceIds: ["evidence"], predecessorAssertionId });
  input.assertions.push(restriction("restriction-corrected", "corrected"), restriction("restriction-proposed", "proposed"), restriction("restriction-rejected", "rejected"), restriction("restriction-archived", "archived"), restriction("restriction-superseded", "superseded"));
  const projection = buildAssistantProjection(input);
  assert.deepEqual(projection.restrictions.map(item => item.id), ["restriction-corrected"]);
  assert.deepEqual(projection.restrictions[0].sourceIds, ["source"]); assert.deepEqual(projection.restrictions[0].evidenceIds, ["evidence"]); assert.equal(projection.restrictions[0].reviewState, "corrected");
  const competing = memory(); competing.assertions[3].reviewState = "superseded";
  competing.assertions.push({ ...competing.assertions[3], id: "successor-1", reviewState: "corrected", predecessorAssertionId: "a-service" }, { ...competing.assertions[3], id: "successor-2", reviewState: "approved", predecessorAssertionId: "a-service" });
  assert.throws(() => buildAssistantProjection(competing), /unresolved_revision_authority/);
  const activePredecessor = memory(); activePredecessor.assertions.push({ ...activePredecessor.assertions[3], id: "corrected-successor", reviewState: "corrected", predecessorAssertionId: "a-service" });
  assert.throws(() => buildAssistantProjection(activePredecessor), /unresolved_revision_authority/);
  const pending = memory(); pending.assertions.push({ ...pending.assertions[3], id: "pending-successor", reviewState: "proposed", predecessorAssertionId: "a-service" });
  assert.throws(() => buildAssistantProjection(pending), /unresolved_revision_authority/);
  const missing = memory(); missing.assertions[3].reviewState = "corrected"; missing.assertions[3].predecessorAssertionId = "missing";
  assert.throws(() => buildAssistantProjection(missing), /unresolved_revision_authority/);
  const cycle = memory(); cycle.assertions[3].reviewState = "superseded"; cycle.assertions.push({ ...cycle.assertions[3], id: "cycle", reviewState: "corrected", predecessorAssertionId: "a-service" }); cycle.assertions[3].predecessorAssertionId = "cycle";
  assert.throws(() => buildAssistantProjection(cycle), /unresolved_revision_authority/);
});

test("preserves canonical fact and FAQ correction provenance through legacy compatibility", async () => {
  const { buildLegacyKnowledgePackFromAssistantProjection } = await import("./legacy-compatibility");
  const input = memory(); const provenance = { classification: "user_corrected" as const, predecessorClassification: "manual" as const, originalClassification: "website" as const, correctedByClerkUserId: "u", correctedByDisplayName: "Ada", correctedByEmail: "ada@test", correctedAt: time };
  input.assertions[3].reviewState = "corrected"; input.assertions[3].provenance = provenance;
  input.entities.push({ ...input.entities[3], id: "faq", type: "faq", name: "Question", assertionIds: ["faq-a"] }); input.assertions.push({ ...input.assertions[3], id: "faq-a", entityId: "faq", provenance });
  const pack = buildLegacyKnowledgePackFromAssistantProjection(buildAssistantProjection(input));
  assert.deepEqual(pack.facts[0].provenance, provenance); assert.deepEqual(pack.faq[0].provenance, provenance);
});

test("projects authoritative relationships with source lineage and runtime rejects malformed endpoints", async () => {
  const { validateAssistantProjectionRuntime, AssistantProjectionRuntimeValidationError } = await import("./validation");
  const input = memory(); input.entities.push({ ...input.entities[3], id: "service-2", name: "Delivery", assertionIds: ["a-service-2"] }); input.assertions.push({ ...input.assertions[3], id: "a-service-2", entityId: "service-2" });
  input.relationships = [{ id: "related", type: "supports", fromEntityId: "service", toEntityId: "service-2", fromAssertionId: "a-service", toAssertionId: "a-service-2", sourceEntryIds: ["entry-1"], reviewState: "approved", createdAt: time, updatedAt: time }];
  const projection = buildAssistantProjection(input); assert.deepEqual(projection.relationships[0].sourceIds, ["source"]); assert.deepEqual(projection.relationships[0].evidenceIds, ["evidence"]);
  const malformed = structuredClone(projection); malformed.relationships[0].targetAssertionId = "proposed";
  assert.throws(() => validateAssistantProjectionRuntime(malformed), (error: unknown) => error instanceof AssistantProjectionRuntimeValidationError && error.code === "assistant_projection_runtime_invalid_relationship");
});


test("projects approved products into their dedicated canonical collection", () => {
  const input = memory();
  input.entities.push({ id: "product", type: "product", name: "Starter Kit", aliases: ["kit"], tags: [], assertionIds: ["a-product"], sourceIds: ["source"], evidenceIds: ["evidence"], createdAt: time, updatedAt: time });
  input.assertions.push({ ...input.assertions[3], id: "a-product", entityId: "product", value: "Starter kit details", sourceIds: ["source"], evidenceIds: ["evidence"] });
  const projection = buildAssistantProjection(input);
  assert.deepEqual(projection.products.map(item => [item.entityType, item.entityId, item.assertionId, item.aliases]), [["product", "product", "a-product", ["kit"]]]);
  assert.equal(projection.services.some(item => item.assertionId === "a-product"), false);
});
