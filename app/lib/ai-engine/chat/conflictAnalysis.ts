import type { AssistantProjection, AssistantProjectionEvidence, AssistantProjectionRelationship, AssistantProjectionSource } from "../assistant-projection/contracts";
import type { StructuredCanonicalRetrievalItem, StructuredCanonicalRetrievalResult } from "./structuredCanonicalRetrieval";

type CanonicalItem = Extract<StructuredCanonicalRetrievalItem["item"], { reviewState: string }>;
export type CanonicalCitationChain = { projectionItemId: string; assertionId: string | null; predecessorAssertionId: string | null; evidenceIds: string[]; sourceIds: string[]; relationshipIds: string[]; provenance: StructuredCanonicalRetrievalItem["provenance"]; projectionVersion: number; schemaVersion: number; projectionItem: StructuredCanonicalRetrievalItem; assertion: CanonicalItem | null; predecessorAssertion: CanonicalItem | null; evidence: AssistantProjectionEvidence[]; sources: AssistantProjectionSource[]; relationships: AssistantProjectionRelationship[] };
export type ConflictGroup = { topic: string; category: StructuredCanonicalRetrievalItem["category"]; assertionIds: string[]; resolution: "authoritative" | "unresolved" | "identical"; selectedAssertionId: string | null };
export type ConflictAnalysis = { historyIntent: boolean; answerItems: StructuredCanonicalRetrievalItem[]; unresolvedItems: StructuredCanonicalRetrievalItem[]; citationChains: CanonicalCitationChain[]; conflictGroups: ConflictGroup[]; unresolvedConflictGroups: ConflictGroup[]; authoritativeResolutions: ConflictGroup[]; correctedAssertionsSelected: string[]; predecessorsSuppressed: string[]; provenanceSummary: string[]; diagnostics: { conflictGroupCount: number; authoritativeResolutionCount: number; unresolvedConflictCount: number; correctedAssertionCount: number; predecessorSuppressedCount: number; citationCount: number; evidenceCount: number; sourceCount: number } };

const authority: Record<string, number> = { generated: 1, observed: 2, provided: 3, confirmed: 4, corrected: 5 };
const historyPattern = /\b(history|historical|what changed|previous|old|before correction|original)\b/i;
const normalize = (value: string) => value.toLowerCase().replace(/\b(the|a|an|our|your|policy|faq|rule|restriction|information)\b/g, " ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const item = (value: StructuredCanonicalRetrievalItem): CanonicalItem | null => "reviewState" in value.item ? value.item as CanonicalItem : null;
const statement = (value: StructuredCanonicalRetrievalItem) => "instruction" in value.item ? value.item.instruction : "value" in value.item ? value.item.value : "";
/** Topic keys are deterministic canonical metadata: category, linkage, title/aliases, then normalized restriction subject. */
function topicFor(value: StructuredCanonicalRetrievalItem): string {
  const canonical = item(value);
  const category = value.category === "faq" ? "faq" : value.category;
  if (canonical && value.category !== "restriction" && "title" in canonical) return `${category}:topic:${normalize([canonical.title, ...canonical.aliases].join(" ")) || value.projectionItemId}`;
  const relatedEntity = value.relatedEntityIds.slice().sort()[0];
  if (relatedEntity) return `${category}:entity:${relatedEntity}`;
  // Restriction wording is reduced only to a deterministic subject; opposite modal/negation wording stays in the value comparison.
  const subject = normalize(statement(value).replace(/\b(do not|don t|never|must not|may|can|allowed|prohibited|promise|guarantee)\b/g, "")).split(" ").filter(Boolean).slice(-2).join(" ");
  if (subject) return `${category}:topic:${subject}`;
  const linked = value.relatedAssertionIds.slice().sort()[0];
  return `${category}:link:${linked ?? value.projectionItemId}`;
}
function provenanceSummary(items: StructuredCanonicalRetrievalItem[], sources: Map<string, AssistantProjectionSource>) {
  if (items.some(value => value.provenance?.correctedAt || item(value)?.reviewState === "corrected")) return "Based on corrected business information.";
  const origins = new Set(items.flatMap(value => value.sourceIds.map(id => sources.get(id)?.origin).filter((origin): origin is string => !!origin)));
  if (origins.size > 1) return "Based on multiple reviewed sources.";
  if (origins.has("manual_intake") || origins.has("user_edit")) return "Based on manually reviewed business knowledge.";
  if (origins.has("website")) return "Based on reviewed website information.";
  return "Based on reviewed business information.";
}

/** Resolves only already-selected structured retrieval; no data is loaded or retrieved here. */
export function analyzeCanonicalConflicts(projection: AssistantProjection, retrieved: StructuredCanonicalRetrievalResult, message: string): ConflictAnalysis {
  const historyIntent = historyPattern.test(message), grouped = new Map<string, StructuredCanonicalRetrievalItem[]>();
  for (const value of retrieved.items) if (item(value)) grouped.set(topicFor(value), [...(grouped.get(topicFor(value)) ?? []), value]);
  const answer = new Set<StructuredCanonicalRetrievalItem>(), unresolved = new Set<StructuredCanonicalRetrievalItem>(), conflictGroups: ConflictGroup[] = [], correctedAssertionsSelected: string[] = [], predecessorsSuppressed: string[] = [];
  for (const value of retrieved.items) if (!item(value)) answer.add(value);
  for (const [topic, values] of Array.from(grouped.entries())) {
    const corrected = values.filter(value => item(value)!.reviewState === "corrected" || item(value)!.authority === "corrected");
    const superseded = new Set(corrected.map(value => value.predecessorAssertionId).filter((id): id is string => !!id));
    const candidates = historyIntent ? values : values.filter(value => !superseded.has(value.assertionId ?? ""));
    if (!historyIntent) superseded.forEach(id => predecessorsSuppressed.push(id));
    const candidateValues = new Set(candidates.map(statement).map(normalize));
    const highest = Math.max(...candidates.map(value => authority[item(value)!.authority ?? (item(value)!.reviewState === "corrected" ? "corrected" : "confirmed")] ?? 0));
    const leaders = candidates.filter(value => (authority[item(value)!.authority ?? (item(value)!.reviewState === "corrected" ? "corrected" : "confirmed")] ?? 0) === highest);
    let resolution: ConflictGroup["resolution"] = candidateValues.size <= 1 ? "identical" : new Set(leaders.map(statement).map(normalize)).size === 1 ? "authoritative" : "unresolved";
    if (!historyIntent && corrected.length && candidateValues.size > 1) resolution = "authoritative";
    const selected = resolution === "unresolved" ? null : (!historyIntent && corrected[0] ? corrected[0] : leaders[0]);
    if (historyIntent) candidates.forEach(value => answer.add(value)); else if (selected) answer.add(selected); else candidates.forEach(value => unresolved.add(value));
    if (selected && item(selected)!.reviewState === "corrected") correctedAssertionsSelected.push(selected.assertionId!);
    if (values.length > 1 || candidateValues.size > 1) conflictGroups.push({ topic, category: values[0].category, assertionIds: values.map(value => value.assertionId!).sort(), resolution, selectedAssertionId: selected?.assertionId ?? null });
  }
  const answerItems = retrieved.items.filter(value => answer.has(value));
  const allCanonical = [...projection.services, ...projection.products, ...projection.pricing, ...projection.policies, ...projection.faqs, ...projection.restrictions];
  const byAssertion = new Map(allCanonical.map(value => ["assertionId" in value ? value.assertionId : value.relatedAssertionIds[0], value]));
  const evidence = new Map(projection.evidence.map(value => [value.id, value])), sources = new Map(projection.sources.map(value => [value.id, value])), relationships = new Map(projection.relationships.map(value => [value.id, value]));
  const citationChains = answerItems.map(value => ({ projectionItemId: value.projectionItemId, assertionId: value.assertionId, predecessorAssertionId: value.predecessorAssertionId, evidenceIds: [...value.evidenceIds], sourceIds: [...value.sourceIds], relationshipIds: [...value.relationshipIds], provenance: value.provenance, projectionVersion: projection.projectionVersion, schemaVersion: projection.schemaVersion, projectionItem: value, assertion: item(value), predecessorAssertion: value.predecessorAssertionId ? byAssertion.get(value.predecessorAssertionId) as CanonicalItem ?? null : null, evidence: value.evidenceIds.map(id => evidence.get(id)).filter((x): x is AssistantProjectionEvidence => !!x), sources: value.sourceIds.map(id => sources.get(id)).filter((x): x is AssistantProjectionSource => !!x), relationships: value.relationshipIds.map(id => relationships.get(id)).filter((x): x is AssistantProjectionRelationship => !!x) }));
  const unresolvedConflictGroups = conflictGroups.filter(group => group.resolution === "unresolved"), authoritativeResolutions = conflictGroups.filter(group => group.resolution === "authoritative");
  return { historyIntent, answerItems, unresolvedItems: retrieved.items.filter(value => unresolved.has(value)), citationChains, conflictGroups, unresolvedConflictGroups, authoritativeResolutions, correctedAssertionsSelected, predecessorsSuppressed: Array.from(new Set(predecessorsSuppressed)).sort(), provenanceSummary: [provenanceSummary(answerItems, sources)], diagnostics: { conflictGroupCount: conflictGroups.length, authoritativeResolutionCount: authoritativeResolutions.length, unresolvedConflictCount: unresolvedConflictGroups.length, correctedAssertionCount: correctedAssertionsSelected.length, predecessorSuppressedCount: new Set(predecessorsSuppressed).size, citationCount: citationChains.length, evidenceCount: new Set(citationChains.flatMap(chain => chain.evidenceIds)).size, sourceCount: new Set(citationChains.flatMap(chain => chain.sourceIds)).size } };
}
