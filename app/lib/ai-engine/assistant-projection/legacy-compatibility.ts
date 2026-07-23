/**
 * TEMPORARY 8C COMPATIBILITY ADAPTER.
 *
 * Converts AssistantProjection into the legacy KnowledgePack shape currently
 * consumed by AI Builder demo chat.
 *
 * Remove after the demo chat runtime reads AssistantProjection natively.
 * This module must not become a second canonical knowledge model.
 */

import type { KnowledgeFact, KnowledgeFaq, KnowledgePack, KnowledgeProvenance } from "../knowledge/contracts";
import type { AssistantProjection, AssistantProjectionEvidence, AssistantProjectionRestriction, AssistantProjectionSource, AssistantProjectionTextKnowledgeItem } from "./contracts";

export const ASSISTANT_PROJECTION_LEGACY_ADAPTER_TEMPORARY = true as const;

export class AssistantProjectionLegacyAdapterError extends Error {
  readonly code: "assistant_projection_legacy_adapter_invalid_project_id" | "assistant_projection_legacy_adapter_invalid_fact" | "assistant_projection_legacy_adapter_invalid_faq";

  constructor(code: AssistantProjectionLegacyAdapterError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

const EMPTY_PROVENANCE: KnowledgeProvenance = {
  classification: null, predecessorClassification: null, originalClassification: null,
  correctedByClerkUserId: null, correctedByDisplayName: null, correctedByEmail: null, correctedAt: null,
};

function fail(code: AssistantProjectionLegacyAdapterError["code"], message: string): never {
  throw new AssistantProjectionLegacyAdapterError(code, message);
}

function stableIds(ids: string[]): string[] {
  return [...ids].sort((left, right) => left.localeCompare(right));
}

function sourceType(source: AssistantProjectionSource | undefined): string {
  // Legacy KnowledgeFact accepts these values at runtime; unsupported modern origins
  // have no lossless legacy equivalent and are represented as generated_qa metadata.
  return source?.origin === "website" || source?.origin === "manual_intake" || source?.origin === "generated_qa" || source?.origin === "user_edit"
    ? source.origin
    : "generated_qa";
}

function firstEvidence(item: AssistantProjectionTextKnowledgeItem, evidenceById: Map<string, AssistantProjectionEvidence>): AssistantProjectionEvidence | undefined {
  return stableIds(item.evidenceIds).map((id) => evidenceById.get(id)).find((evidence) => evidence !== undefined);
}

function factFromItem(item: AssistantProjectionTextKnowledgeItem, category: "service" | "pricing" | "policy", sourcesById: Map<string, AssistantProjectionSource>, evidenceById: Map<string, AssistantProjectionEvidence>): KnowledgeFact {
  if (!item || typeof item.id !== "string" || !item.id || typeof item.title !== "string" || !item.title || typeof item.value !== "string" || !item.value) {
    return fail("assistant_projection_legacy_adapter_invalid_fact", "Assistant Projection fact is invalid.");
  }
  const sourceId = stableIds(item.sourceIds)[0] ?? "";
  const source = sourcesById.get(sourceId);
  const evidence = firstEvidence(item, evidenceById);
  return {
    id: item.id, category, title: item.title, content: item.value,
    confidence: item.confidence.level, confidenceScore: item.confidence.score,
    sourceEntryId: sourceId, sourceExcerpt: evidence?.excerpt ?? "", sourceType: sourceType(source),
    sourceUrl: evidence?.sourceUrl ?? source?.url ?? null, tags: stableIds(item.tags),
    provenance: { ...EMPTY_PROVENANCE }, reviewState: item.reviewState, governanceRevision: 0,
  };
}

function factFromRestriction(item: AssistantProjectionRestriction, category: "behavior_rule" | "prohibited_claim"): KnowledgeFact {
  if (!item || typeof item.id !== "string" || !item.id || typeof item.instruction !== "string" || !item.instruction) {
    return fail("assistant_projection_legacy_adapter_invalid_fact", "Assistant Projection restriction is invalid.");
  }
  return {
    id: item.id, category, title: category === "behavior_rule" ? "Behavior rule" : "Prohibited claim", content: item.instruction,
    confidence: "medium", confidenceScore: 0, sourceEntryId: "", sourceExcerpt: "", sourceType: "generated_qa", sourceUrl: null, tags: [],
    provenance: { ...EMPTY_PROVENANCE }, reviewState: "approved", governanceRevision: 0,
  };
}

/** Builds the existing demo-chat contract without changing the chat runtime. */
export function buildLegacyKnowledgePackFromAssistantProjection(projection: AssistantProjection): KnowledgePack {
  if (!projection || typeof projection.projectId !== "string" || !projection.projectId.trim()) {
    return fail("assistant_projection_legacy_adapter_invalid_project_id", "Assistant Projection project ID is invalid.");
  }
  const sourcesById = new Map([...projection.sources].sort((a, b) => a.id.localeCompare(b.id)).map((source) => [source.id, source]));
  const evidenceById = new Map([...projection.evidence].sort((a, b) => a.id.localeCompare(b.id)).map((evidence) => [evidence.id, evidence]));
  const facts = [
    ...projection.services.map((item) => factFromItem(item, "service", sourcesById, evidenceById)),
    ...projection.pricing.map((item) => factFromItem(item, "pricing", sourcesById, evidenceById)),
    ...projection.policies.map((item) => factFromItem(item, "policy", sourcesById, evidenceById)),
  ].sort((a, b) => a.id.localeCompare(b.id));
  const faq = projection.faqs.map((item): KnowledgeFaq => {
    if (!item || typeof item.id !== "string" || !item.id || typeof item.question !== "string" || !item.question || typeof item.answer !== "string" || !item.answer) {
      return fail("assistant_projection_legacy_adapter_invalid_faq", "Assistant Projection FAQ is invalid.");
    }
    return { id: item.id, question: item.question, answer: item.answer, confidence: item.confidence.level, confidenceScore: item.confidence.score, sourceEntryIds: stableIds(item.sourceIds), provenance: { ...EMPTY_PROVENANCE }, reviewState: item.reviewState, governanceRevision: 0 };
  }).sort((a, b) => a.id.localeCompare(b.id));
  const restrictions = [...projection.restrictions].sort((a, b) => a.id.localeCompare(b.id));
  const behaviorRules: KnowledgeFact[] = [];
  const prohibitedClaims: KnowledgeFact[] = [];
  for (const restriction of restrictions) {
    if (restriction.type === "behavior_rule") behaviorRules.push(factFromRestriction(restriction, "behavior_rule"));
    if (restriction.type === "prohibited_claim") prohibitedClaims.push(factFromRestriction(restriction, "prohibited_claim"));
  }

  // conflict_suppression has no exact legacy guardrail representation, so it is omitted.
  // missingInformation, relationships, source/evidence records, responseStyle, escalationInstructions,
  // and identity aliases likewise have no matching KnowledgePack fields and are deliberately omitted.
  // KnowledgePack has no business-name field; unresolved identity therefore cannot invent one.
  return { sessionId: projection.projectId, assistantName: projection.assistant.name, assistantPurpose: projection.assistant.purpose, assistantTone: projection.assistant.tone, primaryAudience: projection.assistant.primaryAudience, facts, faq, behaviorRules, prohibitedClaims, builtAt: "", version: 1 };
}
