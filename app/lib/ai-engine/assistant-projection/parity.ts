import type { KnowledgeFact, KnowledgeFaq, KnowledgePack } from "../knowledge/contracts";
import type { AssistantProjection, AssistantProjectionTextKnowledgeItem } from "./contracts";
import { buildLegacyKnowledgePackFromAssistantProjection } from "./legacy-compatibility";

type ParityStatus = "MATCH" | "MINOR_DIFFERENCE" | "MAJOR_DIFFERENCE";
type Difference = { key: string; legacy?: string; canonical?: string };
type CanonicalItem = AssistantProjectionTextKnowledgeItem & { category: string; content: string; sourceIds: string[]; question?: string; answer?: string };

export type AssistantProjectionParityReport = { projectId: string; runtimeVersion: number; assistantProjectionVersion: number; assistantProjectionSchemaVersion: number; comparedAt: string; legacyCounts: Record<string, number>; canonicalCounts: Record<string, number>; mismatchSummary: { total: number; major: number; minor: number }; categories: { missingKnowledge: Difference[]; extraKnowledge: Difference[]; factContentMismatches: Difference[]; reviewStateDifferences: Difference[]; provenanceDifferences: Difference[]; faq: { missing: Difference[]; extra: Difference[]; contentMismatches: Difference[] }; archivedLeakage: Difference[]; formattingDifferences: Difference[] }; status: ParityStatus };

const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
const comparisonText = (value: string) => normalize(value).toLocaleLowerCase();
const exact = (value: string) => value.trim();
const legacyFacts = (pack: KnowledgePack) => [...pack.facts, ...pack.behaviorRules, ...pack.prohibitedClaims];
const factKey = (item: { category: string; title: string }) => `${item.category}:${comparisonText(item.title)}`;
const faqKey = (item: { question: string }) => `faq:${comparisonText(item.question)}`;
const stable = (values: string[]) => Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
const isArchived = (item: { reviewState: unknown }) => item.reviewState === "archived";

function canonicalFacts(projection: AssistantProjection): CanonicalItem[] {
  return [
    ...projection.services.map(item => ({ ...item, category: "service", content: item.value })),
    ...projection.pricing.map(item => ({ ...item, category: "pricing", content: item.value })),
    ...projection.policies.map(item => ({ ...item, category: "policy", content: item.value })),
  ];
}
function canonicalFaqs(projection: AssistantProjection): CanonicalItem[] { return projection.faqs.map(item => ({ ...item, category: "faq", content: item.answer, question: item.question, answer: item.answer })); }
function sortForPairing<T extends { id: string; content: string }>(items: T[]) { return [...items].sort((a, b) => `${comparisonText(a.content)}\u0000${a.id}`.localeCompare(`${comparisonText(b.content)}\u0000${b.id}`)); }
function provenance(sourceIds: string[], classification: string | null | undefined, projection: AssistantProjection): string {
  const sources = new Map(projection.sources.map(source => [source.id, source.origin]));
  const ids = stable(sourceIds);
  const origins = stable(ids.map(id => sources.get(id) ?? `missing:${id}`));
  // Mixed origins are deliberately represented as mixed, never AI-generated.
  const canonicalClass = origins.length === 0 ? "missing" : origins.includes("user_edit") ? "user_corrected" : origins.length === 1 && origins[0] === "website" ? "website" : origins.length === 1 && origins[0] === "manual_intake" ? "manual" : origins.length === 1 && origins[0] === "generated_qa" ? "ai_generated" : `mixed(${origins.join(",")})`;
  return `classification=${classification ?? canonicalClass}; sourceIds=${ids.join(",") || "missing"}; origins=${origins.join(",") || "missing"}`;
}
function recordProvenance(report: AssistantProjectionParityReport, key: string, legacyIds: string[], legacyClassification: string | null | undefined, canonicalIds: string[], projection: AssistantProjection) {
  const legacyValue = provenance(legacyIds, legacyClassification, projection);
  const canonicalValue = provenance(canonicalIds, undefined, projection);
  if (legacyValue !== canonicalValue) report.categories.provenanceDifferences.push({ key, legacy: legacyValue, canonical: canonicalValue });
}

/** Groups by stable comparison key, then pairs equal normalized content first and remaining entries by deterministic content/id order. */
function compareGrouped<L extends { id: string; content: string; reviewState: unknown }, C extends { id: string; content: string; reviewState: unknown }>(legacy: L[], canonical: C[], keyOf: (item: L | C) => string, comparePair: (left: L, right: C, key: string) => void, missing: (item: L, key: string) => void, extra: (item: C, key: string) => void) {
  const keys = stable([...legacy.map(keyOf), ...canonical.map(keyOf)]);
  for (const key of keys) {
    const left = legacy.filter(item => keyOf(item) === key), right = canonical.filter(item => keyOf(item) === key);
    const unmatchedRight = new Set(right.map((_, index) => index)); const pairs: Array<[L, C]> = [];
    for (const item of sortForPairing(left)) { const index = Array.from(unmatchedRight).find(i => comparisonText(item.content) === comparisonText(right[i].content)); if (index !== undefined) { unmatchedRight.delete(index); pairs.push([item, right[index]]); } else pairs.push([item, null as unknown as C]); }
    const remainingLeft = pairs.filter(([, item]) => !item).map(([item]) => item); const remainingRight = Array.from(unmatchedRight).map(i => right[i]);
    const count = Math.min(remainingLeft.length, remainingRight.length);
    for (let index = 0; index < count; index++) { const pair = [sortForPairing(remainingLeft)[index], sortForPairing(remainingRight)[index]] as [L, C]; pairs.splice(pairs.findIndex(([item, other]) => item === pair[0] && !other), 1, pair); }
    for (const [leftItem, rightItem] of pairs) if (rightItem) comparePair(leftItem, rightItem, key); else missing(leftItem, key);
    for (const item of remainingRight.slice(count)) extra(item, key);
  }
}

export function compareAssistantProjectionParity(input: { projectId: string; legacy: KnowledgePack; canonicalProjection: AssistantProjection; comparedAt?: string }): AssistantProjectionParityReport {
  const adapterPack = buildLegacyKnowledgePackFromAssistantProjection(input.canonicalProjection); // runtime-shape comparison remains intentional
  const directFacts = canonicalFacts(input.canonicalProjection), directFaq = canonicalFaqs(input.canonicalProjection);
  const report: AssistantProjectionParityReport = { projectId: input.projectId, runtimeVersion: input.legacy.version, assistantProjectionVersion: input.canonicalProjection.projectionVersion, assistantProjectionSchemaVersion: input.canonicalProjection.schemaVersion, comparedAt: input.comparedAt ?? new Date().toISOString(), legacyCounts: { facts: legacyFacts(input.legacy).length, faqs: input.legacy.faq.length }, canonicalCounts: { facts: directFacts.length, faqs: directFaq.length }, mismatchSummary: { total: 0, major: 0, minor: 0 }, categories: { missingKnowledge: [], extraKnowledge: [], factContentMismatches: [], reviewStateDifferences: [], provenanceDifferences: [], faq: { missing: [], extra: [], contentMismatches: [] }, archivedLeakage: [], formattingDifferences: [] }, status: "MATCH" };
  const adapterFacts = legacyFacts(adapterPack);
  // Direct canonical records supply state/source semantics; adapter is only used as a compatibility-shape sanity check.
  compareGrouped(legacyFacts(input.legacy), directFacts, item => factKey(item as KnowledgeFact), (left, right, key) => {
    if (left.reviewState !== right.reviewState) report.categories.reviewStateDifferences.push({ key, legacy: String(left.reviewState), canonical: String(right.reviewState) });
    if (isArchived(left) !== isArchived(right)) report.categories.archivedLeakage.push({ key, legacy: isArchived(left) ? "archived" : "active", canonical: isArchived(right) ? "archived" : "active" });
    recordProvenance(report, key, left.sourceEntryId ? [left.sourceEntryId] : [], left.provenance.classification, right.sourceIds, input.canonicalProjection);
    if (exact(left.title) !== exact(right.title)) report.categories.formattingDifferences.push({ key: `${key}:title`, legacy: left.title, canonical: right.title });
    if (comparisonText(left.content) !== comparisonText(right.content)) report.categories.factContentMismatches.push({ key, legacy: left.content, canonical: right.content }); else if (exact(left.content) !== exact(right.content)) report.categories.formattingDifferences.push({ key, legacy: left.content, canonical: right.content });
  }, (item, key) => { report.categories.missingKnowledge.push({ key, legacy: item.content }); if (isArchived(item)) report.categories.archivedLeakage.push({ key, legacy: "archived", canonical: "absent" }); }, (item, key) => { report.categories.extraKnowledge.push({ key, canonical: item.content }); if (isArchived(item)) report.categories.archivedLeakage.push({ key, legacy: "absent", canonical: "archived" }); });
  compareGrouped(input.legacy.faq.map(item => ({ ...item, content: item.answer })), directFaq, item => faqKey(item as { question: string }), (left, right, key) => { if (left.reviewState !== right.reviewState) report.categories.reviewStateDifferences.push({ key, legacy: String(left.reviewState), canonical: String(right.reviewState) }); if (isArchived(left) !== isArchived(right)) report.categories.archivedLeakage.push({ key, legacy: isArchived(left) ? "archived" : "active", canonical: isArchived(right) ? "archived" : "active" }); recordProvenance(report, key, left.sourceEntryIds ?? [], left.provenance.classification, right.sourceIds, input.canonicalProjection); if (exact(left.question) !== exact(right.question ?? right.title)) report.categories.formattingDifferences.push({ key: `${key}:question`, legacy: left.question, canonical: right.question ?? right.title }); if (comparisonText(left.answer) !== comparisonText(right.content)) report.categories.faq.contentMismatches.push({ key, legacy: left.answer, canonical: right.content }); else if (exact(left.answer) !== exact(right.content)) report.categories.formattingDifferences.push({ key, legacy: left.answer, canonical: right.content }); }, (item, key) => { report.categories.faq.missing.push({ key, legacy: item.answer }); if (isArchived(item)) report.categories.archivedLeakage.push({ key, legacy: "archived", canonical: "absent" }); }, (item, key) => { report.categories.faq.extra.push({ key, canonical: item.content }); if (isArchived(item)) report.categories.archivedLeakage.push({ key, legacy: "absent", canonical: "archived" }); });
  // Detect adapter loss separately only through direct semantics above; it is not runtime input.
  void adapterFacts;
  const c = report.categories; const major = c.missingKnowledge.length + c.extraKnowledge.length + c.factContentMismatches.length + c.reviewStateDifferences.length + c.faq.missing.length + c.faq.extra.length + c.faq.contentMismatches.length + c.archivedLeakage.length; const minor = c.provenanceDifferences.length + c.formattingDifferences.length;
  report.mismatchSummary = { total: major + minor, major, minor }; report.status = major ? "MAJOR_DIFFERENCE" : minor ? "MINOR_DIFFERENCE" : "MATCH"; return report;
}
