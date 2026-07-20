import { createHash } from "node:crypto";
import type {
  AiBuilderSession,
  BusinessContextCategory,
  BusinessContextEntry,
  GeneratedFaqEntry,
} from "../contracts";
import {
  websiteFactIdentity,
  websiteFactFingerprint,
  type PersistedWebsiteKnowledge,
  type WebsiteKnowledgeFact,
} from "../knowledge/websiteKnowledge";
import { BUSINESS_MEMORY_SCHEMA_VERSION } from "./contracts";
import type {
  AssertionAuthority,
  BusinessAssertion,
  BusinessEntity,
  BusinessEntityType,
  BusinessMemory,
  BusinessRelationship,
  Confidence,
  EntityMergeContract,
  EvidenceRecord,
  KnowledgeSource,
  KnowledgeSourceOrigin,
  ReviewState,
} from "./contracts";

export type BuildBusinessMemoryInput = {
  session: AiBuilderSession;
  websiteKnowledge: PersistedWebsiteKnowledge | null | undefined;
  /** Future reviewed merge decisions. They are never inferred by this mapper. */
  entityMerges?: EntityMergeContract[];
};

type LegacyAssertion = {
  kind: "context" | "faq" | "website";
  legacyEntryId: string | null;
  identity: string;
  entityType: BusinessEntityType;
  name: string;
  alias: string;
  value: string;
  tags: string[];
  confidence: Confidence;
  reviewState: ReviewState;
  source: Omit<KnowledgeSource, "id">;
  authority: AssertionAuthority;
  evidence: Array<{ url: string | null; excerpt: string }>;
  createdAt: string;
  updatedAt: string;
  faqSourceEntryIds: string[];
};

function normalizeText(value: unknown): string { return String(value ?? "").replace(/\s+/g, " ").trim(); }
function normalizedIdentity(value: unknown): string { return normalizeText(value).toLowerCase(); }

/** A SHA-256 digest keeps existing normalized identity semantics while making IDs persistence-safe. */
function stableId(prefix: string, values: readonly string[]): string {
  const source = values.map(normalizedIdentity).join("\u0000");
  return `${prefix}_${createHash("sha256").update(source).digest("hex")}`;
}
function compare(left: string, right: string): number { return left < right ? -1 : left > right ? 1 : 0; }
function sortedUnique(values: readonly string[]): string[] { return Array.from(new Set(values.map(normalizeText).filter(Boolean))).sort(compare); }

/** The only context-entry origin mapping; authority is deliberately derived separately. */
function knowledgeSourceOrigin(entry: BusinessContextEntry): KnowledgeSourceOrigin {
  if (entry.source.sourceType === "user_edit") return "user_edit";
  if (entry.metadata.userEdited) return "user_edit";
  if (entry.source.sourceType === "website") return "website";
  if (entry.source.sourceType === "generated_qa") return "generated_qa";
  return "manual_intake";
}

function entityTypeForCategory(category: BusinessContextCategory): BusinessEntityType {
  const mapping: Record<BusinessContextCategory, BusinessEntityType> = {
    business_profile: "business", audience: "customer_segment", service: "service", pricing: "pricing_concept", policy: "policy", process: "process", differentiator: "differentiator", faq: "faq", behavior_rule: "other", prohibited_claim: "other",
  };
  return mapping[category];
}
function websiteEntityType(category: string): BusinessEntityType {
  const mapping: Record<string, BusinessEntityType> = { business_identity: "business", industry: "business", product: "product", service: "service", customer: "customer_segment", pricing: "pricing_concept", policy: "policy", process: "process", faq: "faq", differentiator: "differentiator", guarantee: "guarantee", location: "location", contact: "contact_method" };
  return mapping[category] ?? "other";
}
function confidenceScore(confidence: Confidence["level"]): number { return confidence === "high" ? 0.9 : confidence === "medium" ? 0.7 : 0.5; }

function contextAssertion(entry: BusinessContextEntry, websiteFact: WebsiteKnowledgeFact | undefined, knowledge: PersistedWebsiteKnowledge | null | undefined): LegacyAssertion {
  const origin = knowledgeSourceOrigin(entry);
  const userEdited = entry.metadata.userEdited;
  const websiteEvidence = websiteFact?.evidence ?? [];
  return {
    kind: "context", legacyEntryId: entry.id, identity: entry.id, entityType: entityTypeForCategory(entry.category), name: normalizeText(entry.title), alias: normalizeText(entry.title), value: normalizeText(entry.content), tags: sortedUnique(entry.metadata.tags),
    confidence: { level: entry.confidence, score: entry.confidenceScore }, reviewState: entry.status, authority: entry.status === "corrected" ? "corrected" : userEdited ? "confirmed" : origin === "generated_qa" ? "generated" : origin === "website" ? "observed" : "provided",
    source: { origin, sourceEntryId: entry.id, intakeBlockId: entry.source.intakeBlockId || null, url: entry.source.sourceUrl ?? null, label: null, capturedAt: entry.createdAt, crawlAttemptId: origin === "website" ? knowledge?.current_crawl_attempt_id ?? null : null },
    evidence: websiteEvidence.length ? websiteEvidence.map((item) => ({ url: item.url, excerpt: item.excerpt })) : [{ url: entry.source.sourceUrl ?? null, excerpt: entry.source.excerpt }],
    createdAt: entry.createdAt, updatedAt: entry.updatedAt, faqSourceEntryIds: [],
  };
}
function faqAssertion(entry: GeneratedFaqEntry): LegacyAssertion {
  return { kind: "faq", legacyEntryId: entry.id, identity: entry.id, entityType: "faq", name: normalizeText(entry.question), alias: normalizeText(entry.question), value: normalizeText(entry.answer), tags: ["faq"], confidence: { level: entry.confidence, score: entry.confidenceScore }, reviewState: entry.status, authority: entry.status === "corrected" ? "corrected" : "generated", source: { origin: "generated_qa", sourceEntryId: entry.id, intakeBlockId: null, url: null, label: "Generated FAQ", capturedAt: entry.createdAt, crawlAttemptId: null }, evidence: [], createdAt: entry.createdAt, updatedAt: entry.updatedAt, faqSourceEntryIds: sortedUnique(entry.sourceEntryIds) };
}
function websiteAssertions(knowledge: PersistedWebsiteKnowledge | null | undefined, restoredEntryIds: ReadonlySet<string>): LegacyAssertion[] {
  if (!knowledge) return [];
  const capturedAt = knowledge.imported_at ?? "";
  const facts = knowledge.knowledge.facts.filter((fact) => !restoredEntryIds.has(websiteFactIdentity(fact))).map((fact) => ({ fact, fingerprint: websiteFactFingerprint(fact) })).sort((left, right) => compare(left.fingerprint, right.fingerprint));
  const occurrences = new Map<string, number>();
  return facts.map(({ fact, fingerprint }) => {
    const occurrence = occurrences.get(fingerprint) ?? 0; occurrences.set(fingerprint, occurrence + 1);
    return { kind: "website", legacyEntryId: null, identity: stableId("website_fact", [knowledge.current_crawl_attempt_id ?? "", fingerprint, String(occurrence)]), entityType: websiteEntityType(fact.category), name: normalizeText(fact.title), alias: normalizeText(fact.title), value: normalizeText(fact.value), tags: [fact.category], confidence: { level: fact.confidence, score: confidenceScore(fact.confidence) }, reviewState: "proposed", authority: "observed", source: { origin: "website", sourceEntryId: null, intakeBlockId: "website_knowledge", url: null, label: knowledge.resolved_url ?? knowledge.requested_url, capturedAt, crawlAttemptId: knowledge.current_crawl_attempt_id }, evidence: fact.evidence.map((item) => ({ url: item.url, excerpt: item.excerpt })), createdAt: capturedAt, updatedAt: capturedAt, faqSourceEntryIds: [] };
  });
}
function aliasPriority(detail: LegacyAssertion): number { const approved = detail.reviewState === "approved" || detail.reviewState === "corrected"; return approved && detail.source.origin === "user_edit" ? 0 : approved && detail.source.origin === "manual_intake" ? 1 : approved ? 2 : 3; }
function aggregateAliases(details: LegacyAssertion[]): string[] { const choices = new Map<string, { value: string; priority: number }>(); details.forEach((detail) => { const value = normalizeText(detail.alias); const key = normalizedIdentity(value); if (!key) return; const candidate = { value, priority: aliasPriority(detail) }; const current = choices.get(key); if (!current || candidate.priority < current.priority || (candidate.priority === current.priority && compare(candidate.value, current.value) < 0)) choices.set(key, candidate); }); return Array.from(choices.values()).map((choice) => choice.value).sort(compare); }
function preferredName(details: LegacyAssertion[]): string { const aliases = aggregateAliases(details); const candidates = details.map((detail) => ({ value: normalizeText(detail.alias), priority: aliasPriority(detail) })).filter((candidate) => candidate.value).sort((left, right) => left.priority - right.priority || compare(left.value, right.value)); return candidates[0]?.value || aliases[0] || ""; }
function sortById<T extends { id: string }>(values: T[]): T[] { return values.sort((left, right) => compare(left.id, right.id)); }
function earliest(values: readonly string[]): string { return values.slice().sort(compare)[0] ?? ""; }
function latest(values: readonly string[]): string { return values.slice().sort(compare).at(-1) ?? ""; }
function sortedMerges(merges: readonly EntityMergeContract[] | undefined): EntityMergeContract[] | undefined { if (!merges?.length) return undefined; return merges.map((merge) => ({ canonicalEntityId: merge.canonicalEntityId, mergedEntityIds: sortedUnique(merge.mergedEntityIds), approvedAliases: sortedUnique(merge.approvedAliases), mergedAt: merge.mergedAt })).sort((left, right) => compare(`${left.canonicalEntityId}\u0000${left.mergedAt}`, `${right.canonicalEntityId}\u0000${right.mergedAt}`)); }

/** Builds an isolated, deterministic projection and performs no production reads or writes. */
export function buildBusinessMemory(input: BuildBusinessMemoryInput): BusinessMemory {
  const websiteFactByRestoredEntryId = new Map(input.websiteKnowledge?.knowledge.facts.map((fact) => [websiteFactIdentity(fact), fact]) ?? []);
  const restoredEntryIds = new Set(input.session.contextEntries.filter((entry) => websiteFactByRestoredEntryId.has(entry.id)).map((entry) => entry.id));
  const legacyAssertions = [...input.session.contextEntries.map((entry) => contextAssertion(entry, websiteFactByRestoredEntryId.get(entry.id), input.websiteKnowledge)), ...input.session.faqEntries.map(faqAssertion), ...websiteAssertions(input.websiteKnowledge, restoredEntryIds)].sort((left, right) => compare(`${left.kind}:${left.identity}`, `${right.kind}:${right.identity}`));
  const sources = new Map<string, KnowledgeSource>(); const evidence = new Map<string, EvidenceRecord>(); const assertions: BusinessAssertion[] = []; const assertionDetails = new Map<string, LegacyAssertion>(); const entityIdByLegacyEntryId = new Map<string, string>(); const assertionIdByLegacyEntryId = new Map<string, string>();
  legacyAssertions.forEach((legacy) => { const entityId = stableId("business_entity", [input.session.id, legacy.entityType, legacy.name]); if (legacy.legacyEntryId) entityIdByLegacyEntryId.set(legacy.legacyEntryId, entityId); const assertionId = stableId("business_assertion", [input.session.id, legacy.kind, legacy.identity]); if (legacy.legacyEntryId) assertionIdByLegacyEntryId.set(legacy.legacyEntryId, assertionId); const sourceIds: string[] = []; const evidenceIds: string[] = []; const sourceVariants = legacy.evidence.length ? legacy.evidence.map((item) => ({ ...legacy.source, url: item.url ?? legacy.source.url })) : [legacy.source]; sourceVariants.forEach((source) => { const sourceId = stableId("knowledge_source", [input.session.id, assertionId, source.origin, source.sourceEntryId ?? "", source.intakeBlockId ?? "", source.url ?? ""]); sourceIds.push(sourceId); sources.set(sourceId, { id: sourceId, ...source }); }); legacy.evidence.forEach((item) => { const sourceId = stableId("knowledge_source", [input.session.id, assertionId, legacy.source.origin, legacy.source.sourceEntryId ?? "", legacy.source.intakeBlockId ?? "", item.url ?? legacy.source.url ?? ""]); const evidenceId = stableId("evidence", [sourceId, item.excerpt]); evidenceIds.push(evidenceId); evidence.set(evidenceId, { id: evidenceId, sourceId, excerpt: normalizeText(item.excerpt), url: item.url, capturedAt: legacy.createdAt }); }); assertions.push({ id: assertionId, entityId, value: legacy.value, confidence: legacy.confidence, reviewState: legacy.reviewState, authority: legacy.authority, sourceIds: sortedUnique(sourceIds), evidenceIds: sortedUnique(evidenceIds), tags: sortedUnique(legacy.tags), legacyEntryId: legacy.legacyEntryId, createdAt: legacy.createdAt, updatedAt: legacy.updatedAt }); assertionDetails.set(assertionId, legacy); });
  const assertionsByEntity = new Map<string, BusinessAssertion[]>(); assertions.forEach((assertion) => { const owned = assertionsByEntity.get(assertion.entityId) ?? []; owned.push(assertion); assertionsByEntity.set(assertion.entityId, owned); });
  const entities: BusinessEntity[] = Array.from(assertionsByEntity.entries()).map(([id, owned]) => { const details = owned.map((assertion) => assertionDetails.get(assertion.id)!); return { id, type: details[0].entityType, name: preferredName(details), aliases: aggregateAliases(details), tags: sortedUnique(owned.flatMap((assertion) => assertion.tags)), assertionIds: sortById(owned.slice()).map((assertion) => assertion.id), sourceIds: sortedUnique(owned.flatMap((assertion) => assertion.sourceIds)), evidenceIds: sortedUnique(owned.flatMap((assertion) => assertion.evidenceIds)), createdAt: earliest(owned.map((assertion) => assertion.createdAt)), updatedAt: latest(owned.map((assertion) => assertion.updatedAt)) }; });
  const relationships: BusinessRelationship[] = legacyAssertions.flatMap((legacy) => { const faqLegacyEntryId = legacy.legacyEntryId; if (legacy.kind !== "faq" || !faqLegacyEntryId) return []; const toEntityId = entityIdByLegacyEntryId.get(faqLegacyEntryId); const toAssertionId = assertionIdByLegacyEntryId.get(faqLegacyEntryId); if (!toEntityId || !toAssertionId) return []; return legacy.faqSourceEntryIds.flatMap((sourceEntryId) => { const fromEntityId = entityIdByLegacyEntryId.get(sourceEntryId); const fromAssertionId = assertionIdByLegacyEntryId.get(sourceEntryId); if (!fromEntityId || !fromAssertionId) return []; return [{ id: stableId("business_relationship", ["supports", fromEntityId, toEntityId, sourceEntryId, faqLegacyEntryId]), type: "supports" as const, fromEntityId, toEntityId, fromAssertionId, toAssertionId, sourceEntryIds: [sourceEntryId], reviewState: legacy.reviewState, createdAt: legacy.createdAt, updatedAt: legacy.updatedAt }]; }); });
  const entityMerges = sortedMerges(input.entityMerges);
  return { id: stableId("business_memory", [input.session.id]), schemaVersion: BUSINESS_MEMORY_SCHEMA_VERSION, projectId: input.session.id, assistant: { ...input.session.assistantConfiguration }, entities: sortById(entities), assertions: sortById(assertions), relationships: sortById(relationships), sources: sortById(Array.from(sources.values())), evidence: sortById(Array.from(evidence.values())), conflicts: [], missingInformation: [], ...(entityMerges ? { entityMerges } : {}), createdAt: input.session.createdAt, updatedAt: latest([input.session.updatedAt, input.websiteKnowledge?.imported_at ?? "", ...assertions.map((assertion) => assertion.updatedAt)]) };
}
