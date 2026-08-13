import type { WebsiteKnowledgeFact } from "../../knowledge/websiteKnowledge";
import type {
  KnowledgeProvenance,
  NormalizedEvidence,
} from "../contracts";

export type KnowledgeCategory = WebsiteKnowledgeFact["category"];

export type KnowledgeBucket =
  | "business_identity"
  | "offers_capabilities"
  | "customers_market"
  | "commercial_rules"
  | "trust_qualification"
  | "operations_experience"
  | "ecosystem"
  | "proof_positioning";

export type RoutingReasonCode =
  | "category_primary_owner"
  | "owner_field_mapping"
  | "legacy_rule_match"
  | "legacy_fact_category"
  | "secondary_cross_bucket_signal"
  | "fallback_additional_knowledge";

export type KnowledgeObservation = {
  id: string;
  sourceFactId: string;
  sourceIndex: number;
  text: string;
  evidence: NormalizedEvidence[];
  provenance: KnowledgeProvenance;
  candidateCategories: KnowledgeCategory[];
  assignedBuckets: KnowledgeBucket[];
  primaryBucket: KnowledgeBucket;
  routingReasons: RoutingReasonCode[];
};
