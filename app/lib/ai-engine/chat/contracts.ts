import type { KnowledgePack } from "../knowledge";

export type ChatRequest={
  knowledge:KnowledgePack;
  message:string;
};

export type RetrievedKnowledge={
  facts:string[];
  faq:string[];
};

export type ChatResponse={
  answer:string;
  citations:string[];
  diagnostics:ChatDiagnostics;
};

export type ChatDiagnostics={
  retrievedFacts:number;
  retrievedFaq:number;
  retrievalMs:number;
  runtimeSource?: "server_legacy_projection" | "trusted_knowledge_projection" | "assistant_projection";
  structuredRetrieval?: {
    engineVersion: string;
    intent: string;
    directCandidateCount: number;
    relationshipExpansionCount: number;
    relationshipCandidateCount: number;
    totalCandidateCount: number;
    evidenceSelectedCount: number;
    sourceSelectedCount: number;
    selectedDirectCount: number;
    selectedRelatedCount: number;
    retrievalDurationMs: number;
    selectedResultCount: number;
    selectedCategoryCounts: Record<string, number>;
    topScoreBands: number[];
  };
  conflictAnalysis?: { conflictGroupCount: number; authoritativeResolutionCount: number; unresolvedConflictCount: number; correctedAssertionCount: number; predecessorSuppressedCount: number; citationCount: number; evidenceCount: number; sourceCount: number; };
  conversationMemory?: { available: boolean; selectedItemCount: number; selectedCategories: string[]; excludedConflict: boolean; retrievalDurationMs: number; };
};
