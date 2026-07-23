import assert from "node:assert/strict";
import test from "node:test";
import type { AiBuilderSession, BusinessContextEntry } from "../contracts";
import { buildBusinessMemory } from "../business-memory/buildBusinessMemory";
import { buildAssistantProjection } from "./buildAssistantProjection";

const createdAt = "2026-07-19T10:00:00.000Z";
const updatedAt = "2026-07-19T11:00:00.000Z";

function session(overrides: Partial<AiBuilderSession> = {}): AiBuilderSession {
  return { id: "project_1", status: "review_required", intakeBlocks: [], assistantConfiguration: { name: "Ava", purpose: "Help customers", tone: "warm", responseStyle: "brief", primaryAudience: null, escalationInstructions: ["Escalate urgent matters"] }, contextEntries: [], faqEntries: [], conflicts: [], missingInformation: [], contextCounts: { total: 0, approved: 0, proposed: 0, archived: 0, byCategory: {} }, buildProgress: [], createdAt, updatedAt, expiresAt: null, ...overrides };
}
function entry(overrides: Partial<BusinessContextEntry> = {}): BusinessContextEntry {
  return { id: "service", sessionId: "project_1", category: "service", title: "Planning", content: "Remote planning is available.", confidence: "high", confidenceScore: .9, status: "approved", source: { intakeBlockId: "intake", excerpt: "Remote planning is available.", sourceType: "manual_intake", sourceUrl: null }, metadata: { generated: false, userEdited: false, conflictingEntryIds: [], tags: ["remote"] }, createdAt, updatedAt, ...overrides };
}
function memoryFixture() {
  const service = entry();
  const pricing = entry({ id: "pricing", category: "pricing", title: "Pricing", content: "Packages start at $100." });
  const policy = entry({ id: "policy", category: "policy", title: "Cancellation", content: "Cancel 24 hours ahead." });
  const archived = entry({ id: "archived", title: "Retired", status: "archived" });
  const faq = { id: "faq", sessionId: "project_1", question: "Do you offer planning?", answer: "Yes.", confidence: "medium" as const, confidenceScore: .7, sourceEntryIds: [service.id], status: "corrected" as const, createdAt, updatedAt };
  const memory = buildBusinessMemory({ session: session({ contextEntries: [policy, archived, pricing, service], faqEntries: [faq], conflicts: [{ id: "conflict", topic: "Availability", firstStatement: service.content, secondStatement: "Planning is unavailable.", sourceExcerpts: [], suggestedQuestion: "Please confirm availability.", resolved: false, resolution: null }], missingInformation: [{ id: "missing", topic: "Phone", reason: "Not supplied", suggestedQuestion: "What phone number should customers use?", resolved: false }] }), websiteKnowledge: null });
  memory.assistant.behaviorRules = ["Be accurate"];
  memory.assistant.prohibitedClaims = ["Do not promise outcomes"];
  return memory;
}

test("deterministically maps canonical domain collections, traceability, and restrictions", () => {
  const memory = memoryFixture();
  const before = structuredClone(memory);
  const first = buildAssistantProjection(memory);
  const second = buildAssistantProjection(memory);
  assert.deepEqual(first, second);
  assert.deepEqual(memory, before);
  assert.deepEqual(first.services.map((item) => item.title), ["Planning"]);
  assert.deepEqual(first.pricing.map((item) => item.title), ["Pricing"]);
  assert.deepEqual(first.policies.map((item) => item.title), ["Cancellation"]);
  assert.deepEqual(first.faqs.map((item) => [item.question, item.answer]), [["Do you offer planning?", "Yes."]]);
  assert.equal(first.services[0].assertionId, memory.assertions.find((item) => item.legacyEntryId === "service")?.id);
  assert.deepEqual(first.restrictions.map((item) => item.type), ["behavior_rule", "prohibited_claim", "conflict_suppression", "missing_information"]);
  assert.equal(first.relationships.length, 1);
  assert.ok(first.relationships[0].evidenceIds.every((id) => first.evidence.some((item) => item.id === id)));
  assert.equal(first.missingInformation[0].resolved, false);
  assert.equal("builtAt" in first, false);
  assert.equal("entities" in first, false);
  assert.equal(first.services.some((item) => item.title === "Retired"), false);
});

test("uses merge canonical endpoints and stable ordering without fabricating optional identity", () => {
  const memory = memoryFixture();
  const service = memory.entities.find((entity) => entity.type === "service")!;
  const faq = memory.entities.find((entity) => entity.type === "faq")!;
  memory.entityMerges = [{ canonicalEntityId: service.id, mergedEntityIds: [faq.id], approvedAliases: ["Planning help"], mergedAt: createdAt }];
  const projection = buildAssistantProjection(memory);
  assert.equal(projection.relationships[0].targetEntityId, service.id);
  assert.deepEqual(projection.services.map((item) => item.id), [...projection.services.map((item) => item.id)].sort());
  assert.deepEqual(projection.identity.identityKeys, []);
  assert.equal(projection.identity.businessName, null);
});
