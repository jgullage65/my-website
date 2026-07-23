import assert from "node:assert/strict";
import test from "node:test";
import { createConversationMemory, normalizeConversationMemory } from "../memory/conversationMemory";
import { retrieveRelevantConversationMemory } from "./conversationMemoryRetrieval";
import { buildCombinedRuntimeContext } from "./combinedRuntimeContext";
import { retrieveStructuredCanonicalKnowledge } from "./structuredCanonicalRetrieval";
import { buildStructuredSystemPrompt } from "./buildStructuredSystemPrompt";

const projection = { projectId: "p", businessMemoryFingerprint: "business_memory_abcdef0123456789abcdef01", projectionVersion: 1 as const, schemaVersion: 1 as const, identity: { status: "missing" as const, canonicalEntityId: null, businessName: null, aliases: [], mergedEntityIds: [], redirectedEntityIds: [], contactEntityIds: [] }, assistant: { name: "Ava", purpose: "Help", tone: "warm", responseStyle: "brief", primaryAudience: null, escalationInstructions: [] }, services: [], products: [], pricing: [{ id: "price", entityId: "price", assertionId: "price", entityType: "pricing_concept" as const, title: "Website price", value: "$100", aliases: [], tags: ["website"], confidence: { level: "high" as const, score: 1 }, authority: "confirmed" as const, reviewState: "approved" as const, evidenceIds: [], sourceIds: [] }], policies: [], faqs: [], restrictions: [], relationships: [], sources: [], evidence: [], missingInformation: [] };
const memory = () => ({ ...createConversationMemory("t", "p"), primaryGoal: "Launch a website", currentSubject: "website pricing", userPreferences: [{ id: "pref", key: "format", value: "Prefer concise answers", scope: "current_thread" as const, sourceMessageId: "x", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }], conversationDetails: [{ id: "old", key: "remembered price", value: "Website price is $200", confidence: "medium" as const, sourceMessageId: "x", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }] });

test("conversation retrieval is relevant, deterministic, and bounded", () => {
 const value = { ...memory(), temporaryContext: Array.from({ length: 20 }, (_, i) => `website task ${i}`) };
 const first = retrieveRelevantConversationMemory(value, "website pricing"); const second = retrieveRelevantConversationMemory(value, "website pricing");
 assert.deepEqual(first.items, second.items); assert.ok(first.items.length <= 8); assert.ok(first.items.some(item => item.content.includes("website pricing"))); assert.ok(!first.items.some(item => item.content.includes("concise")));
});

test("only valid owned memory becomes contextual context and cannot override business truth", () => {
 const retrieved = retrieveStructuredCanonicalKnowledge(projection, "website price");
 const context = buildCombinedRuntimeContext(retrieved, memory(), "website price");
 assert.equal(context.assistantProjection.retrieval, retrieved); assert.equal(context.conversationMemory.excludedConflict, true); assert.ok(!context.conversationMemory.items.some(item => item.content.includes("$200")));
 const prompt = buildStructuredSystemPrompt(projection, retrieved, { depth: "brief", intent: "general", reason: "brief" }, undefined, context);
 assert.match(prompt, /\$100/); assert.doesNotMatch(prompt, /\$200/); assert.match(prompt, /Never treat it as verified business truth/);
 const invalid = normalizeConversationMemory({ schemaVersion: 1, threadId: "other", projectId: "p" }, { threadId: "t", projectId: "p" }); assert.equal(invalid.invalid, true);
});

test("missing memory is not an authority fallback and retrieval does not mutate it", () => {
 const retrieved = retrieveStructuredCanonicalKnowledge(projection, "website price"); const before = JSON.stringify(memory());
 const context = buildCombinedRuntimeContext(retrieved, null, "website price");
 assert.equal(context.conversationMemory.available, false); assert.equal(JSON.stringify(memory()), before);
});
