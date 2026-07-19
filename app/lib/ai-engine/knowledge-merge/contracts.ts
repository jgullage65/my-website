import type { AssertionAuthority, BusinessAssertion, BusinessEntityType, BusinessMemory, Confidence, KnowledgeSourceOrigin, ReviewState } from "../business-memory/contracts";

export type MergeEvidenceReference = {
  id: string; sourceId: string; sourceOrigin: KnowledgeSourceOrigin; sourceUrl: string | null;
  excerpt: string; crawlAttemptId: string | null; capturedAt: string | null;
};

/** Explicit, normalized input used for assertions not already in Business Memory. */
export type KnowledgeMergeCandidate = {
  canonicalIdentity: string; assertionId: string; entityCanonicalIdentity: string;
  entityId: string; entityType: BusinessEntityType; entityName: string; value: string;
  confidence: Confidence; reviewState?: ReviewState; authority?: AssertionAuthority;
  sourceOrigins: KnowledgeSourceOrigin[]; sourceIds: string[]; evidence: MergeEvidenceReference[];
  crawlAttemptIds: string[]; originatingAssertionId: string | null;
};
export type KnowledgeMergeInput = { currentBusinessMemory: BusinessMemory; incomingCandidates?: KnowledgeMergeCandidate[]; mergeTimestamp: string };
export type MergeClassification = "single" | "agreement" | "conflict" | "unresolved_conflict";
export type MergeDecisionReason = { code: string; detail: string };
export type KnowledgeMergeGroup = {
  canonicalIdentity: string; entityCanonicalIdentity: string; classification: MergeClassification;
  candidates: KnowledgeMergeCandidate[]; selectedCandidate: KnowledgeMergeCandidate | null;
  supportingCandidates: KnowledgeMergeCandidate[]; conflictingCandidates: KnowledgeMergeCandidate[];
  contributingSourceOrigins: KnowledgeSourceOrigin[]; contributingAssertionIds: string[];
  contributingSourceIds: string[]; contributingEvidenceIds: string[];
  decisionReasons: MergeDecisionReason[]; requiresReview: boolean;
};
export type CanonicalKnowledgeAssertion = {
  canonicalIdentity: string; selectedAssertion: KnowledgeMergeCandidate;
  supportingAssertions: KnowledgeMergeCandidate[]; preservedProvenance: Pick<KnowledgeMergeGroup, "contributingSourceOrigins" | "contributingAssertionIds" | "contributingSourceIds">;
  preservedEvidence: MergeEvidenceReference[]; confidence: Confidence; authority: AssertionAuthority | null;
  reviewState: ReviewState | null; requiresReview: boolean;
};
export type KnowledgeMergeResult = {
  mergeTimestamp: string; groups: KnowledgeMergeGroup[]; canonicalAssertions: CanonicalKnowledgeAssertion[];
  unresolvedConflicts: KnowledgeMergeGroup[];
  statistics: { totalGroups: number; singleGroups: number; agreementGroups: number; resolvedConflicts: number; unresolvedConflicts: number; totalCandidates: number };
};
export type BusinessMemoryAssertionAdapter = (memory: BusinessMemory) => KnowledgeMergeCandidate[];
export type CanonicalAssertionIdentityAdapter = (assertion: BusinessAssertion) => string;
