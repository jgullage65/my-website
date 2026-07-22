import type { BusinessAssertion, BusinessEntity, BusinessMemory } from "../business-memory/contracts";
import {
  ASSISTANT_PROJECTION_SCHEMA_VERSION,
  ASSISTANT_PROJECTION_VERSION,
  type AssistantProjection,
  type AssistantProjectionKnowledgeItem,
} from "./contracts";

const compare = (left: string, right: string) => left.localeCompare(right);
const sortedUnique = (values: readonly string[]) => Array.from(new Set(values)).sort(compare);
const byId = <T extends { id: string }>(values: readonly T[]) => [...values].sort((a, b) => compare(a.id, b.id));
type SupportedAssertion = BusinessAssertion & { reviewState: "approved" | "corrected" };
const supportedAssertion = (assertion: BusinessAssertion): assertion is SupportedAssertion => assertion.reviewState === "approved" || assertion.reviewState === "corrected";

/**
 * Maps canonical Business Memory into the stable runtime DTO. This is deliberately
 * pure: it neither reads persistence rows nor creates timestamps or identifiers.
 */
export function buildAssistantProjection(memory: BusinessMemory): AssistantProjection {
  const redirects = new Map<string, string>();
  for (const merge of memory.entityMerges ?? []) for (const mergedId of merge.mergedEntityIds) redirects.set(mergedId, merge.canonicalEntityId);
  const canonicalEntityId = (id: string): string => {
    const seen = new Set<string>(); let current = id;
    while (redirects.has(current) && !seen.has(current)) { seen.add(current); current = redirects.get(current)!; }
    return current;
  };
  const entities = new Map(memory.entities.map((entity) => [entity.id, entity]));
  const assertions = new Map(memory.assertions.map((assertion) => [assertion.id, assertion]));
  const evidenceIds = new Set(memory.evidence.map((item) => item.id));
  const itemFor = (assertion: BusinessAssertion): AssistantProjectionKnowledgeItem | null => {
    const entity = entities.get(assertion.entityId);
    if (!entity || !supportedAssertion(assertion)) return null;
    return {
      id: assertion.id, entityId: canonicalEntityId(entity.id), assertionId: assertion.id, entityType: entity.type,
      title: entity.name, value: assertion.value, aliases: sortedUnique(entity.aliases), tags: sortedUnique(assertion.tags),
      confidence: { ...assertion.confidence }, authority: assertion.authority, reviewState: assertion.reviewState,
      evidenceIds: sortedUnique(assertion.evidenceIds.filter((id) => evidenceIds.has(id))), sourceIds: sortedUnique(assertion.sourceIds),
    };
  };
  const supportedItems = memory.assertions.map(itemFor).filter((item): item is AssistantProjectionKnowledgeItem => item !== null);
  const ofType = (type: BusinessEntity["type"]) => byId(supportedItems.filter((item) => item.entityType === type));
  const businessEntities = byId(memory.entities.filter((entity) => entity.type === "business"));
  const identityEntity = businessEntities[0] ?? null;
  const associatedMerges = (memory.entityMerges ?? []).filter((merge) => merge.canonicalEntityId === identityEntity?.id);
  const activeRelationships = memory.relationships.filter((relationship) => {
    const from = assertions.get(relationship.fromAssertionId); const to = assertions.get(relationship.toAssertionId);
    return relationship.reviewState !== "archived" && !!from && !!to && supportedAssertion(from) && supportedAssertion(to);
  });
  const restrictions = Array.from(new Map([
    ...(memory.assistant.prohibitedClaims ?? []).map((instruction) => ({ id: `assistant:prohibited_claim:${encodeURIComponent(instruction)}`, type: "prohibited_claim" as const, instruction, relatedEntityIds: [], relatedAssertionIds: [], evidenceIds: [], active: true })),
    ...(memory.assistant.behaviorRules ?? []).map((instruction) => ({ id: `assistant:behavior_rule:${encodeURIComponent(instruction)}`, type: "behavior_rule" as const, instruction, relatedEntityIds: [], relatedAssertionIds: [], evidenceIds: [], active: true })),
    ...memory.conflicts.filter((conflict) => !conflict.resolved).map((conflict) => ({ id: conflict.id, type: "conflict_suppression" as const, instruction: conflict.suggestedClarificationQuestion, relatedEntityIds: sortedUnique(conflict.relatedEntityIds.map(canonicalEntityId)), relatedAssertionIds: sortedUnique(conflict.relatedAssertionIds), evidenceIds: sortedUnique(conflict.evidenceIds.filter((id) => evidenceIds.has(id))), active: true })),
    ...memory.missingInformation.filter((item) => !item.resolved).map((item) => ({ id: item.id, type: "missing_information" as const, instruction: item.suggestedQuestion, relatedEntityIds: sortedUnique(item.relatedEntityIds.map(canonicalEntityId)), relatedAssertionIds: sortedUnique(item.relatedAssertionIds), evidenceIds: [], active: true })),
  ].map((restriction) => [restriction.id, restriction] as const)).values());
  return {
    projectId: memory.projectId, businessMemoryVersion: memory.updatedAt,
    projectionVersion: ASSISTANT_PROJECTION_VERSION, schemaVersion: ASSISTANT_PROJECTION_SCHEMA_VERSION,
    identity: {
      canonicalEntityId: identityEntity ? canonicalEntityId(identityEntity.id) : null, businessName: identityEntity?.name ?? null,
      aliases: sortedUnique([...(identityEntity?.aliases ?? []), ...associatedMerges.flatMap((merge) => merge.approvedAliases)]),
      identityKeys: [], mergedEntityIds: sortedUnique(associatedMerges.flatMap((merge) => merge.mergedEntityIds)),
      redirectedEntityIds: sortedUnique(associatedMerges.flatMap((merge) => merge.mergedEntityIds)),
      contactEntityIds: sortedUnique(memory.entities.filter((entity) => entity.type === "contact_method").map((entity) => canonicalEntityId(entity.id))),
    },
    assistant: { name: memory.assistant.name, purpose: memory.assistant.purpose, tone: memory.assistant.tone, responseStyle: memory.assistant.responseStyle, primaryAudience: memory.assistant.primaryAudience, escalationInstructions: sortedUnique(memory.assistant.escalationInstructions) },
    services: ofType("service"), pricing: ofType("pricing_concept"), policies: ofType("policy"),
    faqs: byId(ofType("faq").map((item) => ({ ...item, question: item.title, answer: item.value }))),
    restrictions: byId(restrictions),
    relationships: byId(activeRelationships.map((relationship) => ({ id: relationship.id, type: relationship.type, sourceEntityId: canonicalEntityId(relationship.fromEntityId), targetEntityId: canonicalEntityId(relationship.toEntityId), sourceAssertionId: relationship.fromAssertionId, targetAssertionId: relationship.toAssertionId, sourceEntryIds: sortedUnique(relationship.sourceEntryIds), confidence: null, evidenceIds: sortedUnique([...(assertions.get(relationship.fromAssertionId)?.evidenceIds ?? []), ...(assertions.get(relationship.toAssertionId)?.evidenceIds ?? [])].filter((id) => evidenceIds.has(id))), active: true, resolved: false }))),
    evidence: byId(memory.evidence.map((item) => { const source = memory.sources.find((candidate) => candidate.id === item.sourceId); return { id: item.id, canonicalSourceId: item.sourceId, sourceType: source?.origin ?? null, sourceUrl: item.url ?? source?.url ?? null, excerpt: item.excerpt, capturedAt: item.capturedAt, crawlAttemptId: source?.crawlAttemptId ?? null, provenanceClassification: source?.origin ?? null }; })),
    missingInformation: byId(memory.missingInformation.map((item) => ({ id: item.id, topic: item.topic, reason: item.reason, suggestedFollowUpQuestion: item.suggestedQuestion, relatedEntityIds: sortedUnique(item.relatedEntityIds.map(canonicalEntityId)), relatedAssertionIds: sortedUnique(item.relatedAssertionIds), resolved: item.resolved }))),
  };
}
