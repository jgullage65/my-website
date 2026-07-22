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

export type AssistantProjectionEvidence = {
  id: string;
  canonicalSourceId: string;
  sourceType: KnowledgeSourceOrigin | null;
  sourceUrl: string | null;
  excerpt: string;
  capturedAt: string;
  crawlAttemptId: string | null;
  provenanceClassification: KnowledgeSourceOrigin | null;
};

export type AssistantProjectionKnowledgeItem = {
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

export type AssistantProjectionFaq = AssistantProjectionKnowledgeItem & {
  question: string;
  answer: string;
};

export type AssistantProjectionRestriction = {
  id: string;
  type: "prohibited_claim" | "behavior_rule" | "conflict_suppression" | "missing_information";
  instruction: string;
  relatedEntityIds: string[];
  relatedAssertionIds: string[];
  evidenceIds: string[];
  active: boolean;
};

export type AssistantProjectionRelationship = {
  id: string;
  type: BusinessRelationshipType;
  sourceEntityId: string;
  targetEntityId: string;
  sourceAssertionId: string;
  targetAssertionId: string;
  sourceEntryIds: string[];
  confidence: Confidence | null;
  evidenceIds: string[];
  active: boolean;
  resolved: boolean;
};

export type AssistantProjectionMissingInformation = {
  id: string;
  topic: string;
  reason: string;
  suggestedFollowUpQuestion: string;
  relatedEntityIds: string[];
  relatedAssertionIds: string[];
  resolved: boolean;
};

export type AssistantProjectionIdentity = {
  canonicalEntityId: string | null;
  businessName: string | null;
  aliases: string[];
  identityKeys: string[];
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
  businessMemoryVersion: string;
  projectionVersion: typeof ASSISTANT_PROJECTION_VERSION;
  schemaVersion: typeof ASSISTANT_PROJECTION_SCHEMA_VERSION;
  identity: AssistantProjectionIdentity;
  assistant: AssistantProjectionAssistantConfiguration;
  services: AssistantProjectionKnowledgeItem[];
  pricing: AssistantProjectionKnowledgeItem[];
  policies: AssistantProjectionKnowledgeItem[];
  faqs: AssistantProjectionFaq[];
  restrictions: AssistantProjectionRestriction[];
  relationships: AssistantProjectionRelationship[];
  evidence: AssistantProjectionEvidence[];
  missingInformation: AssistantProjectionMissingInformation[];
};
