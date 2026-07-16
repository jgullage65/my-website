/**
 * Retrieval and Context Contracts
 *
 * Defines the compact retrieval pack supplied for one user question.
 */

import type {
    BusinessContextCategory,
    ContextConfidence,
  } from "./business";
  import type { DemoThreadMemory } from "./thread";
  
  export const CONTEXT_SOURCES = [
    "business_context",
    "faq",
    "conversation_memory",
    "recent_turn",
  ] as const;
  
  export type ContextSource = (typeof CONTEXT_SOURCES)[number];
  
  export type ContextCandidate = {
    id: string;
    source: ContextSource;
    category: BusinessContextCategory | "conversation";
    content: string;
    relevanceScore: number;
    confidence: ContextConfidence;
    sourceLabel: string;
    sourceEntryId?: string | null;
  };
  
  export type RetrievalQuery = {
    sessionId: string;
    threadId: string;
    message: string;
    detectedTopics: string[];
    detectedIntent: string | null;
  };
  
  export type RetrievalPack = {
    query: RetrievalQuery;
    candidates: ContextCandidate[];
    threadMemory: DemoThreadMemory;
    selectedContextIds: string[];
    missingTopics: string[];
    diagnostics: {
      totalCandidates: number;
      selectedCandidates: number;
      exactFaqMatch: boolean;
      highestScore: number | null;
    };
  };
  