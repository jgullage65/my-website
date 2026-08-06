import type {
  BusinessConcept,
  DeterministicFact,
  DuplicateGroup,
  KnowledgeProvenance,
  MaterialConflict,
  NormalizedEvidence,
} from "../contracts";
import type {
  KnowledgeBucket,
  KnowledgeCategory,
  KnowledgeObservation,
} from "../routing/contracts";

export type DomainClaimPolarity = "positive" | "negative";
export type DomainClaimTemporalStatus =
  | "current"
  | "planned"
  | "historical"
  | "unknown";
export type DomainClaimCertainty =
  | "asserted"
  | "conditional"
  | "questioned";

export type DomainClaim = {
  id: string;
  bucket: KnowledgeBucket;
  category: KnowledgeCategory;
  subject: {
    topicKey: string;
    displayName: string;
  };
  predicate: string;
  objectValue: string | null;
  fullClaim: string;
  polarity: DomainClaimPolarity;
  temporalStatus: DomainClaimTemporalStatus;
  certainty: DomainClaimCertainty;
  evidence: NormalizedEvidence[];
  provenance: KnowledgeProvenance;
  sourceObservationIds: string[];
};

export type CrossBucketReference = {
  id: string;
  sourceBucket: KnowledgeBucket;
  targetBucket: KnowledgeBucket;
  sourceObservationId: string;
  reason: string;
};

export type BucketReportStatus =
  | "complete"
  | "blocked"
  | "review_required";

export type BucketReport = {
  bucket: KnowledgeBucket;
  observations: KnowledgeObservation[];
  claims: DomainClaim[];
  facts: DeterministicFact[];
  duplicateGroups: DuplicateGroup[];
  conflicts: MaterialConflict[];
  concepts: BusinessConcept[];
  unresolvedQuestions: string[];
  crossBucketReferences: CrossBucketReference[];
  status: BucketReportStatus;
};

export type SpecialistAdapter = (
  observations: readonly KnowledgeObservation[],
  legacyFacts: readonly DeterministicFact[],
) => BucketReport;
