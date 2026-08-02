import type { WebsiteKnowledgeFact } from "../knowledge/websiteKnowledge";
import type { BusinessConcept, DeterministicFact, NormalizedEvidence } from "./contracts";
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

/** Additive, deterministic projection over facts. Facts remain untouched and authoritative. */
export function assembleBusinessConcepts(facts: readonly DeterministicFact[]): BusinessConcept[] {
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
    };
  }).sort((a, b) => a.canonicalTopicIdentity.localeCompare(b.canonicalTopicIdentity));
}
