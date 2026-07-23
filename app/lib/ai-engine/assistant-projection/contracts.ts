import type {
  AssertionAuthority,
  BusinessEntityType,
  BusinessRelationshipType,
  Confidence,
  KnowledgeSourceOrigin,
  ReviewState,
} from "../business-memory/contracts";

/** Wire schema for the durable, runtime-facing Assistant Projection boundary. */
export const ASSISTANT_PROJECTION_SCHEMA_VERSION = 1 as const;
/** Version of the deterministic Business Memory-to-projection mapping. */
export const ASSISTANT_PROJECTION_VERSION = 1 as const;

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
};

/** Business Memory currently represents services as reviewed text claims. */
export type AssistantProjectionService = AssistantProjectionTextKnowledgeItem & { entityType: "service" };
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
};

export type AssistantProjectionRelationship = {
  id: string;
  type: BusinessRelationshipType;
  sourceEntityId: string;
  targetEntityId: string;
  sourceAssertionId: string;
  targetAssertionId: string;
  sourceEntryIds: string[];
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
  projectionVersion: typeof ASSISTANT_PROJECTION_VERSION;
  schemaVersion: typeof ASSISTANT_PROJECTION_SCHEMA_VERSION;
  identity: AssistantProjectionIdentity;
  assistant: AssistantProjectionAssistantConfiguration;
  services: AssistantProjectionService[];
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
  projectionVersion: typeof ASSISTANT_PROJECTION_VERSION;
  schemaVersion: typeof ASSISTANT_PROJECTION_SCHEMA_VERSION;
  generatedAt: string;
  invalidationState: AssistantProjectionInvalidationState;
  projection: AssistantProjection;
  createdAt: string;
  updatedAt: string;
};
