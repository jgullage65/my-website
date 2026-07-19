import type { ContextConfidence } from "@/app/lib/ai-engine/contracts";

export type ReviewState = "proposed" | "approved" | "corrected" | "archived";

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
  | "other";

export type BusinessRelationshipType = "supports";

export type KnowledgeSourceOrigin = "website" | "manual_intake" | "generated_qa" | "user_edit";

export type AssertionAuthority = "observed" | "provided" | "generated" | "confirmed" | "corrected";

export type KnowledgeSource = {
  id: string;
  origin: KnowledgeSourceOrigin;
  sourceEntryId: string | null;
  intakeBlockId: string | null;
  url: string | null;
  label: string | null;
  capturedAt: string;
};

export type EvidenceRecord = {
  id: string;
  sourceId: string;
  excerpt: string;
  capturedAt: string;
};

/** One independently sourced legacy claim about a canonical entity. */
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

export type BusinessRelationship = {
  id: string;
  type: BusinessRelationshipType;
  fromEntityId: string;
  toEntityId: string;
  sourceEntryIds: string[];
  reviewState: ReviewState;
  createdAt: string;
  updatedAt: string;
};

export type BusinessMemory = {
  id: string;
  schemaVersion: 1;
  projectId: string;
  entities: BusinessEntity[];
  assertions: BusinessAssertion[];
  relationships: BusinessRelationship[];
  sources: KnowledgeSource[];
  evidence: EvidenceRecord[];
  createdAt: string;
  updatedAt: string;
};
