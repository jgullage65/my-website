/**
 * Knowledge Contracts
 *
 * Defines the finalized, approved knowledge supplied to retrieval and chat.
 */

import type {
    BusinessContextCategory,
    ContextConfidence,
  } from "@/app/lib/ai-engine/contracts";
import type { AiBuilderProvenanceClassification } from "@/app/lib/ai-engine/provenance";

  export type KnowledgeProvenance = {
    classification: AiBuilderProvenanceClassification | null;
    predecessorClassification: AiBuilderProvenanceClassification | null;
    originalClassification: AiBuilderProvenanceClassification | null;
    correctedByClerkUserId: string | null;
    correctedByDisplayName: string | null;
    correctedByEmail: string | null;
    correctedAt: string | null;
  };
  
  export type KnowledgeFact = {
    id: string;
    category: BusinessContextCategory;
    title: string;
    content: string;
    confidence: ContextConfidence;
    confidenceScore: number;
    sourceEntryId: string;
    sourceExcerpt: string;
    sourceType: string;
    sourceUrl: string | null;
    tags: string[];
    provenance: KnowledgeProvenance;
    reviewState: "approved" | "corrected";
    governanceRevision: number;
  };
  
  export type KnowledgeFaq = {
    id: string;
    question: string;
    answer: string;
    confidence: ContextConfidence;
    confidenceScore: number;
    sourceEntryIds: string[];
    provenance: KnowledgeProvenance;
    reviewState: "approved" | "corrected";
    governanceRevision: number;
  };
  
  export type KnowledgePack = {
    sessionId: string;
    assistantName: string;
    assistantPurpose: string;
    assistantTone: string;
    primaryAudience: string | null;
    facts: KnowledgeFact[];
    faq: KnowledgeFaq[];
    behaviorRules: KnowledgeFact[];
    prohibitedClaims: KnowledgeFact[];
    builtAt: string;
    version: number;
  };
  
  export type KnowledgeDiagnostics = {
    totalFacts: number;
    totalFaq: number;
    totalBehaviorRules: number;
    totalProhibitedClaims: number;
    factsByCategory: Partial<
      Record<BusinessContextCategory, number>
    >;
    averageConfidenceScore: number;
    sourceCoverage: number;
    readyForChat: boolean;
    readinessIssues: string[];
  };
  
