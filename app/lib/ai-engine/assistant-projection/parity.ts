import type { KnowledgeFact, KnowledgeFaq, KnowledgePack } from "../knowledge/contracts";
import type { AssistantProjection } from "./contracts";
import { buildLegacyKnowledgePackFromAssistantProjection } from "./legacy-compatibility";

type ParityStatus = "MATCH" | "MINOR_DIFFERENCE" | "MAJOR_DIFFERENCE";
type Difference = { key: string; legacy?: string; canonical?: string };

export type AssistantProjectionParityReport = {
  projectId: string;
  runtimeVersion: number;
  comparedAt: string;
  legacyCounts: Record<string, number>;
  canonicalCounts: Record<string, number>;
  mismatchSummary: { total: number; major: number; minor: number };
  categories: {
    missingKnowledge: Difference[];
    extraKnowledge: Difference[];
    reviewStateDifferences: Difference[];
    provenanceDifferences: Difference[];
    faq: { missing: Difference[]; extra: Difference[]; contentMismatches: Difference[] };
    archivedLeakage: Difference[];
    formattingDifferences: Difference[];
  };
  status: ParityStatus;
};

const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
const contentKey = (value: string) => normalize(value).toLocaleLowerCase();
const exactKey = (value: string) => value.trim();
const facts = (pack: KnowledgePack) => [...pack.facts, ...pack.behaviorRules, ...pack.prohibitedClaims];
const factKey = (fact: KnowledgeFact) => `${fact.category}:${contentKey(fact.title)}`;
const faqKey = (faq: KnowledgeFaq) => contentKey(faq.question);
const provenanceForCanonicalFact = (fact: KnowledgeFact, projection: AssistantProjection) => {
  const source = projection.sources.find((item) => item.id === fact.sourceEntryId);
  return source?.origin === "website" ? "website" : source?.origin === "manual_intake" ? "manual" : source?.origin === "user_edit" ? "user_corrected" : source?.origin === "generated_qa" ? "ai_generated" : null;
};
const provenanceForCanonicalFaq = (faq: KnowledgeFaq, projection: AssistantProjection) => {
  const origins = faq.sourceEntryIds.map((id) => projection.sources.find((source) => source.id === id)?.origin).filter((origin): origin is NonNullable<typeof origin> => Boolean(origin));
  if (origins.includes("user_edit")) return "user_corrected";
  if (origins.length === 1 && origins[0] === "website") return "website";
  if (origins.length === 1 && origins[0] === "manual_intake") return "manual";
  return origins.length ? "ai_generated" : null;
};

function compareFacts(legacy: KnowledgeFact[], canonical: KnowledgeFact[], projection: AssistantProjection, report: AssistantProjectionParityReport) {
  const canonicalByKey = new Map(canonical.map((item) => [factKey(item), item]));
  const legacyByKey = new Map(legacy.map((item) => [factKey(item), item]));
  for (const item of legacy) {
    const other = canonicalByKey.get(factKey(item));
    if (!other) { report.categories.missingKnowledge.push({ key: factKey(item), legacy: item.content }); continue; }
    if (item.reviewState !== other.reviewState) report.categories.reviewStateDifferences.push({ key: factKey(item), legacy: item.reviewState, canonical: other.reviewState });
    const legacyProvenance = item.provenance.classification;
    const canonicalProvenance = provenanceForCanonicalFact(other, projection);
    if (legacyProvenance !== canonicalProvenance) report.categories.provenanceDifferences.push({ key: factKey(item), legacy: legacyProvenance ?? "missing", canonical: canonicalProvenance ?? "missing" });
    if (exactKey(item.title) !== exactKey(other.title)) report.categories.formattingDifferences.push({ key: `${factKey(item)}:title`, legacy: item.title, canonical: other.title });
    if (exactKey(item.content) !== exactKey(other.content) && contentKey(item.content) === contentKey(other.content)) report.categories.formattingDifferences.push({ key: factKey(item), legacy: item.content, canonical: other.content });
    else if (contentKey(item.content) !== contentKey(other.content)) report.categories.missingKnowledge.push({ key: `${factKey(item)}:${contentKey(item.content)}`, legacy: item.content });
  }
  for (const item of canonical) if (!legacyByKey.has(factKey(item))) report.categories.extraKnowledge.push({ key: factKey(item), canonical: item.content });
  const archived = [...legacy, ...canonical].filter((item) => (item.reviewState as string) === "archived");
  for (const item of archived) report.categories.archivedLeakage.push({ key: factKey(item), legacy: legacyByKey.has(factKey(item)) ? "present" : undefined, canonical: canonicalByKey.has(factKey(item)) ? "present" : undefined });
}

function compareFaqs(legacy: KnowledgeFaq[], canonical: KnowledgeFaq[], projection: AssistantProjection, report: AssistantProjectionParityReport) {
  const canonicalByKey = new Map(canonical.map((item) => [faqKey(item), item]));
  const legacyByKey = new Map(legacy.map((item) => [faqKey(item), item]));
  for (const item of legacy) {
    const other = canonicalByKey.get(faqKey(item));
    if (!other) { report.categories.faq.missing.push({ key: faqKey(item), legacy: item.answer }); continue; }
    if (item.reviewState !== other.reviewState) report.categories.reviewStateDifferences.push({ key: `faq:${faqKey(item)}`, legacy: item.reviewState, canonical: other.reviewState });
    const canonicalProvenance = provenanceForCanonicalFaq(other, projection);
    if (item.provenance.classification !== canonicalProvenance) report.categories.provenanceDifferences.push({ key: `faq:${faqKey(item)}`, legacy: item.provenance.classification ?? "missing", canonical: canonicalProvenance ?? "missing" });
    if (exactKey(item.question) !== exactKey(other.question)) report.categories.formattingDifferences.push({ key: `faq:${faqKey(item)}:question`, legacy: item.question, canonical: other.question });
    if (exactKey(item.answer) !== exactKey(other.answer) && contentKey(item.answer) === contentKey(other.answer)) report.categories.formattingDifferences.push({ key: `faq:${faqKey(item)}`, legacy: item.answer, canonical: other.answer });
    else if (contentKey(item.answer) !== contentKey(other.answer)) report.categories.faq.contentMismatches.push({ key: faqKey(item), legacy: item.answer, canonical: other.answer });
  }
  for (const item of canonical) if (!legacyByKey.has(faqKey(item))) report.categories.faq.extra.push({ key: faqKey(item), canonical: item.answer });
}

/** Deterministic, side-effect-free comparison; callers retain legacy runtime authority. */
export function compareAssistantProjectionParity(input: { projectId: string; legacy: KnowledgePack; canonicalProjection: AssistantProjection; comparedAt?: string }): AssistantProjectionParityReport {
  const canonical = buildLegacyKnowledgePackFromAssistantProjection(input.canonicalProjection);
  const report: AssistantProjectionParityReport = { projectId: input.projectId, runtimeVersion: input.legacy.version, comparedAt: input.comparedAt ?? new Date().toISOString(), legacyCounts: { facts: facts(input.legacy).length, faqs: input.legacy.faq.length }, canonicalCounts: { facts: facts(canonical).length, faqs: canonical.faq.length }, mismatchSummary: { total: 0, major: 0, minor: 0 }, categories: { missingKnowledge: [], extraKnowledge: [], reviewStateDifferences: [], provenanceDifferences: [], faq: { missing: [], extra: [], contentMismatches: [] }, archivedLeakage: [], formattingDifferences: [] }, status: "MATCH" };
  compareFacts(facts(input.legacy), facts(canonical), input.canonicalProjection, report);
  compareFaqs(input.legacy.faq, canonical.faq, input.canonicalProjection, report);
  const major = report.categories.missingKnowledge.length + report.categories.extraKnowledge.length + report.categories.reviewStateDifferences.length + report.categories.faq.missing.length + report.categories.faq.extra.length + report.categories.faq.contentMismatches.length + report.categories.archivedLeakage.length;
  const minor = report.categories.provenanceDifferences.length + report.categories.formattingDifferences.length;
  report.mismatchSummary = { total: major + minor, major, minor };
  report.status = major ? "MAJOR_DIFFERENCE" : minor ? "MINOR_DIFFERENCE" : "MATCH";
  return report;
}
