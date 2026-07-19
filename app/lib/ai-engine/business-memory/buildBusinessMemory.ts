import type {
  AiBuilderSession,
  BusinessContextCategory,
  BusinessContextEntry,
  GeneratedFaqEntry,
} from "@/app/lib/ai-engine/contracts";
import type { PersistedWebsiteKnowledge } from "@/app/lib/ai-engine/knowledge/websiteKnowledge";
import type {
  AssertionAuthority,
  BusinessAssertion,
  BusinessEntity,
  BusinessEntityType,
  BusinessMemory,
  BusinessRelationship,
  Confidence,
  EvidenceRecord,
  KnowledgeSource,
  ReviewState,
} from "./contracts";

export type BuildBusinessMemoryInput = {
  session: AiBuilderSession;
  websiteKnowledge: PersistedWebsiteKnowledge | null | undefined;
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

function normalizeText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizedIdentity(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function stableId(prefix: string, values: readonly string[]): string {
  const source = values.map(normalizedIdentity).join("\u0000");
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}_${(hash >>> 0).toString(16)}`;
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedUnique(values: readonly string[]): string[] {
  return Array.from(new Set(values.map(normalizeText).filter(Boolean))).sort(compare);
}

function entityTypeForCategory(category: BusinessContextCategory): BusinessEntityType {
  const mapping: Record<BusinessContextCategory, BusinessEntityType> = {
    business_profile: "business", audience: "customer_segment", service: "service",
    pricing: "pricing_concept", policy: "policy", process: "process",
    differentiator: "differentiator", faq: "faq", behavior_rule: "other", prohibited_claim: "other",
  };
  return mapping[category];
}

function websiteEntityType(category: string): BusinessEntityType {
  const mapping: Record<string, BusinessEntityType> = {
    business_identity: "business", industry: "business", product: "product", service: "service",
    customer: "customer_segment", pricing: "pricing_concept", policy: "policy", process: "process",
    faq: "faq", differentiator: "differentiator", guarantee: "guarantee", location: "location", contact: "contact_method",
  };
  return mapping[category] ?? "other";
}

function contextAssertion(entry: BusinessContextEntry): LegacyAssertion {
  const userEdited = entry.metadata.userEdited;
  return {
    kind: "context", legacyEntryId: entry.id, identity: entry.id,
    entityType: entityTypeForCategory(entry.category), name: normalizeText(entry.title), alias: normalizeText(entry.title),
    value: normalizeText(entry.content), tags: sortedUnique(entry.metadata.tags),
    confidence: { level: entry.confidence, score: entry.confidenceScore }, reviewState: entry.status, authority: entry.status === "corrected" ? "corrected" : userEdited ? "confirmed" : "provided",
    source: { origin: userEdited ? "user_edit" : "manual_intake", sourceEntryId: entry.id, intakeBlockId: entry.source.intakeBlockId || null, url: entry.source.sourceUrl ?? null, label: null, capturedAt: entry.createdAt },
    evidence: [{ url: entry.source.sourceUrl ?? null, excerpt: entry.source.excerpt }],
    createdAt: entry.createdAt, updatedAt: entry.updatedAt, faqSourceEntryIds: [],
  };
}

function faqAssertion(entry: GeneratedFaqEntry): LegacyAssertion {
  return {
    kind: "faq", legacyEntryId: entry.id, identity: entry.id, entityType: "faq",
    name: normalizeText(entry.question), alias: normalizeText(entry.question), value: normalizeText(entry.answer), tags: ["faq"],
    confidence: { level: entry.confidence, score: entry.confidenceScore }, reviewState: entry.status, authority: entry.status === "corrected" ? "corrected" : "generated",
    source: { origin: "generated_qa", sourceEntryId: entry.id, intakeBlockId: null, url: null, label: "Generated FAQ", capturedAt: entry.createdAt },
    evidence: [], createdAt: entry.createdAt, updatedAt: entry.updatedAt, faqSourceEntryIds: sortedUnique(entry.sourceEntryIds),
  };
}

function websiteAssertions(knowledge: PersistedWebsiteKnowledge | null | undefined): LegacyAssertion[] {
  if (!knowledge) return [];
  const capturedAt = knowledge.imported_at ?? "";
  const facts = knowledge.knowledge.facts.map((fact) => ({
    fact,
    fingerprint: [fact.category, fact.title, fact.value, ...fact.evidence.map((evidence) => `${evidence.url}\u0000${evidence.excerpt}`).sort()].map(normalizedIdentity).join("\u0000"),
  })).sort((left, right) => compare(left.fingerprint, right.fingerprint));
  const occurrences = new Map<string, number>();

  return facts.map(({ fact, fingerprint }) => {
    const occurrence = occurrences.get(fingerprint) ?? 0;
    occurrences.set(fingerprint, occurrence + 1);
    return {
      kind: "website", legacyEntryId: null,
      identity: stableId("website_fact", [knowledge.current_crawl_attempt_id ?? "", fingerprint, String(occurrence)]),
      entityType: websiteEntityType(fact.category), name: normalizeText(fact.title), alias: normalizeText(fact.title),
      value: normalizeText(fact.value), tags: [fact.category],
      confidence: { level: fact.confidence, score: fact.confidence === "high" ? 0.9 : fact.confidence === "medium" ? 0.7 : 0.5 },
      reviewState: "proposed", authority: "observed",
      source: { origin: "website", sourceEntryId: null, intakeBlockId: "website_knowledge", url: null, label: knowledge.resolved_url ?? knowledge.requested_url, capturedAt },
      evidence: fact.evidence.map((evidence) => ({ url: evidence.url, excerpt: evidence.excerpt })),
      createdAt: capturedAt, updatedAt: capturedAt, faqSourceEntryIds: [],
    };
  });
}

function aliasPriority(detail: LegacyAssertion): number {
  const approved = detail.reviewState === "approved" || detail.reviewState === "corrected";
  if (approved && detail.source.origin === "user_edit") return 0;
  if (approved && detail.source.origin === "manual_intake") return 1;
  if (approved) return 2;
  return 3;
}

function aggregateAliases(details: LegacyAssertion[]): string[] {
  const choices = new Map<string, { value: string; priority: number }>();
  details.forEach((detail) => {
    const value = normalizeText(detail.alias);
    const key = normalizedIdentity(value);
    if (!key) return;
    const candidate = { value, priority: aliasPriority(detail) };
    const current = choices.get(key);
    if (!current || candidate.priority < current.priority || (candidate.priority === current.priority && compare(candidate.value, current.value) < 0)) choices.set(key, candidate);
  });
  return Array.from(choices.values()).map((choice) => choice.value).sort(compare);
}

function preferredName(details: LegacyAssertion[]): string {
  const aliases = aggregateAliases(details);
  const candidates = details.map((detail) => ({ value: normalizeText(detail.alias), priority: aliasPriority(detail) })).filter((candidate) => candidate.value);
  candidates.sort((left, right) => left.priority - right.priority || compare(left.value, right.value));
  return candidates[0]?.value || aliases[0] || "";
}

function sortById<T extends { id: string }>(values: T[]): T[] {
  return values.sort((left, right) => compare(left.id, right.id));
}

function earliest(values: readonly string[]): string {
  return values.slice().sort(compare)[0] ?? "";
}

function latest(values: readonly string[]): string {
  return values.slice().sort(compare).at(-1) ?? "";
}

/** Builds an isolated, deterministic projection and performs no production reads or writes. */
export function buildBusinessMemory(input: BuildBusinessMemoryInput): BusinessMemory {
  const legacyAssertions = [
    ...input.session.contextEntries.map(contextAssertion),
    ...input.session.faqEntries.map(faqAssertion),
    ...websiteAssertions(input.websiteKnowledge),
  ].sort((left, right) => compare(`${left.kind}:${left.identity}`, `${right.kind}:${right.identity}`));
  const sources = new Map<string, KnowledgeSource>();
  const evidence = new Map<string, EvidenceRecord>();
  const assertions: BusinessAssertion[] = [];
  const assertionDetails = new Map<string, LegacyAssertion>();
  const entityIdByLegacyEntryId = new Map<string, string>();

  legacyAssertions.forEach((legacy) => {
    const entityId = stableId("business_entity", [input.session.id, legacy.entityType, legacy.name]);
    if (legacy.legacyEntryId) entityIdByLegacyEntryId.set(legacy.legacyEntryId, entityId);
    const assertionId = stableId("business_assertion", [input.session.id, legacy.kind, legacy.identity]);
    const sourceIds: string[] = [];
    const evidenceIds: string[] = [];
    const sourceVariants = legacy.evidence.length ? legacy.evidence.map((item) => ({ ...legacy.source, url: item.url ?? legacy.source.url })) : [legacy.source];

    sourceVariants.forEach((source) => {
      const sourceId = stableId("knowledge_source", [input.session.id, assertionId, source.origin, source.sourceEntryId ?? "", source.intakeBlockId ?? "", source.url ?? ""]);
      sourceIds.push(sourceId);
      sources.set(sourceId, { id: sourceId, ...source });
    });
    legacy.evidence.forEach((item) => {
      const sourceId = stableId("knowledge_source", [input.session.id, assertionId, legacy.source.origin, legacy.source.sourceEntryId ?? "", legacy.source.intakeBlockId ?? "", item.url ?? legacy.source.url ?? ""]);
      const evidenceId = stableId("evidence", [sourceId, item.excerpt]);
      evidenceIds.push(evidenceId);
      evidence.set(evidenceId, { id: evidenceId, sourceId, excerpt: normalizeText(item.excerpt), capturedAt: legacy.createdAt });
    });
    assertions.push({ id: assertionId, entityId, value: legacy.value, confidence: legacy.confidence, reviewState: legacy.reviewState, authority: legacy.authority, sourceIds: sortedUnique(sourceIds), evidenceIds: sortedUnique(evidenceIds), tags: sortedUnique(legacy.tags), legacyEntryId: legacy.legacyEntryId, createdAt: legacy.createdAt, updatedAt: legacy.updatedAt });
    assertionDetails.set(assertionId, legacy);
  });

  const assertionsByEntity = new Map<string, BusinessAssertion[]>();
  assertions.forEach((assertion) => {
    const owned = assertionsByEntity.get(assertion.entityId) ?? [];
    owned.push(assertion);
    assertionsByEntity.set(assertion.entityId, owned);
  });
  const entities: BusinessEntity[] = Array.from(assertionsByEntity.entries()).map(([id, owned]) => {
    const details = owned.map((assertion) => assertionDetails.get(assertion.id)!);
    return {
      id, type: details[0].entityType, name: preferredName(details),
      aliases: aggregateAliases(details),
      tags: sortedUnique(owned.flatMap((assertion) => assertion.tags)), assertionIds: sortById(owned.slice()).map((assertion) => assertion.id),
      sourceIds: sortedUnique(owned.flatMap((assertion) => assertion.sourceIds)), evidenceIds: sortedUnique(owned.flatMap((assertion) => assertion.evidenceIds)),
      createdAt: earliest(owned.map((assertion) => assertion.createdAt)), updatedAt: latest(owned.map((assertion) => assertion.updatedAt)),
    };
  });

  const relationships: BusinessRelationship[] = legacyAssertions.flatMap((legacy) => {
    const faqLegacyEntryId = legacy.legacyEntryId;
    if (legacy.kind !== "faq" || !faqLegacyEntryId) return [];
    const toEntityId = entityIdByLegacyEntryId.get(faqLegacyEntryId);
    if (!toEntityId) return [];
    return legacy.faqSourceEntryIds.flatMap((sourceEntryId) => {
      const fromEntityId = entityIdByLegacyEntryId.get(sourceEntryId);
      if (!fromEntityId) return [];
      return [{ id: stableId("business_relationship", ["supports", fromEntityId, toEntityId, sourceEntryId, faqLegacyEntryId]), type: "supports" as const, fromEntityId, toEntityId, sourceEntryIds: [sourceEntryId], reviewState: legacy.reviewState, createdAt: legacy.createdAt, updatedAt: legacy.updatedAt }];
    });
  });

  return {
    id: stableId("business_memory", [input.session.id]), schemaVersion: 1, projectId: input.session.id,
    entities: sortById(entities), assertions: sortById(assertions), relationships: sortById(relationships),
    sources: sortById(Array.from(sources.values())), evidence: sortById(Array.from(evidence.values())),
    createdAt: input.session.createdAt, updatedAt: input.session.updatedAt,
  };
}
