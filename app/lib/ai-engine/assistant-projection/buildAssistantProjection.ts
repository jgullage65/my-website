import { createHash } from "node:crypto";
import type { BusinessAssertion, BusinessEntity, BusinessMemory, BusinessRelationship } from "../business-memory/contracts";
import {
  ASSISTANT_PROJECTION_SCHEMA_VERSION,
  ASSISTANT_PROJECTION_VERSION,
  type AssistantProjection,
  type AssistantProjectionFaq,
  type AssistantProjectionPolicy,
  type AssistantProjectionPricing,
  type AssistantProjectionRestriction,
  type AssistantProjectionService,
  type AssistantProjectionTextKnowledgeItem,
} from "./contracts";

const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
const normalizedRule = (value: string) => normalize(value).toLowerCase();
const sortedUnique = (values: readonly string[]) => Array.from(new Set(values)).sort(compare);
const byId = <T extends { id: string }>(values: readonly T[]) => [...values].sort((a, b) => compare(a.id, b.id));
const stableId = (prefix: string, content: string) => `${prefix}_${createHash("sha256").update(content).digest("hex").slice(0, 24)}`;
type SupportedAssertion = BusinessAssertion & { reviewState: "approved" | "corrected" };
const supportedAssertion = (assertion: BusinessAssertion): assertion is SupportedAssertion => assertion.reviewState === "approved" || assertion.reviewState === "corrected";
const supportedRelationship = (relationship: BusinessRelationship) => relationship.reviewState === "approved" || relationship.reviewState === "corrected";

const setLikeArrayFields = new Set([
  "aliases", "tags", "assertionIds", "sourceIds", "evidenceIds", "escalationInstructions", "behaviorRules", "prohibitedClaims",
  "relatedEntityIds", "relatedAssertionIds", "relatedEntityTypes", "sourceEntryIds", "mergedEntityIds", "approvedAliases", "conflictingStatements",
  "entities", "assertions", "relationships", "sources", "evidence", "conflicts", "missingInformation", "entityMerges",
]);
const operationalTimestampFields = new Set(["createdAt", "updatedAt", "importedAt", "mergedAt"]);

/** Canonical JSON for Business Memory fingerprints; only named operational timestamps are omitted. */
function canonicalize(value: unknown, fieldName?: string): unknown {
  if (Array.isArray(value)) {
    const items = value.map((item) => canonicalize(item));
    return fieldName && setLikeArrayFields.has(fieldName)
      ? Array.from(new Map(items.map((item) => [JSON.stringify(item), item])).entries()).sort(([left], [right]) => compare(left, right)).map(([, item]) => item)
      : items;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !operationalTimestampFields.has(key))
      .sort(([left], [right]) => compare(left, right))
      .map(([key, item]) => [key, canonicalize(item, key)]));
  }
  return value;
}

/** Stable serialization sorts all object keys and known set-like arrays recursively. */
function businessMemoryFingerprint(memory: BusinessMemory): string {
  return stableId("business_memory", JSON.stringify(canonicalize(memory)));
}

/** Maps canonical Business Memory into the stable runtime DTO without persistence I/O. */
export function buildAssistantProjection(memory: BusinessMemory): AssistantProjection {
  const entities = new Map(memory.entities.map((entity) => [entity.id, entity]));
  const assertions = new Map(memory.assertions.map((assertion) => [assertion.id, assertion]));
  const sources = new Map(memory.sources.map((source) => [source.id, source]));
  const evidence = new Map(memory.evidence.filter((item) => sources.has(item.sourceId)).map((item) => [item.id, item]));
  const redirects = new Map<string, string>();
  for (const merge of memory.entityMerges ?? []) for (const mergedId of merge.mergedEntityIds) redirects.set(mergedId, merge.canonicalEntityId);
  const canonicalEntityId = (id: string): string | null => {
    const seen = new Set<string>(); let current = id;
    while (redirects.has(current)) { if (seen.has(current)) return null; seen.add(current); current = redirects.get(current)!; }
    return entities.has(current) ? current : null;
  };
  const canonicalBusinessIds = sortedUnique(memory.entities.filter((entity) => entity.type === "business").map((entity) => canonicalEntityId(entity.id)).filter((id): id is string => id !== null && entities.get(id)?.type === "business"));
  const identityEntity = canonicalBusinessIds.length === 1 ? entities.get(canonicalBusinessIds[0])! : null;
  const itemFor = (assertion: BusinessAssertion): AssistantProjectionTextKnowledgeItem | null => {
    const entity = entities.get(assertion.entityId); const entityId = canonicalEntityId(assertion.entityId);
    if (!entity || !entityId || !supportedAssertion(assertion)) return null;
    return { id: assertion.id, entityId, assertionId: assertion.id, entityType: entity.type, title: entity.name, value: assertion.value,
      aliases: sortedUnique(entity.aliases), tags: sortedUnique(assertion.tags), confidence: { ...assertion.confidence }, authority: assertion.authority, reviewState: assertion.reviewState,
      evidenceIds: sortedUnique(assertion.evidenceIds.filter((id) => evidence.has(id))), sourceIds: sortedUnique(assertion.sourceIds.filter((id) => sources.has(id))) };
  };
  // Business Memory intentionally preserves independently addressable duplicate assertions, including after entity redirects; 8A projects each approved/corrected assertion rather than inventing reconciliation.
  const items = memory.assertions.map(itemFor).filter((item): item is AssistantProjectionTextKnowledgeItem => item !== null);
  const ofType = (type: BusinessEntity["type"]) => byId(items.filter((item) => item.entityType === type));
  const relationships = byId(memory.relationships.filter((relationship) => {
    const from = assertions.get(relationship.fromAssertionId), to = assertions.get(relationship.toAssertionId);
    return supportedRelationship(relationship) && !!from && !!to && supportedAssertion(from) && supportedAssertion(to) && canonicalEntityId(relationship.fromEntityId) !== null && canonicalEntityId(relationship.toEntityId) !== null;
  }).map((relationship) => ({ id: relationship.id, type: relationship.type, sourceEntityId: canonicalEntityId(relationship.fromEntityId)!, targetEntityId: canonicalEntityId(relationship.toEntityId)!, sourceAssertionId: relationship.fromAssertionId, targetAssertionId: relationship.toAssertionId, sourceEntryIds: sortedUnique(relationship.sourceEntryIds) })));
  const ruleRestrictions = (type: "prohibited_claim" | "behavior_rule", values: readonly string[]): AssistantProjectionRestriction[] => Array.from(values.reduce((rules, value) => {
    const key = normalizedRule(value), display = normalize(value), existing = rules.get(key);
    if (!existing || compare(display, existing) < 0) rules.set(key, display);
    return rules;
  }, new Map<string, string>())).map(([key, instruction]) => ({ id: stableId(`assistant_${type}`, key), type, instruction, relatedEntityIds: [], relatedAssertionIds: [], evidenceIds: [] }));
  // Conflicting assertions remain available for provenance; runtime routing must include the related conflict restriction whenever selecting those assertion IDs. Actual runtime routing is outside 8A.
  const conflictRestrictions = memory.conflicts.filter((conflict) => !conflict.resolved).map((conflict) => ({
    id: conflict.id, type: "conflict_suppression" as const, instruction: conflict.suggestedClarificationQuestion,
    relatedEntityIds: sortedUnique(conflict.relatedEntityIds.map(canonicalEntityId).filter((id): id is string => id !== null)),
    relatedAssertionIds: sortedUnique(conflict.relatedAssertionIds.filter((id) => assertions.has(id))), evidenceIds: sortedUnique(conflict.evidenceIds.filter((id) => evidence.has(id))),
  }));
  const restrictions = byId([...ruleRestrictions("prohibited_claim", memory.assistant.prohibitedClaims ?? []), ...ruleRestrictions("behavior_rule", memory.assistant.behaviorRules ?? []), ...conflictRestrictions]);
  const associatedMerges = identityEntity ? (memory.entityMerges ?? []).filter((merge) => canonicalEntityId(merge.canonicalEntityId) === identityEntity.id && merge.mergedEntityIds.every((id) => entities.get(id)?.type === "business")) : [];
  const contactEntityIds = identityEntity ? sortedUnique(relationships.flatMap((relationship) => {
    const source = entities.get(relationship.sourceEntityId), target = entities.get(relationship.targetEntityId);
    if (relationship.sourceEntityId === identityEntity.id && target?.type === "contact_method") return [relationship.targetEntityId];
    if (relationship.targetEntityId === identityEntity.id && source?.type === "contact_method") return [relationship.sourceEntityId];
    return [];
  })) : [];
  return { projectId: memory.projectId, businessMemoryFingerprint: businessMemoryFingerprint(memory), projectionVersion: ASSISTANT_PROJECTION_VERSION, schemaVersion: ASSISTANT_PROJECTION_SCHEMA_VERSION,
    identity: { status: identityEntity ? "resolved" : canonicalBusinessIds.length === 0 ? "missing" : "ambiguous", canonicalEntityId: identityEntity?.id ?? null, businessName: identityEntity?.name ?? null, aliases: sortedUnique([...(identityEntity?.aliases ?? []), ...associatedMerges.flatMap((merge) => merge.approvedAliases)]), mergedEntityIds: sortedUnique(associatedMerges.flatMap((merge) => merge.mergedEntityIds)), redirectedEntityIds: sortedUnique(associatedMerges.flatMap((merge) => merge.mergedEntityIds)), contactEntityIds },
    assistant: { name: memory.assistant.name, purpose: memory.assistant.purpose, tone: memory.assistant.tone, responseStyle: memory.assistant.responseStyle, primaryAudience: memory.assistant.primaryAudience, escalationInstructions: sortedUnique(memory.assistant.escalationInstructions) },
    services: ofType("service") as AssistantProjectionService[], pricing: ofType("pricing_concept") as AssistantProjectionPricing[], policies: ofType("policy") as AssistantProjectionPolicy[], faqs: byId(ofType("faq").map((item) => ({ ...item, question: item.title, answer: item.value }))) as AssistantProjectionFaq[], restrictions, relationships,
    sources: byId(memory.sources.map((source) => ({ id: source.id, origin: source.origin, url: source.url, label: source.label, capturedAt: source.capturedAt, crawlAttemptId: source.crawlAttemptId }))),
    evidence: byId(Array.from(evidence.values()).map((item) => ({ id: item.id, canonicalSourceId: item.sourceId, sourceUrl: item.url, excerpt: item.excerpt, capturedAt: item.capturedAt }))),
    missingInformation: byId(memory.missingInformation.map((item) => ({ id: item.id, topic: item.topic, reason: item.reason, suggestedFollowUpQuestion: item.suggestedQuestion, relatedEntityTypes: [...item.relatedEntityTypes].sort(compare), relatedEntityIds: sortedUnique(item.relatedEntityIds.map(canonicalEntityId).filter((id): id is string => id !== null)), relatedAssertionIds: sortedUnique(item.relatedAssertionIds.filter((id) => assertions.has(id))), resolved: item.resolved }))),
  };
}
