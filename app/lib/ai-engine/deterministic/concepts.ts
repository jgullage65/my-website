import type { WebsiteKnowledgeFact } from "../knowledge/websiteKnowledge";
import type {
  BusinessConcept, ConceptHealth, DeterministicFact, MaterialConflict, NormalizedEvidence,
} from "./contracts";
import { confidenceLevel } from "./confidence";
import { keyText, stableId, uniqueBy } from "./util";

const CONCEPT_CATEGORIES = new Set<WebsiteKnowledgeFact["category"]>([
  "product", "service", "pricing_plan", "policy", "contact_information",
  "industry_served", "integration", "certification", "location_service_area",
]);

const ACRONYMS: Record<string, string> = {
  ai: "AI", api: "API", gdpr: "GDPR", hipaa: "HIPAA", iso: "ISO",
  seo: "SEO", sms: "SMS", soc: "SOC", sso: "SSO", ui: "UI", url: "URL",
};

const suffixByNamespace: Record<string, string> = {
  pricing_plan: "Plan",
  policy: "Policy",
};

function titleWord(word: string): string {
  const lower = word.toLowerCase();
  if (ACRONYMS[lower]) return ACRONYMS[lower]!;
  if (/^\d+$/.test(word)) return word;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Produces a UI label from canonical identity alone, never from mutable prose. */
export function conceptDisplayName(canonicalTopicIdentity: string): string {
  const separator = canonicalTopicIdentity.indexOf(":");
  const namespace = separator < 0 ? "" : canonicalTopicIdentity.slice(0, separator);
  const identity = separator < 0 ? canonicalTopicIdentity : canonicalTopicIdentity.slice(separator + 1);
  const base = identity.split("_").filter(Boolean).map(titleWord).join(" ") || "Unknown";
  const suffix = suffixByNamespace[namespace];
  return suffix && !base.toLowerCase().endsWith(` ${suffix.toLowerCase()}`) ? `${base} ${suffix}` : base;
}

function compareEvidence(left: NormalizedEvidence, right: NormalizedEvidence): number {
  return [left.url, left.sourceDocumentId ?? "", left.sourceBlockId ?? "", keyText(left.excerpt), left.provenance]
    .join("\0").localeCompare(
      [right.url, right.sourceDocumentId ?? "", right.sourceBlockId ?? "", keyText(right.excerpt), right.provenance].join("\0"),
    );
}

function evidenceIdentity(evidence: NormalizedEvidence): string {
  return [evidence.sourceBlockId ?? "", evidence.sourceDocumentId ?? "", evidence.url, keyText(evidence.excerpt), evidence.provenance].join("\0");
}

function sourceIdentity(evidence: NormalizedEvidence): string {
  return evidence.provenance === "owner" ? "owner" : evidence.sourceDocumentId ?? evidence.url;
}

function missingSignals(category: DeterministicFact["category"], facts: readonly DeterministicFact[]): string[] {
  const text = facts.map(fact => fact.value).join(" ");
  const signals: string[] = [];
  if (!facts.some(fact => fact.evidence.length > 0)) signals.push("missing_supporting_evidence");

  if (category === "pricing_plan") {
    if (!/(?:[$£€]\s?\d|\d+(?:\.\d+)?\s?(?:usd|gbp|eur)|\bfree\b)/i.test(text)) signals.push("missing_price");
    if (!/\b(?:per\s+(?:month|year|week|day)|monthly|annual(?:ly)?|yearly|weekly|daily|one[- ]time)\b/i.test(text)) signals.push("missing_billing_period");
    if (!/\b(?:includes?|features?|comes with)\b/i.test(text)) signals.push("missing_included_features");
  } else if (category === "policy") {
    if (!/\b(?:will|must|may|can|cannot|eligible|allowed|prohibited|refund(?:ed)?|return(?:ed)?|cancel(?:led|ed)?)\b/i.test(text)) signals.push("missing_effective_rule");
    if (!/\b(?:\d+\s*(?:business\s+)?(?:hours?|days?|weeks?|months?|years?)|immediately|at any time)\b/i.test(text)) signals.push("missing_timeframe");
    if (!/\b(?:if|when|unless|within|provided|requires?|eligible|condition|except)\b/i.test(text)) signals.push("missing_conditions");
  } else if (category === "contact_information") {
    if (!/(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|\+?\d[\d ().-]{7,}\d|https?:\/\/)/i.test(text)) signals.push("missing_contact_value");
    if (!/\b(?:support|sales|billing|general|contact|call|email|phone)\b/i.test(text)) signals.push("missing_contact_purpose");
  } else if (category === "location_service_area") {
    if (!/\b(?:located|based|office|address|in\s+[A-Z][\w.-]+)\b/.test(text)) signals.push("missing_location_name");
    if (!/\b(?:serves?|serving|service area|nationwide|worldwide|region|within|across)\b/i.test(text)) signals.push("missing_service_area_detail");
  } else if (category === "service" || category === "product") {
    if (!facts.some(fact => fact.value.trim().length >= 20)) signals.push("missing_description");
  }
  return signals;
}

/** Explicit health formula: confidence + bounded support bonuses - conflict/evidence penalties. */
function assessHealth(
  category: DeterministicFact["category"],
  facts: readonly DeterministicFact[],
  evidence: readonly NormalizedEvidence[],
  confidenceScore: number,
  conflicts: readonly MaterialConflict[],
): ConceptHealth {
  const sourceCount = new Set(evidence.map(sourceIdentity)).size;
  const ownerSupported = facts.some(fact => fact.provenance === "owner");
  const websiteSupported = facts.some(fact => fact.provenance === "website");
  const mixedSourceSupport = ownerSupported && websiteSupported;
  const unresolvedConflictIds = conflicts.map(conflict => conflict.id).sort();
  const missing = missingSignals(category, facts);
  const hasConflicts = unresolvedConflictIds.length > 0;
  let score = confidenceScore;
  if (sourceCount >= 2) score += 8;
  if (facts.length >= 2) score += 4;
  if (mixedSourceSupport && !hasConflicts) score += 6;
  if (sourceCount === 1) score -= 10;
  if (sourceCount === 0) score -= 20;
  score -= Math.min(45, unresolvedConflictIds.length * 30);
  score -= Math.min(12, missing.length * 4);
  score = Math.max(0, Math.min(100, Math.round(score)));

  const reasons: string[] = [];
  if (sourceCount >= 2) reasons.push("multi_source_support");
  else if (sourceCount === 1) reasons.push("single_source_only");
  if (ownerSupported) reasons.push("owner_supported");
  if (websiteSupported) reasons.push("website_supported");
  if (mixedSourceSupport && !hasConflicts) reasons.push("mixed_source_agreement");
  if (websiteSupported && !ownerSupported) reasons.push("missing_owner_confirmation");
  if (hasConflicts) reasons.push("unresolved_conflict");
  if (confidenceScore < 52) reasons.push("low_confidence");
  if (missing.length > 0) reasons.push("incomplete_evidence");
  if (confidenceScore >= 78 && sourceCount >= 2 && !hasConflicts && missing.length === 0) reasons.push("strong_evidence");

  const status = hasConflicts || confidenceScore < 52 || score < 50
    ? "needs_attention"
    : score >= 75 && sourceCount >= 2 && missing.length === 0
      ? "strong"
      : "review_recommended";
  const reviewPriority = status === "needs_attention" ? "high" : status === "strong" ? "low" : "medium";
  return {
    status, score, confidence: confidenceLevel(confidenceScore),
    supportingFactCount: facts.length, supportingSourceCount: sourceCount,
    ownerSupported, websiteSupported, mixedSourceSupport,
    conflictCount: unresolvedConflictIds.length, hasConflicts, unresolvedConflictIds,
    reviewPriority, reasons, missingSignals: missing,
  };
}

/** Additive, deterministic projection over facts. Facts remain untouched and authoritative. */
export function assembleBusinessConcepts(
  facts: readonly DeterministicFact[],
  conflicts: readonly MaterialConflict[] = [],
): BusinessConcept[] {
  const grouped = new Map<string, DeterministicFact[]>();
  for (const fact of facts) {
    if (!CONCEPT_CATEGORIES.has(fact.category)) continue;
    const group = grouped.get(fact.topicKey) ?? [];
    group.push(fact);
    grouped.set(fact.topicKey, group);
  }

  return Array.from(grouped.entries()).map(([canonicalTopicIdentity, group]) => {
    const supportingFacts = [...group].sort((a, b) => a.id.localeCompare(b.id));
    const supportingEvidence = uniqueBy(
      supportingFacts.flatMap(fact => fact.evidence.map(evidence => ({ ...evidence }))),
      evidenceIdentity,
    ).sort(compareEvidence);
    // This is only an aggregate of the facts' existing scores; extraction scoring is unchanged.
    const confidenceScore = Math.round(
      supportingFacts.reduce((total, fact) => total + fact.confidenceScore, 0) / supportingFacts.length,
    );
    const conceptConflicts = conflicts.filter(conflict => conflict.topicKey === canonicalTopicIdentity);
    return {
      id: stableId("business_concept", canonicalTopicIdentity),
      canonicalTopicIdentity,
      category: supportingFacts[0]!.category,
      displayName: conceptDisplayName(canonicalTopicIdentity),
      supportingFactIds: supportingFacts.map(fact => fact.id),
      supportingEvidence,
      overallConfidence: confidenceLevel(confidenceScore),
      confidenceScore,
      supportingSourceCount: new Set(supportingEvidence.map(sourceIdentity)).size,
      firstSeenSource: supportingEvidence[0]!,
      lastSeenSource: supportingEvidence[supportingEvidence.length - 1]!,
      ownerKnowledgeContributes: supportingFacts.some(fact => fact.provenance === "owner"),
      websiteKnowledgeContributes: supportingFacts.some(fact => fact.provenance === "website"),
      health: assessHealth(
        supportingFacts[0]!.category, supportingFacts, supportingEvidence, confidenceScore, conceptConflicts,
      ),
    };
  }).sort((a, b) => a.canonicalTopicIdentity.localeCompare(b.canonicalTopicIdentity));
}
