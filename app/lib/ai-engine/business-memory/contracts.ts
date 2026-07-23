/**
 * The future canonical Business Memory domain model. Legacy AI Builder contracts
 * remain active during migration. Sources and standalone evidence stay lossless,
 * while assertions are reviewed independently. Persistence and mapping changes
 * are intentionally deferred to later slices.
 */
import type { ContextConfidence } from "@/app/lib/ai-engine/contracts";

/** Version for the canonical Business Memory document; mapping and persistence remain deferred. */
export const BUSINESS_MEMORY_SCHEMA_VERSION = 1 as const;

export type ReviewState = "proposed" | "approved" | "corrected" | "archived" | "rejected" | "superseded";

export type Confidence = {
  level: ContextConfidence;
  score: number;
};

export type BusinessEntityType =
  | "business"
  | "service"
  | "product"
  | "policy"
  | "customer_segment"
  | "location"
  | "process"
  | "pricing_concept"
  | "contact_method"
  | "differentiator"
  | "guarantee"
  | "faq"
  | "general_knowledge"
  | "other";

export type BusinessRelationshipType =
  | "supports"
  | "has_pricing"
  | "serves_audience"
  | "applies_to"
  | "answers_topic"
  | "derived_from"
  | "conflicts_with"
  | (string & {});

export type KnowledgeSourceOrigin =
  | "website"
  | "manual_intake"
  | "generated_qa"
  | "generated"
  | "user_edit"
  | "imported_data"
  | "system"
  | (string & {});

export type AssertionAuthority = "observed" | "provided" | "generated" | "confirmed" | "corrected";

export type KnowledgeSource = {
  id: string;
  origin: KnowledgeSourceOrigin;
  sourceEntryId: string | null;
  intakeBlockId: string | null;
  url: string | null;
  label: string | null;
  capturedAt: string;
  crawlAttemptId: string | null;
  pageType?: string | null;
  importedAt?: string | null;
};

export type EvidenceRecord = {
  id: string;
  sourceId: string;
  excerpt: string;
  url: string | null;
  capturedAt: string;
};

/** One independently sourced legacy claim about a canonical entity. */
export type AssertionCorrectionProvenance = {
  classification: import("../provenance").AiBuilderProvenanceClassification | null;
  predecessorClassification: import("../provenance").AiBuilderProvenanceClassification | null;
  originalClassification: import("../provenance").AiBuilderProvenanceClassification | null;
  correctedByClerkUserId: string | null;
  correctedByDisplayName: string | null;
  correctedByEmail: string | null;
  correctedAt: string | null;
};

export type BusinessAssertion = {
  id: string;
  entityId: string;
  value: string;
  confidence: Confidence;
  reviewState: ReviewState;
  authority: AssertionAuthority;
  sourceIds: string[];
  evidenceIds: string[];
  tags: string[];
  legacyEntryId: string | null;
  /** Explicit revision link. A corrected assertion may replace this predecessor. */
  predecessorAssertionId?: string | null;
  /** Provenance supplied by canonical Trusted Knowledge; never synthesized by projection. */
  provenance?: AssertionCorrectionProvenance;
  createdAt: string;
  updatedAt: string;
};

/** A canonical named business concept, which can own many assertions. */
export type BusinessEntity = {
  id: string;
  type: BusinessEntityType;
  name: string;
  aliases: string[];
  tags: string[];
  assertionIds: string[];
  sourceIds: string[];
  evidenceIds: string[];
  createdAt: string;
  updatedAt: string;
};

/**
 * Persisted entity identity is `legacy_kind:legacy_entry_id`: the stable
 * canonical Trusted Knowledge item key.  It intentionally does not merge
 * separate claims with similar names; semantic reconciliation is a later phase.
 */

export type BusinessRelationship = {
  id: string;
  type: BusinessRelationshipType;
  fromEntityId: string;
  toEntityId: string;
  fromAssertionId: string;
  toAssertionId: string;
  sourceEntryIds: string[];
  reviewState: ReviewState;
  createdAt: string;
  updatedAt: string;
};

export type BusinessMemoryAssistant = {
  name: string;
  purpose: string;
  tone: string;
  responseStyle: string;
  primaryAudience: string | null;
  escalationInstructions: string[];
  behaviorRules?: string[];
  prohibitedClaims?: string[];
};

export type BusinessMemoryConflict = {
  id: string;
  projectId: string;
  topic: string;
  conflictingStatements: string[];
  relatedEntityIds: string[];
  relatedAssertionIds: string[];
  sourceIds: string[];
  evidenceIds: string[];
  suggestedClarificationQuestion: string;
  resolved: boolean;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BusinessMemoryMissingInformation = {
  id: string;
  projectId: string;
  topic: string;
  reason: string;
  suggestedQuestion: string;
  relatedEntityTypes: BusinessEntityType[];
  relatedEntityIds: string[];
  relatedAssertionIds: string[];
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
};

/** A reviewed future merge decision; the mapper never creates these automatically. */
export type EntityMergeContract = {
  canonicalEntityId: string;
  mergedEntityIds: string[];
  approvedAliases: string[];
  mergedAt: string;
};

export type BusinessMemory = {
  id: string;
  schemaVersion: typeof BUSINESS_MEMORY_SCHEMA_VERSION;
  projectId: string;
  assistant: BusinessMemoryAssistant;
  entities: BusinessEntity[];
  assertions: BusinessAssertion[];
  relationships: BusinessRelationship[];
  sources: KnowledgeSource[];
  evidence: EvidenceRecord[];
  conflicts: BusinessMemoryConflict[];
  missingInformation: BusinessMemoryMissingInformation[];
  /** Omitted when no reviewed merge decisions are supplied. */
  entityMerges?: EntityMergeContract[];
  createdAt: string;
  updatedAt: string;
};
