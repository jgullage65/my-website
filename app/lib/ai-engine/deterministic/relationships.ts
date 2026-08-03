import type { BusinessConcept, ConceptRelationship, ConceptRelationshipReasonCode, ConceptRelationshipType, DeterministicFact, MaterialConflict, NormalizedEvidence } from "./contracts";
import { confidenceLevel } from "./confidence";
import { keyText, stableId, uniqueBy } from "./util";

type Category = DeterministicFact["category"];
type Rule = { source: Category; target: Category; type: ConceptRelationshipType; reason: ConceptRelationshipReasonCode; connector: RegExp };

// Intentionally closed and narrow. A category pair without an explicit rule cannot produce an edge.
const RULES: readonly Rule[] = [
  ...(["product", "service"] as const).map(target => ({ source: "pricing_plan" as const, target, type: "includes" as const, reason: "explicit_inclusion" as const, connector: /\b(?:includes?|included|features?|comes?\s+with)\b/i })),
  { source: "product", target: "integration", type: "integrates_with", reason: "explicit_integration", connector: /\bintegrat(?:es?|ed|ion)\s+(?:with\s+)?\b/i },
  ...(["product", "service"] as const).flatMap(source => ([
    { source, target: "industry_served" as const, type: "serves" as const, reason: "explicit_customer_segment" as const, connector: /\b(?:serves?|serving|built|designed)\s+(?:for\s+)?\b/i },
    ...(source === "service" ? [{ source, target: "location_service_area" as const, type: "available_in" as const, reason: "explicit_service_area" as const, connector: /\b(?:available|offered|provided)\s+(?:in|across|throughout)\b/i }] : []),
    { source, target: "pricing_plan" as const, type: "belongs_to" as const, reason: "explicit_plan_membership" as const, connector: /\b(?:part\s+of|belongs?\s+to|available\s+(?:on|with)|included\s+in)\b/i },
  ])),
  ...(["pricing_plan", "product", "service"] as const).map(target => ({ source: "policy" as const, target, type: "applies_to" as const, reason: "explicit_policy_scope" as const, connector: /\b(?:appl(?:y|ies|ied)\s+to|covers?|governs?)\b/i })),
  ...(["policy", "pricing_plan", "product", "service"] as const).map(target => ({ source: "contact_information" as const, target, type: "contact_for" as const, reason: "explicit_support_purpose" as const, connector: /\b(?:contact|email|call|handles?|for|support(?:s|ing)?)\b/i })),
  ...(["service", "product"] as const).map(target => ({ source: "location_service_area" as const, target, type: "serves" as const, reason: "explicit_service_area" as const, connector: /\b(?:serves?|serving|provides?|offers?)\b/i })),
];

const evidenceKey = (e: NormalizedEvidence) => [e.sourceBlockId ?? "", e.sourceDocumentId ?? "", e.url, keyText(e.excerpt), e.provenance].join("\0");
const sourceKey = (e: NormalizedEvidence) => e.provenance === "owner" ? "owner" : e.sourceDocumentId ?? e.url;
const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function names(concept: BusinessConcept, facts: ReadonlyMap<string, DeterministicFact>): string[] {
  const identity = concept.canonicalTopicIdentity.split(":").slice(1).join(":").replace(/_/g, " ");
  return Array.from(new Set([concept.displayName, identity, ...concept.supportingFactIds.map(id => facts.get(id)?.title ?? "")].map(keyText).filter(value => value.length >= 2))).sort();
}
function explicitlyConnects(text: string, sourceNames: string[], targetNames: string[], connector: RegExp): boolean {
  const namePattern = (values: string[]) => `(?:${values.map(value => escaped(value).replace(/ /g, "\\s+")).join("|")})`;
  // Requiring source -> connector -> target in one short span prevents page, heading,
  // or paragraph co-occurrence from becoming a relationship.
  return new RegExp(`(?<![a-z0-9])${namePattern(sourceNames)}(?![a-z0-9])[\\s\\S]{0,120}?${connector.source}[\\s\\S]{0,120}?(?<![a-z0-9])${namePattern(targetNames)}(?![a-z0-9])`, "i").test(text);
}

/** Conservative projection over existing facts and concepts; it never creates endpoints. */
export function assembleConceptRelationships(facts: readonly DeterministicFact[], concepts: readonly BusinessConcept[], conflicts: readonly MaterialConflict[] = []): ConceptRelationship[] {
  const factById = new Map(facts.map(fact => [fact.id, fact]));
  const groups = new Map<string, { rule: Rule; source: BusinessConcept; target: BusinessConcept; facts: DeterministicFact[] }>();
  for (const source of concepts) for (const target of concepts) {
    if (source.id === target.id) continue;
    const rule = RULES.find(item => item.source === source.category && item.target === target.category);
    if (!rule) continue;
    const sourceNames = names(source, factById), targetNames = names(target, factById);
    for (const factId of source.supportingFactIds) {
      const fact = factById.get(factId); if (!fact || !fact.explicit) continue;
      const statements = [fact.title, fact.value, ...fact.evidence.map(item => item.excerpt)];
      if (!statements.some(text => explicitlyConnects(text, sourceNames, targetNames, rule.connector))) continue;
      const key = [rule.type, source.canonicalTopicIdentity, target.canonicalTopicIdentity].join("\0");
      const group = groups.get(key) ?? { rule, source, target, facts: [] };
      if (!group.facts.some(item => item.id === fact.id)) group.facts.push(fact);
      groups.set(key, group);
    }
  }
  return Array.from(groups.values()).map(group => {
    const supportingFacts = group.facts.sort((a, b) => a.id.localeCompare(b.id));
    const evidence = uniqueBy(supportingFacts.flatMap(fact => fact.evidence.map(item => ({ ...item }))), evidenceKey)
      .sort((a, b) => evidenceKey(a).localeCompare(evidenceKey(b)));
    const sources = new Set(evidence.map(sourceKey));
    const affected = conflicts.some(conflict => conflict.topicKey === group.source.canonicalTopicIdentity || conflict.topicKey === group.target.canonicalTopicIdentity || conflict.factIds.some(id => supportingFacts.some(fact => fact.id === id)));
    let score = Math.round(supportingFacts.reduce((sum, fact) => sum + fact.confidenceScore, 0) / supportingFacts.length);
    if (supportingFacts.length > 1) score += 4;
    if (sources.size > 1) score += 8;
    if (affected) score -= 25;
    score = Math.max(0, Math.min(100, score));
    const reasons: ConceptRelationshipReasonCode[] = [group.rule.reason];
    if (evidence.some(item => item.provenance === "owner")) reasons.push("owner_supported");
    if (evidence.some(item => item.provenance === "website")) reasons.push("website_supported");
    if (sources.size > 1) reasons.push("multi_source_support");
    if (affected) reasons.push("affected_by_conflict");
    return { id: stableId("concept_relationship", [group.rule.type, group.source.canonicalTopicIdentity, group.target.canonicalTopicIdentity].join("\0")), type: group.rule.type, sourceConceptId: group.source.id, targetConceptId: group.target.id, sourceTopicIdentity: group.source.canonicalTopicIdentity, targetTopicIdentity: group.target.canonicalTopicIdentity, supportingFactIds: supportingFacts.map(fact => fact.id), supportingEvidence: evidence, confidence: confidenceLevel(score), confidenceScore: score, explicit: true as const, reasonCodes: reasons };
  }).sort((a, b) => a.id.localeCompare(b.id));
}
