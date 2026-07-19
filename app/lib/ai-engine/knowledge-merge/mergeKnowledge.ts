import type { AssertionAuthority, BusinessAssertion, BusinessMemory, Confidence, ReviewState } from "../business-memory/contracts";
import type { BusinessMemoryAssertionAdapter, CanonicalAssertionIdentityAdapter, KnowledgeMergeCandidate, KnowledgeMergeGroup, KnowledgeMergeInput, KnowledgeMergeResult, MergeDecisionReason } from "./contracts";

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const uniqueSorted = (values: string[]) => Array.from(new Set(values)).sort(compare);
export const normalizeMergeValue = (value: string): string => value.replace(/\s+/g, " ").trim().toLowerCase();
/** Reviewed workflow state is intentionally ranked separately from authority. */
export const reviewStateRank: Record<ReviewState, number> = { proposed: 0, archived: 1, approved: 3, corrected: 4 };
export const authorityRank: Record<AssertionAuthority, number> = { generated: 0, observed: 1, provided: 2, confirmed: 3, corrected: 4 };
export const confidenceRank: Record<Confidence["level"], number> = { low: 0, medium: 1, high: 2 };
const state = (candidate: KnowledgeMergeCandidate): ReviewState => candidate.reviewState ?? "proposed";
const authority = (candidate: KnowledgeMergeCandidate): AssertionAuthority | null => candidate.authority ?? null;
const reviewed = (candidate: KnowledgeMergeCandidate) => state(candidate) === "approved" || state(candidate) === "corrected";
const evidenceCoverage = (candidate: KnowledgeMergeCandidate) => uniqueSorted(candidate.evidence.map((item) => item.id)).length;
const compareRank = (left: number, right: number) => left - right;

/** Each helper is one documented policy step, ordered in compareCandidatesByPolicy. */
const compareReviewedState = (left: KnowledgeMergeCandidate, right: KnowledgeMergeCandidate) => compareRank(Number(reviewed(left)), Number(reviewed(right)));
const compareCorrectionState = (left: KnowledgeMergeCandidate, right: KnowledgeMergeCandidate) => compareRank(Number(state(left) === "corrected"), Number(state(right) === "corrected"));
const hasManualAuthority = (candidate: KnowledgeMergeCandidate) => authority(candidate) === "corrected" || authority(candidate) === "confirmed" || candidate.sourceOrigins.some((origin) => origin === "manual_intake" || origin === "user_edit");
const compareManualAuthority = (left: KnowledgeMergeCandidate, right: KnowledgeMergeCandidate) => compareRank(Number(hasManualAuthority(left)), Number(hasManualAuthority(right)));
const compareReviewLifecycle = (left: KnowledgeMergeCandidate, right: KnowledgeMergeCandidate) => compareRank(Number(state(left) !== "archived"), Number(state(right) !== "archived"));
const compareAuthority = (left: KnowledgeMergeCandidate, right: KnowledgeMergeCandidate) => compareRank(authority(left) ? authorityRank[authority(left)!] : -1, authority(right) ? authorityRank[authority(right)!] : -1);
const compareConfidence = (left: KnowledgeMergeCandidate, right: KnowledgeMergeCandidate) => compareRank(confidenceRank[left.confidence.level], confidenceRank[right.confidence.level]);
const compareEvidenceCoverage = (left: KnowledgeMergeCandidate, right: KnowledgeMergeCandidate) => compareRank(evidenceCoverage(left), evidenceCoverage(right));

const policyComparators = [
  ["reviewed_human_decision", compareReviewedState],
  ["corrected_review", compareCorrectionState],
  ["manual_authority", compareManualAuthority],
  ["active_review_state", compareReviewLifecycle],
  ["authority", compareAuthority],
  ["confidence", compareConfidence],
  ["evidence_coverage", compareEvidenceCoverage],
] as const;
function compareCandidatesByPolicy(left: KnowledgeMergeCandidate, right: KnowledgeMergeCandidate): { result: number; reasonCode: string | null } {
  for (const [reasonCode, comparator] of policyComparators) {
    const result = comparator(left, right);
    if (result !== 0) return { result, reasonCode };
  }
  return { result: 0, reasonCode: null };
}
const policySort = (left: KnowledgeMergeCandidate, right: KnowledgeMergeCandidate) => {
  const result = compareCandidatesByPolicy(left, right).result;
  return result === 0 ? compare(left.assertionId, right.assertionId) : -result;
};
const candidateKey = (candidate: KnowledgeMergeCandidate) => `${candidate.assertionId}\u0000${candidate.entityId}\u0000${normalizeMergeValue(candidate.value)}`;
const candidateSort = (left: KnowledgeMergeCandidate, right: KnowledgeMergeCandidate) => compare(candidateKey(left), candidateKey(right));
export const canonicalAssertionIdentity: CanonicalAssertionIdentityAdapter = (assertion) => assertion.legacyEntryId ?? assertion.id;
export const adaptBusinessMemoryAssertions: BusinessMemoryAssertionAdapter = (memory) => {
  const entities = new Map(memory.entities.map((entity) => [entity.id, entity]));
  const sources = new Map(memory.sources.map((source) => [source.id, source]));
  const evidence = new Map(memory.evidence.map((item) => [item.id, item]));
  return memory.assertions.map((assertion): KnowledgeMergeCandidate | null => {
    const entity = entities.get(assertion.entityId); if (!entity) return null;
    const sourceIds = uniqueSorted(assertion.sourceIds.filter((id) => sources.has(id)));
    const records = assertion.evidenceIds.map((id) => evidence.get(id)).filter((item): item is NonNullable<typeof item> => item !== undefined).map((item) => {
      const source = sources.get(item.sourceId); return source ? { id: item.id, sourceId: item.sourceId, sourceOrigin: source.origin, sourceUrl: source.url, excerpt: item.excerpt, crawlAttemptId: source.crawlAttemptId, capturedAt: item.capturedAt } : null;
    }).filter((item): item is NonNullable<typeof item> => item !== null).sort((a, b) => compare(a.id, b.id));
    const sourceRecords = sourceIds.map((id) => sources.get(id)!);
    return { canonicalIdentity: canonicalAssertionIdentity(assertion), assertionId: assertion.id, entityCanonicalIdentity: entity.id, entityId: entity.id, entityType: entity.type, entityName: entity.name, value: assertion.value, confidence: assertion.confidence, reviewState: assertion.reviewState, authority: assertion.authority, sourceOrigins: uniqueSorted(sourceRecords.map((source) => source.origin)) as KnowledgeMergeCandidate["sourceOrigins"], sourceIds, evidence: records, crawlAttemptIds: uniqueSorted(sourceRecords.map((source) => source.crawlAttemptId).filter((id): id is string => id !== null)), originatingAssertionId: assertion.legacyEntryId };
  }).filter((item): item is KnowledgeMergeCandidate => item !== null).sort(candidateSort);
};
function reasons(winner: KnowledgeMergeCandidate, loser?: KnowledgeMergeCandidate): MergeDecisionReason[] {
  if (!loser) return [{ code: "only_candidate", detail: "Only one candidate represents this canonical assertion identity." }];
  const reasonCode = compareCandidatesByPolicy(winner, loser).reasonCode;
  if (!reasonCode) return [{ code: "equal_meaningful_precedence", detail: "Meaningful decision fields tied; stable IDs only order candidates and cannot establish business truth." }];
  return [{ code: reasonCode, detail: `Selected ${winner.assertionId} because its ${reasonCode.replace(/_/g, " ")} outranks ${loser.assertionId}.` }];
}
function group(canonicalIdentity: string, raw: KnowledgeMergeCandidate[]): KnowledgeMergeGroup {
  const candidates = raw.slice().sort(candidateSort); const values = uniqueSorted(candidates.map((item) => normalizeMergeValue(item.value)));
  const entityCanonicalIdentity = candidates.map((item) => item.entityCanonicalIdentity).sort(compare)[0] ?? "";
  const shared = { canonicalIdentity, entityCanonicalIdentity, candidates, contributingSourceOrigins: uniqueSorted(candidates.flatMap((item) => item.sourceOrigins)) as KnowledgeMergeCandidate["sourceOrigins"], contributingAssertionIds: uniqueSorted(candidates.map((item) => item.assertionId)), contributingSourceIds: uniqueSorted(candidates.flatMap((item) => item.sourceIds)), contributingEvidenceIds: uniqueSorted(candidates.flatMap((item) => item.evidence.map((evidence) => evidence.id))) };
  if (candidates.length === 1) return { ...shared, classification: "single", selectedCandidate: candidates[0], supportingCandidates: candidates, conflictingCandidates: [], decisionReasons: reasons(candidates[0]), requiresReview: false };
  if (values.length === 1) { const selected = candidates.slice().sort(policySort)[0]; return { ...shared, classification: "agreement", selectedCandidate: selected, supportingCandidates: candidates, conflictingCandidates: [], decisionReasons: [{ code: "normalized_value_agreement", detail: "All candidates have the same conservatively normalized value." }], requiresReview: false }; }
  const ordered = candidates.slice().sort(policySort); const winner = ordered[0], runnerUp = ordered[1];
  if (compareCandidatesByPolicy(winner, runnerUp).result === 0) return { ...shared, classification: "unresolved_conflict", selectedCandidate: null, supportingCandidates: [], conflictingCandidates: candidates, decisionReasons: [{ code: "equal_meaningful_precedence_conflict", detail: "Conflicting assertions have equal meaningful decision fields; stable IDs only order candidates and cannot establish business truth." }], requiresReview: true };
  return { ...shared, classification: "conflict", selectedCandidate: winner, supportingCandidates: [winner], conflictingCandidates: candidates.filter((item) => item !== winner), decisionReasons: reasons(winner, runnerUp), requiresReview: false };
}
/** Produces an isolated, deterministic merge plan. It performs no reads beyond supplied inputs and no writes. */
export function mergeKnowledge(input: KnowledgeMergeInput): KnowledgeMergeResult {
  const candidates = adaptBusinessMemoryAssertions(input.currentBusinessMemory).concat(input.incomingCandidates ?? []).map((candidate) => ({ ...candidate, sourceOrigins: uniqueSorted(candidate.sourceOrigins) as KnowledgeMergeCandidate["sourceOrigins"], sourceIds: uniqueSorted(candidate.sourceIds), crawlAttemptIds: uniqueSorted(candidate.crawlAttemptIds), evidence: candidate.evidence.slice().sort((a,b) => compare(a.id,b.id)) })).sort(candidateSort);
  const buckets = new Map<string, KnowledgeMergeCandidate[]>(); candidates.forEach((candidate) => buckets.set(candidate.canonicalIdentity, [...(buckets.get(candidate.canonicalIdentity) ?? []), candidate]));
  const groups = Array.from(buckets.entries()).sort(([a],[b]) => compare(a,b)).map(([identity, items]) => group(identity, items)); const unresolvedConflicts = groups.filter((item) => item.classification === "unresolved_conflict");
  const canonicalAssertions = groups.filter((item) => item.selectedCandidate !== null).map((item) => ({ canonicalIdentity: item.canonicalIdentity, selectedAssertion: item.selectedCandidate!, supportingAssertions: item.supportingCandidates, preservedProvenance: { contributingSourceOrigins: item.contributingSourceOrigins, contributingAssertionIds: item.contributingAssertionIds, contributingSourceIds: item.contributingSourceIds }, preservedEvidence: item.candidates.flatMap((candidate) => candidate.evidence).filter((evidence, index, all) => all.findIndex((item) => item.id === evidence.id) === index).sort((a,b) => compare(a.id,b.id)), confidence: item.selectedCandidate!.confidence, authority: authority(item.selectedCandidate!), reviewState: item.selectedCandidate!.reviewState ?? null, requiresReview: item.requiresReview }));
  return { mergeTimestamp: input.mergeTimestamp, groups, canonicalAssertions, unresolvedConflicts, statistics: { totalGroups: groups.length, singleGroups: groups.filter((item) => item.classification === "single").length, agreementGroups: groups.filter((item) => item.classification === "agreement").length, resolvedConflicts: groups.filter((item) => item.classification === "conflict").length, unresolvedConflicts: unresolvedConflicts.length, totalCandidates: candidates.length } };
}
