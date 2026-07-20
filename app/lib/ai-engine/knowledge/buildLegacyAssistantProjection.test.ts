import assert from "node:assert/strict";
import test from "node:test";
import type { AiBuilderSession, BusinessContextEntry, GeneratedFaqEntry } from "../contracts";
import { buildSystemPrompt } from "../chat/buildSystemPrompt";
import { retrieveKnowledge } from "../chat/retrieveKnowledge";
import {
  LEGACY_ASSISTANT_PROJECTION_SOURCE,
  buildLegacyAssistantProjection,
} from "./buildLegacyAssistantProjection";

const now = "2026-07-20T12:00:00.000Z";

function context(status: BusinessContextEntry["status"], id: string = status): BusinessContextEntry {
  return {
    id, sessionId: "owned-project", category: "service", title: `${status} service`, content: `${status} business fact`, confidence: "high", confidenceScore: 0.9, status,
    source: { intakeBlockId: "intake", excerpt: "source", sourceType: "manual_intake", sourceUrl: null },
    metadata: { generated: false, userEdited: false, conflictingEntryIds: [], tags: [] }, createdAt: now, updatedAt: now,
  };
}

function faq(status: GeneratedFaqEntry["status"]): GeneratedFaqEntry {
  return { id: `faq-${status}`, sessionId: "owned-project", question: `${status} question`, answer: `${status} answer`, confidence: "medium", confidenceScore: 0.7, sourceEntryIds: [], status, createdAt: now, updatedAt: now };
}

function session(): AiBuilderSession {
  return {
    id: "owned-project", status: "ready", intakeBlocks: [],
    assistantConfiguration: { name: "Persisted Assistant", purpose: "Persisted purpose", tone: "Calm", responseStyle: "Clear", primaryAudience: null, escalationInstructions: [] },
    contextEntries: [context("approved"), context("corrected"), context("proposed"), context("archived"), context("approved", "rule"), context("approved", "prohibited")],
    faqEntries: [faq("approved"), faq("corrected"), faq("proposed"), faq("archived")], conflicts: [], missingInformation: [],
    contextCounts: { total: 0, approved: 0, proposed: 0, archived: 0, byCategory: {} }, buildProgress: [], createdAt: now, updatedAt: now, expiresAt: null,
  };
}

test("projects only persisted approved and corrected facts and FAQs", () => {
  const persisted = session();
  persisted.contextEntries[4] = { ...persisted.contextEntries[4], category: "behavior_rule", title: "Be concise", content: "Use concise answers." };
  persisted.contextEntries[5] = { ...persisted.contextEntries[5], category: "prohibited_claim", title: "No guarantees", content: "Do not promise outcomes." };
  const projection = buildLegacyAssistantProjection(persisted);

  assert.equal(projection.source, LEGACY_ASSISTANT_PROJECTION_SOURCE);
  assert.deepEqual(projection.knowledge.facts.map((item) => item.title).sort(), ["approved service", "corrected service"]);
  assert.deepEqual(projection.knowledge.faq.map((item) => item.question).sort(), ["approved question", "corrected question"]);
  assert.equal(projection.knowledge.assistantName, "Persisted Assistant");
  assert.equal(projection.knowledge.assistantTone, "Calm");
  assert.equal(projection.knowledge.behaviorRules[0].content, "Use concise answers.");
  assert.equal(projection.knowledge.prohibitedClaims[0].content, "Do not promise outcomes.");
});

test("retrieval and prompt use the server projection, including unconditional policy", () => {
  const persisted = session();
  persisted.contextEntries = [context("approved", "persisted")];
  persisted.contextEntries.push({ ...context("approved", "rule"), category: "behavior_rule", title: "Be concise", content: "Use concise answers." });
  persisted.contextEntries.push({ ...context("approved", "prohibited"), category: "prohibited_claim", title: "No guarantees", content: "Do not promise outcomes." });
  const projection = buildLegacyAssistantProjection(persisted);
  const retrieved = retrieveKnowledge({ knowledge: projection.knowledge, message: "approved" });
  const prompt = buildSystemPrompt(projection.knowledge, retrieved);

  assert.deepEqual(retrieved.facts, ["approved service: approved business fact"]);
  assert.match(prompt, /Persisted Assistant/);
  assert.match(prompt, /Tone: Calm/);
  assert.match(prompt, /Use concise answers\./);
  assert.match(prompt, /Do not promise outcomes\./);
  assert.doesNotMatch(prompt, /client fake fact|Client Assistant|Chaotic/);
});

test("a project with only proposed or archived knowledge has no usable runtime facts", () => {
  const persisted = session();
  persisted.contextEntries = [context("proposed"), context("archived")];
  persisted.faqEntries = [faq("proposed"), faq("archived")];
  const projection = buildLegacyAssistantProjection(persisted);
  assert.equal(projection.knowledge.facts.length, 0);
  assert.equal(projection.knowledge.faq.length, 0);
});
