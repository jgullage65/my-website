import assert from "node:assert/strict";
import test from "node:test";
import { buildSystemPrompt, classifyResponseDepth, retrieveKnowledge } from "@/app/lib/ai-engine/chat";
import { compareAssistantProjectionParity } from "@/app/lib/ai-engine/assistant-projection/parity";
import { recordAssistantProjectionParity } from "@/app/lib/ai-engine/assistant-projection/parityTelemetry";

const legacy = {
  sessionId: "project-1", assistantName: "Ava", assistantPurpose: "Help", assistantTone: "warm", primaryAudience: null, builtAt: "", version: 7,
  behaviorRules: [], prohibitedClaims: [], faq: [],
  facts: [{ id: "trusted-fact", category: "service" as const, title: "Trusted planning", content: "Trusted Knowledge only", confidence: "high" as const, confidenceScore: .9, sourceEntryId: "trusted-source", sourceExcerpt: "Trusted excerpt", sourceType: "manual_intake" as const, sourceUrl: null, tags: [], provenance: { classification: "manual_intake" as const, predecessorClassification: null, originalClassification: null, correctedByClerkUserId: null, correctedByDisplayName: null, correctedByEmail: null, correctedAt: null }, reviewState: "approved" as const, governanceRevision: 1 }],
};

const canonical = {
  projectId: "project-1", businessMemoryFingerprint: "business_memory_abcdef0123456789abcdef01", projectionVersion: 1 as const, schemaVersion: 1 as const,
  identity: { status: "missing" as const, canonicalEntityId: null, businessName: null, aliases: [], mergedEntityIds: [], redirectedEntityIds: [], contactEntityIds: [] },
  assistant: { name: "Ava", purpose: "Help", tone: "warm", responseStyle: "brief", primaryAudience: null, escalationInstructions: [] },
  services: [{ id: "canonical-fact", entityId: "entity", assertionId: "assertion", entityType: "service" as const, title: "Canonical planning", value: "CANONICAL_SECRET", aliases: [], tags: [], confidence: { level: "high" as const, score: .9 }, authority: "confirmed" as const, reviewState: "approved" as const, evidenceIds: [], sourceIds: [] }],
  pricing: [], policies: [], faqs: [], restrictions: [], relationships: [], sources: [], evidence: [], missingInformation: [],
};

function dependencies(overrides: Record<string, unknown> = {}) {
  const client = { releaseCalls: 0, release() { this.releaseCalls++; } };
  return {
    client,
    dependencies: {
      connect: async () => client,
      getPersisted: async () => ({ projection: canonical }),
      compare: compareAssistantProjectionParity,
      upsert: async () => undefined,
      ...overrides,
    } as never,
  };
}

test("successful parity comparison persists the latest report and releases its client", async () => {
  const writes: unknown[] = [];
  const { client, dependencies: injected } = dependencies({ upsert: async (_client: unknown, report: unknown) => { writes.push(report); } });
  await recordAssistantProjectionParity("project-1", legacy, injected);
  assert.equal(writes.length, 1);
  assert.equal((writes[0] as { projectId: string; status: string }).projectId, "project-1");
  assert.equal((writes[0] as { status: string }).status, "MAJOR_DIFFERENCE");
  assert.equal(client.releaseCalls, 1);
});

test("unavailable canonical projection records COMPARISON_FAILURE", async () => {
  const writes: Array<{ status: string; failureDetails: { error: string } }> = [];
  const { dependencies: injected } = dependencies({ getPersisted: async () => null, upsert: async (_client: unknown, report: { status: string; failureDetails: { error: string } }) => { writes.push(report); } });
  await recordAssistantProjectionParity("project-1", legacy, injected);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].status, "COMPARISON_FAILURE");
  assert.equal(writes[0].failureDetails.error, "assistant_projection_unavailable");
});

test("comparison and persistence failures settle without blocking the legacy result", async () => {
  const comparison = dependencies({ compare: () => { throw new Error("comparison_failed"); } });
  await assert.doesNotReject(recordAssistantProjectionParity("project-1", legacy, comparison.dependencies));
  const persistence = dependencies({ upsert: async () => { throw new Error("write_failed"); } });
  await assert.doesNotReject(recordAssistantProjectionParity("project-1", legacy, persistence.dependencies));
});

test("legacy Trusted Knowledge alone supplies retrieval, prompt, and citations", () => {
  const retrieved = retrieveKnowledge({ knowledge: legacy, message: "planning" });
  const prompt = buildSystemPrompt(legacy, retrieved, classifyResponseDepth("planning"));
  assert.deepEqual(retrieved.facts, ["Trusted planning: Trusted Knowledge only"]);
  assert.match(prompt, /Trusted Knowledge only/);
  assert.doesNotMatch(prompt, /CANONICAL_SECRET/);
  assert.deepEqual(retrieved.facts.concat(retrieved.faq), ["Trusted planning: Trusted Knowledge only"]);
});
