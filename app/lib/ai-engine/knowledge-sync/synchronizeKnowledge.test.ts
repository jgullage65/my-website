import assert from "node:assert/strict";
import test from "node:test";
import type { BusinessMemory } from "../business-memory/contracts";
import { websiteFactIdentity, type PersistedWebsiteKnowledge, type WebsiteKnowledgeFact } from "../knowledge/websiteKnowledge";
import { synchronizeKnowledge } from "./synchronizeKnowledge";

const time = "2026-07-19T10:00:00.000Z";
const fact = (overrides: Partial<WebsiteKnowledgeFact> = {}): WebsiteKnowledgeFact => ({
  category: "service", title: "Planning", value: "Remote planning is available.", confidence: "high",
  evidence: [{ url: "https://example.com/services", excerpt: "Remote planning is available." }], ...overrides,
});
function crawl(facts: WebsiteKnowledgeFact[] = [fact()], overrides: Partial<PersistedWebsiteKnowledge> = {}): PersistedWebsiteKnowledge {
  return { schema_version: 1, document_version: 1, current_crawl_attempt_id: "crawl_2", imported_at: time, requested_url: "https://example.com", resolved_url: "https://example.com", pages: [{ url: "https://example.com/services", title: "Services", pageType: "service" }], warnings: [], knowledge: { facts, coverage: { businessIdentity: 0, offers: 0, customers: 0, pricing: 0, policies: 0, processes: 0, faq: 0, contact: 0, overall: 0 }, unresolvedQuestions: [] }, ...overrides };
}
function memory(facts: WebsiteKnowledgeFact[] = [fact()], overrides: Partial<BusinessMemory> = {}): BusinessMemory {
  const assertions = facts.map((item, index) => ({ id: `assertion_${index}`, entityId: "entity", value: item.value, confidence: { level: item.confidence, score: .9 }, reviewState: "corrected" as const, authority: "corrected" as const, sourceIds: [`source_${index}`], evidenceIds: [`evidence_${index}`], tags: [], legacyEntryId: websiteFactIdentity(item), createdAt: time, updatedAt: time }));
  const sources = facts.map((item, index) => ({ id: `source_${index}`, origin: "website" as const, sourceEntryId: websiteFactIdentity(item), intakeBlockId: "website_knowledge", url: item.evidence[0]?.url ?? null, label: null, capturedAt: time, crawlAttemptId: "crawl_1" }));
  const evidence = facts.map((item, index) => ({ id: `evidence_${index}`, sourceId: `source_${index}`, excerpt: item.evidence[0]?.excerpt ?? "", capturedAt: time }));
  return { id: "memory", schemaVersion: 1, projectId: "project", createdAt: time, updatedAt: time, entities: [{ id: "entity", type: "service", name: "Planning", aliases: ["Planning"], tags: [], assertionIds: assertions.map((item) => item.id), sourceIds: sources.map((item) => item.id), evidenceIds: evidence.map((item) => item.id), createdAt: time, updatedAt: time }], assertions, sources, evidence, relationships: [], ...overrides };
}
const sync = (current = memory(), next = crawl()) => synchronizeKnowledge({ currentBusinessMemory: current, crawledWebsiteKnowledge: next, synchronizationTimestamp: time });

test("keeps identical assertions unchanged and preserves reviewed workflow fields", () => {
  const result = sync();
  assert.equal(result.unchangedAssertions.length, 1);
  assert.equal(result.unchangedAssertions[0].current.reviewState, "corrected");
  assert.equal(result.unchangedAssertions[0].current.authority, "corrected");
  assert.deepEqual(result.unchangedAssertions[0].current.crawlAttemptIds, ["crawl_1"]);
});
test("matches multiple assertions by website fact identity, never position", () => {
  const first = fact({ value: "First assertion." });
  const second = fact({ value: "Second assertion." });
  const third = fact({ value: "Third assertion." });
  const result = sync(memory([first, second]), crawl([second, third]));
  assert.deepEqual(result.unchangedAssertions.map((item) => item.canonicalIdentity), [websiteFactIdentity(second)]);
  assert.deepEqual(result.removedAssertions.map((item) => item.canonicalIdentity), [websiteFactIdentity(first)]);
  assert.deepEqual(result.newAssertions.map((item) => item.canonicalIdentity), [websiteFactIdentity(third)]);
  assert.deepEqual(result.changedAssertions, []);
});
test("reports changed fact identities as removal and discovery rather than a positional change", () => {
  const result = sync(memory(), crawl([fact({ value: "Global planning is available." })]));
  assert.equal(result.changedAssertions.length, 0);
  assert.equal(result.removedAssertions.length, 1);
  assert.equal(result.newAssertions.length, 1);
});
test("reports confidence and evidence excerpt changes for the same canonical fact", () => {
  const confidence = sync(memory(), crawl([fact({ confidence: "medium" })])).changedAssertions[0].changes;
  assert.equal(confidence.confidence, true);
  assert.equal(confidence.value, false);
  const excerpt = sync(memory(), crawl([fact({ evidence: [{ url: "https://example.com/services", excerpt: "Planning from anywhere." }] })])).changedAssertions[0].changes;
  assert.equal(excerpt.evidenceExcerpts, true);
  assert.equal(excerpt.sourceUrls, false);
});
test("reports a changed evidence URL without changing the excerpt", () => {
  const current = memory();
  current.sources[0] = { ...current.sources[0], url: "https://example.com/previous" };
  const changes = sync(current).changedAssertions[0].changes;
  assert.equal(changes.sourceUrls, true);
  assert.equal(changes.evidenceExcerpts, false);
});
test("does not report reordered identical evidence URL collections as changed", () => {
  const first = fact({ evidence: [{ url: "https://example.com/a", excerpt: "A" }, { url: "https://example.com/b", excerpt: "B" }] });
  const current = memory([first]);
  current.sources.push({ ...current.sources[0], id: "source_1", url: "https://example.com/b" });
  current.evidence.push({ id: "evidence_1", sourceId: "source_1", excerpt: "B", capturedAt: time });
  current.assertions[0].evidenceIds = ["evidence_1", "evidence_0"];
  current.assertions[0].sourceIds = ["source_1", "source_0"];
  const result = sync(current, crawl([first]));
  assert.equal(result.unchangedAssertions.length, 1);
  assert.equal(result.changedAssertions.length, 0);
});
test("reordered assertions produce byte-identical results", () => {
  const first = fact({ value: "First assertion." }); const second = fact({ value: "Second assertion." });
  assert.equal(JSON.stringify(sync(memory([first, second]), crawl([first, second]))), JSON.stringify(sync(memory([first, second]), crawl([second, first]))));
});
test("reports added and removed canonical entities without automatic merges", () => {
  const added = sync(memory(), crawl([fact(), fact({ title: "Consulting" })]));
  assert.equal(added.newEntities.length, 1);
  assert.equal(sync(memory(), crawl([])).removedEntities.length, 1);
  assert.deepEqual(added.changedEntities, []);
});
test("derives metadata from the latest single crawl attempt only", () => {
  const current = memory();
  current.sources.push({ ...current.sources[0], id: "source_old", crawlAttemptId: "crawl_0", capturedAt: "2026-07-18T00:00:00.000Z" });
  const metadata = sync(current).crawlMetadata.current;
  assert.deepEqual(metadata, { crawlAttemptId: "crawl_1", importedAt: time, pageCount: null, warningCount: null });
});
test("keeps unavailable metadata explicit and deterministic", () => {
  const current = memory(); current.sources[0] = { ...current.sources[0], crawlAttemptId: null };
  const first = sync(current).crawlMetadata;
  assert.deepEqual(first.current, { crawlAttemptId: null, importedAt: null, pageCount: null, warningCount: null });
  assert.equal(JSON.stringify(first), JSON.stringify(sync(current).crawlMetadata));
});
test("reports canonical entity presentation changes without merging entities", () => {
  const result = sync(memory(), crawl([fact({ title: " planning " })]));
  assert.equal(result.changedEntities.length, 1);
  assert.equal(result.unchangedEntities.length, 0);
});
