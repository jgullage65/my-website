import type { AssistantProjection } from "../assistant-projection/contracts";
import type { StructuredCanonicalRetrievalItem, StructuredCanonicalRetrievalResult } from "./structuredCanonicalRetrieval";

type CanonicalTextItem = Extract<StructuredCanonicalRetrievalItem["item"], { assertionId: string }>;
export type CanonicalCitationChain = { projectionItemId: string; assertionId: string | null; predecessorAssertionId: string | null; evidenceIds: string[]; sourceIds: string[]; relationshipIds: string[]; provenance: StructuredCanonicalRetrievalItem["provenance"]; projectionVersion: number; schemaVersion: number };
export type ConflictGroup = { topic: string; category: StructuredCanonicalRetrievalItem["category"]; assertionIds: string[]; resolution: "authoritative" | "unresolved" | "identical"; selectedAssertionId: string | null };
export type ConflictAnalysis = { historyIntent: boolean; answerItems: StructuredCanonicalRetrievalItem[]; citationChains: CanonicalCitationChain[]; conflictGroups: ConflictGroup[]; unresolvedConflictGroups: ConflictGroup[]; authoritativeResolutions: ConflictGroup[]; correctedAssertionsSelected: string[]; predecessorsSuppressed: string[]; provenanceSummary: string[]; diagnostics: { conflictGroupCount: number; authoritativeResolutionCount: number; unresolvedConflictCount: number; correctedAssertionCount: number; predecessorSuppressedCount: number; citationCount: number; evidenceCount: number; sourceCount: number } };

const authority: Record<string, number> = { generated: 1, observed: 2, provided: 3, confirmed: 4, corrected: 5 };
const historyPattern = /\b(history|historical|what changed|previous|old|before correction|original)\b/i;
const normalized = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
const text = (item: StructuredCanonicalRetrievalItem): CanonicalTextItem | null => "authority" in item.item ? item.item as CanonicalTextItem : null;
const topicFor = (item: StructuredCanonicalRetrievalItem) => `${item.category}:${item.entityId ?? (text(item)?.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() ?? item.projectionItemId)}`;
const provenanceSummary = (items: StructuredCanonicalRetrievalItem[]) => {
  const corrected = items.some(item => item.provenance?.correctedAt);
  const origins = new Set(items.flatMap(item => item.sourceIds));
  if (corrected) return "Based on corrected business information.";
  if (origins.size > 1) return "Based on multiple reviewed sources.";
  return "Based on reviewed business information.";
};

/** Resolves only the already-selected retrieval result; it never loads or retrieves data. */
export function analyzeCanonicalConflicts(projection: AssistantProjection, retrieved: StructuredCanonicalRetrievalResult, message: string): ConflictAnalysis {
  const historyIntent = historyPattern.test(message);
  const grouped = new Map<string, StructuredCanonicalRetrievalItem[]>();
  for (const item of retrieved.items) {
    if (!text(item)) continue;
    const key = topicFor(item); grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  const conflictGroups: ConflictGroup[] = [], answer = new Set<StructuredCanonicalRetrievalItem>();
  const correctedAssertionsSelected: string[] = [], predecessorsSuppressed: string[] = [];
  for (const item of retrieved.items) if (!text(item)) answer.add(item);
  for (const [topic, items] of Array.from(grouped.entries())) {
    const category = items[0].category;
    const values = new Set(items.map(item => normalized(text(item)!.value)));
    const corrected = items.filter(item => text(item)!.authority === "corrected" || text(item)!.reviewState === "corrected");
    const superseded = new Set(corrected.map(item => item.predecessorAssertionId).filter((id): id is string => !!id));
    const candidates = historyIntent ? items : items.filter(item => !superseded.has(item.assertionId ?? ""));
    for (const id of Array.from(superseded)) if (!historyIntent) predecessorsSuppressed.push(id);
    const candidateValues = new Set(candidates.map(item => normalized(text(item)!.value)));
    const maxAuthority = Math.max(...candidates.map(item => authority[text(item)!.authority] ?? 0));
    const leaders = candidates.filter(item => (authority[text(item)!.authority] ?? 0) === maxAuthority);
    const leaderValues = new Set(leaders.map(item => normalized(text(item)!.value)));
    let resolution: ConflictGroup["resolution"] = candidateValues.size <= 1 ? "identical" : leaderValues.size === 1 ? "authoritative" : "unresolved";
    // A corrected revision is authoritative over its explicit predecessor even if the predecessor had a higher legacy rank.
    if (!historyIntent && corrected.length && values.size > 1) resolution = "authoritative";
    const selected = resolution === "unresolved" ? null : (corrected[0] && !historyIntent ? corrected[0] : leaders[0]);
    if (historyIntent) candidates.forEach(item => answer.add(item)); else if (selected) answer.add(selected);
    if (selected && (text(selected)!.authority === "corrected" || text(selected)!.reviewState === "corrected")) correctedAssertionsSelected.push(selected.assertionId!);
    if (items.length > 1 || values.size > 1) conflictGroups.push({ topic, category, assertionIds: items.map(item => item.assertionId!).sort(), resolution, selectedAssertionId: selected?.assertionId ?? null });
  }
  const answerItems = retrieved.items.filter(item => answer.has(item));
  const citationChains = answerItems.map(item => ({ projectionItemId: item.projectionItemId, assertionId: item.assertionId, predecessorAssertionId: item.predecessorAssertionId, evidenceIds: [...item.evidenceIds], sourceIds: [...item.sourceIds], relationshipIds: [...item.relationshipIds], provenance: item.provenance, projectionVersion: projection.projectionVersion, schemaVersion: projection.schemaVersion }));
  const unresolvedConflictGroups = conflictGroups.filter(group => group.resolution === "unresolved");
  const authoritativeResolutions = conflictGroups.filter(group => group.resolution === "authoritative");
  return { historyIntent, answerItems, citationChains, conflictGroups, unresolvedConflictGroups, authoritativeResolutions, correctedAssertionsSelected, predecessorsSuppressed: Array.from(new Set(predecessorsSuppressed)).sort(), provenanceSummary: [provenanceSummary(answerItems)], diagnostics: { conflictGroupCount: conflictGroups.length, authoritativeResolutionCount: authoritativeResolutions.length, unresolvedConflictCount: unresolvedConflictGroups.length, correctedAssertionCount: correctedAssertionsSelected.length, predecessorSuppressedCount: new Set(predecessorsSuppressed).size, citationCount: citationChains.length, evidenceCount: new Set(citationChains.flatMap(chain => chain.evidenceIds)).size, sourceCount: new Set(citationChains.flatMap(chain => chain.sourceIds)).size } };
}
