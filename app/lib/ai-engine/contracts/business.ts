/**
 * Business Knowledge Contracts
 *
 * Defines permanent, reviewable knowledge about a business.
 */

export const BUSINESS_CONTEXT_CATEGORIES = [
    "business_profile",
    "audience",
    "service",
    "pricing",
    "policy",
    "process",
    "differentiator",
    "faq",
    "behavior_rule",
    "prohibited_claim",
  ] as const;
  
  export type BusinessContextCategory =
    (typeof BUSINESS_CONTEXT_CATEGORIES)[number];
  
  export const BUSINESS_CONTEXT_STATUSES = [
    "proposed",
    "approved",
    "corrected",
    "archived",
  ] as const;
  
  export type BusinessContextStatus =
    (typeof BUSINESS_CONTEXT_STATUSES)[number];
  
  export type ContextConfidence = "high" | "medium" | "low";
  
  export type BusinessContextSource = {
    intakeBlockId: string;
    excerpt: string;
    sourceType: "manual_intake" | "generated_qa" | "website" | "user_edit";
    sourceUrl?: string | null;
  };
  
export type BusinessContextMetadata = {
    generated: boolean;
    userEdited: boolean;
    conflictingEntryIds: string[];
    tags: string[];
    provenanceClassification?: import("../provenance").AiBuilderProvenanceClassification;
    predecessorProvenanceClassification?: import("../provenance").AiBuilderProvenanceClassification;
    originalProvenanceClassification?: import("../provenance").AiBuilderProvenanceClassification;
    upstreamSourceEntryIds?: string[];
    mixedSourceProvenance?: boolean;
  };
  
  export type BusinessContextEntry = {
    id: string;
    sessionId: string;
    category: BusinessContextCategory;
    title: string;
    content: string;
    confidence: ContextConfidence;
    confidenceScore: number;
    status: BusinessContextStatus;
    source: BusinessContextSource;
    metadata: BusinessContextMetadata;
    createdAt: string;
    updatedAt: string;
  };
  
export type GeneratedFaqEntry = {
    id: string;
    sessionId: string;
    question: string;
    answer: string;
    confidence: ContextConfidence;
    confidenceScore: number;
    sourceEntryIds: string[];
    status: BusinessContextStatus;
    metadata?: Partial<BusinessContextMetadata>;
    createdAt: string;
    updatedAt: string;
  };
  
  export type BusinessContextCounts = {
    total: number;
    approved: number;
    proposed: number;
    archived: number;
    byCategory: Partial<Record<BusinessContextCategory, number>>;
  };

