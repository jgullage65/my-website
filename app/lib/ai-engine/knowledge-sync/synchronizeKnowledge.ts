import type { BusinessMemory, BusinessEntityType, Confidence, EvidenceRecord, KnowledgeSource } from "../business-memory/contracts";
import { websiteFactIdentity, type PersistedWebsiteKnowledge, type WebsiteKnowledgeFact } from "../knowledge/websiteKnowledge";
import type { KnowledgeSyncCrawledAssertion, KnowledgeSyncCurrentAssertion, KnowledgeSyncEntity, KnowledgeSyncResult } from "./contracts";

export type SynchronizeKnowledgeInput = {
  currentBusinessMemory: BusinessMemory;
  crawledWebsiteKnowledge: PersistedWebsiteKnowledge;
  /** Supplied by the caller so identical inputs always produce identical output. */
  synchronizationTimestamp: string;
};

const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const normalize = (value: string): string => value.replace(/\s+/g, " ").trim().toLowerCase();
const entityTypeForFact = (category: WebsiteKnowledgeFact["category"]): BusinessEntityType => ({ business_identity: "business", industry: "business", product: "product", service: "service", customer: "customer_segment", pricing: "pricing_concept", policy: "policy", process: "process", faq: "faq", differentiator: "differentiator", guarantee: "guarantee", location: "location", contact: "contact_method", other: "other" } as const)[category];
const entityIdentity = (type: string, name: string): string => `${normalize(type)}\u0000${normalize(name)}`;
const sortBy = <T>(values: T[], key: (value: T) => string): T[] => values.sort((left, right) => compare(key(left), key(right)));

function currentCrawlMetadata(memory: BusinessMemory) {
  const sourcesByAttempt = new Map<string, KnowledgeSource[]>();
  memory.sources.filter((source) => source.origin === "website" && source.crawlAttemptId !== null).forEach((source) => {
    const sources = sourcesByAttempt.get(source.crawlAttemptId!) ?? [];
    sources.push(source);
    sourcesByAttempt.set(source.crawlAttemptId!, sources);
  });
  const latestAttempt = Array.from(sourcesByAttempt.entries()).sort((left, right) => {
    const leftImportedAt = left[1].map((source) => source.capturedAt).sort(compare).at(-1) ?? "";
    const rightImportedAt = right[1].map((source) => source.capturedAt).sort(compare).at(-1) ?? "";
    return compare(leftImportedAt, rightImportedAt) || compare(left[0], right[0]);
  }).at(-1);
  if (!latestAttempt) return { crawlAttemptId: null, importedAt: null, pageCount: null, warningCount: null };
  return { crawlAttemptId: latestAttempt[0], importedAt: latestAttempt[1].map((source) => source.capturedAt).sort(compare).at(-1) ?? null, pageCount: null, warningCount: null };
}
function crawledAssertion(fact: WebsiteKnowledgeFact): KnowledgeSyncCrawledAssertion {
  const entityCanonicalIdentity = entityIdentity(entityTypeForFact(fact.category), fact.title);
  return { canonicalIdentity: websiteFactIdentity(fact), entityCanonicalIdentity, category: fact.category, title: fact.title.replace(/\s+/g, " ").trim(), value: fact.value.replace(/\s+/g, " ").trim(), confidence: fact.confidence, evidence: sortBy(fact.evidence.map((item) => ({ url: item.url, excerpt: item.excerpt })), (item) => `${normalize(item.url)}\u0000${normalize(item.excerpt)}`) };
}

function currentAssertion(assertion: BusinessMemory["assertions"][number], sources: Map<string, KnowledgeSource>, evidence: Map<string, EvidenceRecord>): KnowledgeSyncCurrentAssertion {
  const evidenceReferences = assertion.evidenceIds.map((id) => {
    const record = evidence.get(id)!; const source = sources.get(record.sourceId)!;
    return { id: record.id, sourceId: record.sourceId, url: source.url, excerpt: record.excerpt, crawlAttemptId: source.crawlAttemptId };
  });
  const sourceRecords = assertion.sourceIds.map((id) => sources.get(id)!).filter(Boolean);
  return { id: assertion.id, entityId: assertion.entityId, value: assertion.value, confidence: assertion.confidence, reviewState: assertion.reviewState, authority: assertion.authority, sourceOrigins: Array.from(new Set(sourceRecords.map((source) => source.origin))).sort(compare), crawlAttemptIds: Array.from(new Set(sourceRecords.map((source) => source.crawlAttemptId).filter((id): id is string => id !== null))).sort(compare), evidenceReferences: sortBy(evidenceReferences, (item) => `${normalize(item.url ?? "")}\u0000${normalize(item.excerpt)}\u0000${item.id}`) };
}

/** Computes a pure, sorted synchronization plan. It performs no writes or workflow decisions. */
export function synchronizeKnowledge(input: SynchronizeKnowledgeInput): KnowledgeSyncResult {
  const sourceById = new Map(input.currentBusinessMemory.sources.map((source) => [source.id, source]));
  const evidenceById = new Map(input.currentBusinessMemory.evidence.map((record) => [record.id, record]));
  const websiteAssertionIds = new Set(input.currentBusinessMemory.assertions.filter((assertion) => assertion.sourceIds.some((id) => sourceById.get(id)?.origin === "website")).map((assertion) => assertion.id));
  const entities = input.currentBusinessMemory.entities.filter((entity) => entity.assertionIds.some((id) => websiteAssertionIds.has(id)));
  const currentByCanonicalIdentity = new Map<string, KnowledgeSyncCurrentAssertion>();
  input.currentBusinessMemory.assertions.filter((assertion) => websiteAssertionIds.has(assertion.id)).sort((left, right) => compare(left.id, right.id)).forEach((assertion) => {
    // Restored website assertions retain websiteFactIdentity in legacyEntryId. The Business
    // Memory assertion ID is used only when that historical fact identity is unavailable.
    const sourceEntryId = assertion.sourceIds.map((id) => sourceById.get(id)?.sourceEntryId).find((id): id is string => id !== null && id !== undefined);
    const canonicalIdentity = assertion.legacyEntryId ?? sourceEntryId ?? assertion.id;
    currentByCanonicalIdentity.set(canonicalIdentity, currentAssertion(assertion, sourceById, evidenceById));
  });
  const crawledByCanonicalIdentity = new Map(input.crawledWebsiteKnowledge.knowledge.facts.map(crawledAssertion).map((assertion) => [assertion.canonicalIdentity, assertion]));
  const keys = Array.from(new Set(Array.from(currentByCanonicalIdentity.keys()).concat(Array.from(crawledByCanonicalIdentity.keys())))).sort(compare);
  const unchangedAssertions: KnowledgeSyncResult["unchangedAssertions"] = [];
  const newAssertions: KnowledgeSyncResult["newAssertions"] = [];
  const changedAssertions: KnowledgeSyncResult["changedAssertions"] = [];
  const removedAssertions: KnowledgeSyncResult["removedAssertions"] = [];
  keys.forEach((key) => {
    const prior = currentByCanonicalIdentity.get(key);
    const next = crawledByCanonicalIdentity.get(key);
    if (!prior && next) { newAssertions.push(next); return; }
    if (prior && !next) { removedAssertions.push({ canonicalIdentity: key, current: prior }); return; }
    if (!prior || !next) return;
    const priorEvidence = prior.evidenceReferences.map((item) => `${normalize(item.url ?? "")}\u0000${normalize(item.excerpt)}`);
    const nextEvidence = next.evidence.map((item) => `${normalize(item.url)}\u0000${normalize(item.excerpt)}`);
    const priorUrls = prior.evidenceReferences.map((item) => normalize(item.url ?? "")).sort(compare);
    const nextUrls = next.evidence.map((item) => normalize(item.url)).sort(compare);
    const priorExcerpts = prior.evidenceReferences.map((item) => normalize(item.excerpt)).sort(compare);
    const nextExcerpts = next.evidence.map((item) => normalize(item.excerpt)).sort(compare);
    const changes = {
      value: normalize(prior.value) !== normalize(next.value),
      confidence: prior.confidence.level !== next.confidence,
      sourceUrls: JSON.stringify(priorUrls) !== JSON.stringify(nextUrls),
      evidenceExcerpts: JSON.stringify(priorExcerpts) !== JSON.stringify(nextExcerpts),
      evidence: {
        added: next.evidence.filter((item) => !priorEvidence.includes(`${normalize(item.url)}\u0000${normalize(item.excerpt)}`)),
        removed: prior.evidenceReferences.filter((item) => !nextEvidence.includes(`${normalize(item.url ?? "")}\u0000${normalize(item.excerpt)}`)),
      },
    };
    if (changes.value || changes.confidence || changes.sourceUrls || changes.evidenceExcerpts) changedAssertions.push({ canonicalIdentity: key, current: prior, crawled: next, changes });
    else unchangedAssertions.push({ canonicalIdentity: key, current: prior, crawled: next });
  });
  const currentEntities = sortBy(entities.map((entity) => ({ id: entity.id, type: entity.type, name: entity.name, aliases: [...entity.aliases].sort(compare), canonicalIdentity: entityIdentity(entity.type, entity.name) })), (entity) => entity.canonicalIdentity);
  const crawledEntities = sortBy(Array.from(new Map(input.crawledWebsiteKnowledge.knowledge.facts.map((fact) => { const type = entityTypeForFact(fact.category), canonicalIdentity = entityIdentity(type, fact.title); return [canonicalIdentity, { id: canonicalIdentity, type, name: fact.title.replace(/\s+/g, " ").trim(), aliases: [fact.title.replace(/\s+/g, " ").trim()], canonicalIdentity } as KnowledgeSyncEntity]; })).values()), (entity) => entity.canonicalIdentity);
  const crawledByIdentity = new Map(crawledEntities.map((entity) => [entity.canonicalIdentity, entity])); const currentByIdentity = new Map(currentEntities.map((entity) => [entity.canonicalIdentity, entity]));
  const entityChanged = (currentEntity: KnowledgeSyncEntity, crawledEntity: KnowledgeSyncEntity): boolean => currentEntity.name !== crawledEntity.name || JSON.stringify(currentEntity.aliases) !== JSON.stringify(crawledEntity.aliases);
  const unchangedEntities = currentEntities.filter((entity) => { const crawledEntity = crawledByIdentity.get(entity.canonicalIdentity); return crawledEntity !== undefined && !entityChanged(entity, crawledEntity); });
  const changedEntities = currentEntities.flatMap((entity) => { const crawledEntity = crawledByIdentity.get(entity.canonicalIdentity); return crawledEntity && entityChanged(entity, crawledEntity) ? [{ current: entity, crawled: crawledEntity }] : []; });
  const newEntities = crawledEntities.filter((entity) => !currentByIdentity.has(entity.canonicalIdentity));
  const removedEntities = currentEntities.filter((entity) => !crawledByIdentity.has(entity.canonicalIdentity));
  const current = currentCrawlMetadata(input.currentBusinessMemory), crawled = { crawlAttemptId: input.crawledWebsiteKnowledge.current_crawl_attempt_id, importedAt: input.crawledWebsiteKnowledge.imported_at, pageCount: input.crawledWebsiteKnowledge.pages.length, warningCount: input.crawledWebsiteKnowledge.warnings.length };
  return { synchronizationTimestamp: input.synchronizationTimestamp, unchangedAssertions: sortBy(unchangedAssertions, (item) => `${item.canonicalIdentity}\u0000${item.current.id}`), newAssertions: sortBy(newAssertions, (item) => `${item.canonicalIdentity}\u0000${normalize(item.value)}`), changedAssertions: sortBy(changedAssertions, (item) => `${item.canonicalIdentity}\u0000${item.current.id}`), removedAssertions: sortBy(removedAssertions, (item) => `${item.canonicalIdentity}\u0000${item.current.id}`), unchangedEntities, newEntities, changedEntities: sortBy(changedEntities, (item) => item.current.canonicalIdentity), removedEntities, crawlMetadata: { current, crawled, changes: { crawlAttemptId: current.crawlAttemptId !== crawled.crawlAttemptId, importedAt: current.importedAt !== crawled.importedAt, pageCount: current.pageCount !== crawled.pageCount, warningCount: current.warningCount !== crawled.warningCount } } };
}
