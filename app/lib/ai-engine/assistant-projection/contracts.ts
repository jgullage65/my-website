import type {
  AssertionAuthority,
  BusinessEntityType,
  BusinessRelationshipType,
  Confidence,
  KnowledgeSourceOrigin,
  ReviewState,
  AssertionCorrectionProvenance,
} from "../business-memory/contracts";

/** Wire schema for the durable, runtime-facing Assistant Projection boundary. */
// Schema v3 adds the dedicated product collection while retaining revision linkage.
export const ASSISTANT_PROJECTION_SCHEMA_VERSION = 3 as const;
/** Version of the deterministic Business Memory-to-projection mapping. */
// Mapping v3 serializes products and revision linkage deterministically for every claim.
export const ASSISTANT_PROJECTION_VERSION = 3 as const;

export type AssistantProjectionSource = {
  id: string;
  origin: KnowledgeSourceOrigin;
  url: string | null;
  label: string | null;
  capturedAt: string;
  crawlAttemptId: string | null;
};

export type AssistantProjectionEvidence = {
  id: string;
  canonicalSourceId: string;
  sourceUrl: string | null;
  excerpt: string;
  capturedAt: string;
};

export type AssistantProjectionTextKnowledgeItem = {
  id: string;
  entityId: string;
  assertionId: string;
  entityType: BusinessEntityType;
  title: string;
  value: string;
  aliases: string[];
  tags: string[];
  confidence: Confidence;
  authority: AssertionAuthority;
  reviewState: Extract<ReviewState, "approved" | "corrected">;
  evidenceIds: string[];
  sourceIds: string[];
  /** Optional for schema-v1 reads; generated projections preserve canonical provenance. */
  provenance?: AssertionCorrectionProvenance;
  /** Canonical revision linkage retained for retrieval precedence and future citations. */
  predecessorAssertionId?: string | null;
};

/** Business Memory currently represents services as reviewed text claims. */
export type AssistantProjectionService = AssistantProjectionTextKnowledgeItem & { entityType: "service" };
/** Business Memory products are reviewed text claims in their own runtime collection. */
export type AssistantProjectionProduct = AssistantProjectionTextKnowledgeItem & { entityType: "product" };
/** Business Memory currently represents pricing as reviewed text claims. */
export type AssistantProjectionPricing = AssistantProjectionTextKnowledgeItem & { entityType: "pricing_concept" };
/** Business Memory currently represents policies as reviewed text claims. */
export type AssistantProjectionPolicy = AssistantProjectionTextKnowledgeItem & { entityType: "policy" };
export type AssistantProjectionFaq = AssistantProjectionTextKnowledgeItem & {
  entityType: "faq";
  question: string;
  answer: string;
};

/**
 * Escalation instructions remain assistant configuration, not canonical answer
 * restrictions. Restrictions below are only explicit assistant rules or unresolved
 * canonical conflicts.
 */
export type AssistantProjectionRestriction = {
  id: string;
  type: "prohibited_claim" | "behavior_rule" | "conflict_suppression";
  instruction: string;
  relatedEntityIds: string[];
  relatedAssertionIds: string[];
  evidenceIds: string[];
  sourceIds: string[];
  reviewState: Extract<ReviewState, "approved" | "corrected">;
  /** Retained from the canonical assertion so restriction revisions can be resolved at runtime. */
  authority?: AssertionAuthority;
  provenance?: AssertionCorrectionProvenance;
  predecessorAssertionId?: string | null;
};

export type AssistantProjectionRelationship = {
  id: string;
  type: BusinessRelationshipType;
  sourceEntityId: string;
  targetEntityId: string;
  sourceAssertionId: string;
  targetAssertionId: string;
  sourceEntryIds: string[];
  sourceIds: string[];
  evidenceIds: string[];
  reviewState: Extract<ReviewState, "approved" | "corrected">;
};

export type AssistantProjectionMissingInformation = {
  id: string;
  topic: string;
  reason: string;
  suggestedFollowUpQuestion: string;
  relatedEntityTypes: BusinessEntityType[];
  relatedEntityIds: string[];
  relatedAssertionIds: string[];
  resolved: boolean;
};

export type AssistantProjectionIdentity = {
  /** Whether canonical business identity resolution produced one, zero, or multiple candidates. */
  status: "resolved" | "missing" | "ambiguous";
  canonicalEntityId: string | null;
  businessName: string | null;
  aliases: string[];
  mergedEntityIds: string[];
  redirectedEntityIds: string[];
  contactEntityIds: string[];
};

export type AssistantProjectionAssistantConfiguration = {
  name: string;
  purpose: string;
  tone: string;
  responseStyle: string;
  primaryAudience: string | null;
  escalationInstructions: string[];
};

export type AssistantProjection = {
  projectId: string;
  /** SHA-256 fingerprint of stable canonical content, excluding operational mutation timestamps. */
  businessMemoryFingerprint: string;
  /** Number permits historical DTO parsing; current writes are checked separately. */
  projectionVersion: number;
  schemaVersion: number;
  identity: AssistantProjectionIdentity;
  assistant: AssistantProjectionAssistantConfiguration;
  services: AssistantProjectionService[];
  products: AssistantProjectionProduct[];
  pricing: AssistantProjectionPricing[];
  policies: AssistantProjectionPolicy[];
  faqs: AssistantProjectionFaq[];
  restrictions: AssistantProjectionRestriction[];
  relationships: AssistantProjectionRelationship[];
  sources: AssistantProjectionSource[];
  evidence: AssistantProjectionEvidence[];
  missingInformation: AssistantProjectionMissingInformation[];
};

/** Durable metadata surrounding a deterministic AssistantProjection payload. */
export type AssistantProjectionInvalidationState =
  | "valid"
  | "invalidated"
  | "rebuilding"
  | "failed";

/**
 * Persistence boundary for the current projection artifact. These timestamps
 * and state deliberately do not belong to AssistantProjection itself.
 */
export type PersistedAssistantProjectionRecord = {
  projectId: string;
  businessMemoryFingerprint: string;
  /** Historical durable rows may be read as stale during a version upgrade. */
  projectionVersion: number;
  schemaVersion: number;
  generatedAt: string;
  invalidationState: AssistantProjectionInvalidationState;
  projection: AssistantProjection;
  createdAt: string;
  updatedAt: string;
};
