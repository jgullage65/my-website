import assert from "node:assert/strict";
import test from "node:test";
import { buildSystemPrompt } from "../chat/buildSystemPrompt";
import { classifyResponseDepth } from "../chat/classifyResponseDepth";
import { retrieveKnowledge } from "../chat/retrieveKnowledge";
import type { AssistantProjection } from "./contracts";
import { AssistantProjectionLegacyAdapterError, buildLegacyKnowledgePackFromAssistantProjection } from "./legacy-compatibility";

const capturedAt = "2026-07-19T10:00:00.000Z";
function projection(): AssistantProjection {
  const item = <T extends "service" | "pricing_concept" | "policy" | "faq">(id: string, entityType: T, title: string, value: string) => ({ id, entityId: `${id}-entity`, assertionId: `${id}-assertion`, entityType, title, value, aliases: [], tags: ["z", "a"], confidence: { level: "high" as const, score: .9 }, authority: "confirmed" as const, reviewState: "approved" as const, evidenceIds: ["evidence-b", "evidence-a"], sourceIds: ["source-b", "source-a"] });
  return {
    projectId: "project-1", businessMemoryFingerprint: "fingerprint", projectionVersion: 1, schemaVersion: 1,
    identity: { status: "resolved", canonicalEntityId: "business", businessName: "Acme", aliases: ["Acme Inc"], mergedEntityIds: [], redirectedEntityIds: [], contactEntityIds: [] },
    assistant: { name: "Ava", purpose: "Help visitors", tone: "warm", responseStyle: "brief", primaryAudience: "Owners", escalationInstructions: ["Escalate billing"] },
    services: [item("service-z", "service", "Support", "We provide support"), item("service-a", "service", "Consulting", "We provide consulting")],
    pricing: [item("pricing", "pricing_concept", "Pricing", "Plans start at $10")], policies: [item("policy", "policy", "Returns", "Returns within 30 days")],
    faqs: [{ ...item("faq", "faq", "Unused", "Unused"), question: "What services do you offer?", answer: "Consulting and support." }],
    restrictions: [{ id: "rule", type: "behavior_rule", instruction: "Be accurate.", relatedEntityIds: [], relatedAssertionIds: [], evidenceIds: [] }, { id: "claim", type: "prohibited_claim", instruction: "Do not promise outcomes.", relatedEntityIds: [], relatedAssertionIds: [], evidenceIds: [] }, { id: "conflict", type: "conflict_suppression", instruction: "Do not answer disputed price.", relatedEntityIds: [], relatedAssertionIds: [], evidenceIds: ["evidence-a"] }],
    relationships: [], sources: [{ id: "source-b", origin: "website", url: "https://b.test", label: null, capturedAt, crawlAttemptId: null }, { id: "source-a", origin: "manual_intake", url: "https://a.test", label: null, capturedAt, crawlAttemptId: null }],
    evidence: [{ id: "evidence-b", canonicalSourceId: "source-b", sourceUrl: "https://b.test", excerpt: "B excerpt", capturedAt }, { id: "evidence-a", canonicalSourceId: "source-a", sourceUrl: "https://a.test", excerpt: "A excerpt", capturedAt }], missingInformation: [{ id: "missing", topic: "Hours", reason: "Unknown", suggestedFollowUpQuestion: "What are your hours?", relatedEntityTypes: [], relatedEntityIds: [], relatedAssertionIds: [], resolved: false }],
  };
}

test("maps services, pricing, policies, FAQs, assistant configuration, sources, and supported restrictions", () => {
  const adapted = buildLegacyKnowledgePackFromAssistantProjection(projection());
  assert.deepEqual(adapted.facts.map((fact) => [fact.id, fact.category, fact.title, fact.content]), [["policy", "policy", "Returns", "Returns within 30 days"], ["pricing", "pricing", "Pricing", "Plans start at $10"], ["service-a", "service", "Consulting", "We provide consulting"], ["service-z", "service", "Support", "We provide support"]]);
  assert.deepEqual(adapted.faq[0].sourceEntryIds, ["source-a", "source-b"]);
  assert.equal(adapted.facts[2].sourceEntryId, "source-a"); assert.equal(adapted.facts[2].sourceExcerpt, "A excerpt"); assert.equal(adapted.facts[2].sourceUrl, "https://a.test");
  assert.deepEqual([adapted.assistantName, adapted.assistantPurpose, adapted.assistantTone, adapted.primaryAudience], ["Ava", "Help visitors", "warm", "Owners"]);
  assert.deepEqual(adapted.behaviorRules.map((item) => item.id), ["rule"]); assert.deepEqual(adapted.prohibitedClaims.map((item) => item.id), ["claim"]);
  assert.equal(adapted.facts.some((item) => item.id === "conflict" || item.id === "missing"), false); assert.equal(adapted.builtAt, "");
});

test("is deterministic, stable, and does not mutate input", () => {
  const input = projection(); const before = structuredClone(input); const reordered = structuredClone(input);
  reordered.services.reverse(); reordered.sources.reverse(); reordered.evidence.reverse(); reordered.faqs[0].sourceIds.reverse();
  const adapted = buildLegacyKnowledgePackFromAssistantProjection(input);
  assert.deepEqual(input, before); assert.deepEqual(adapted, buildLegacyKnowledgePackFromAssistantProjection(reordered));
  assert.equal(adapted.facts[2].id, "service-a"); assert.equal(JSON.stringify(adapted).includes(capturedAt), false);
});

test("does not invent a business name for unresolved identity", () => {
  const input = projection(); input.identity = { ...input.identity, status: "ambiguous", businessName: null };
  assert.equal(buildLegacyKnowledgePackFromAssistantProjection(input).assistantName, "Ava");
});

test("throws narrow errors for corrupt required data", () => {
  const invalidProject = projection(); invalidProject.projectId = "";
  assert.throws(() => buildLegacyKnowledgePackFromAssistantProjection(invalidProject), (error: unknown) => error instanceof AssistantProjectionLegacyAdapterError && error.code === "assistant_projection_legacy_adapter_invalid_project_id");
  const invalidFact = projection(); invalidFact.services[0].title = "";
  assert.throws(() => buildLegacyKnowledgePackFromAssistantProjection(invalidFact), (error: unknown) => error instanceof AssistantProjectionLegacyAdapterError && error.code === "assistant_projection_legacy_adapter_invalid_fact");
  const invalidFaq = projection(); invalidFaq.faqs[0].answer = "";
  assert.throws(() => buildLegacyKnowledgePackFromAssistantProjection(invalidFaq), (error: unknown) => error instanceof AssistantProjectionLegacyAdapterError && error.code === "assistant_projection_legacy_adapter_invalid_faq");
});

test("is accepted directly by retrieval and prompt construction", () => {
  const adapted = buildLegacyKnowledgePackFromAssistantProjection(projection());
  const message = "What services do you offer?";
  const retrieved = retrieveKnowledge({ knowledge: adapted, message });
  assert.doesNotThrow(() => buildSystemPrompt(adapted, retrieved, classifyResponseDepth(message)));
});
