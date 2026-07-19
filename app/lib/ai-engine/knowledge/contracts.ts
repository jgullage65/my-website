/**
 * Knowledge Contracts
 *
 * Defines the finalized, approved knowledge supplied to retrieval and chat.
 */

import type {
    BusinessContextCategory,
    ContextConfidence,
  } from "@/app/lib/ai-engine/contracts";
  
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
  };
  
  export type KnowledgeFaq = {
    id: string;
    question: string;
    answer: string;
    confidence: ContextConfidence;
    confidenceScore: number;
    sourceEntryIds: string[];
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
  