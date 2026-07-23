/**
 * Memory Contracts
 *
 * Keeps permanent business memory separate from temporary conversation memory.
 */

import type {
    BusinessContextCategory,
    BusinessContextEntry,
  } from "./business";
  
  export type BusinessMemory = {
    sessionId: string;
    entries: BusinessContextEntry[];
    version: number;
    updatedAt: string;
  };
  
  export type MemoryWriteReason =
    | "intake_extraction"
    | "user_approval"
    | "user_correction"
    | "website_enrichment"
    | "manual_addition"
    | "archive";
  
  export type BusinessMemoryWrite = {
    entryId: string;
    category: BusinessContextCategory;
    reason: MemoryWriteReason;
    previousValue?: string | null;
    nextValue?: string | null;
    createdAt: string;
  };
  
  /** @deprecated: use CanonicalConversationMemory. */
  export type ConversationFact = { key: string; value: string; confidence: "high" | "medium" | "low"; sourceTurnId: string; updatedAt: string; };

  export type ConversationMemory = import("../memory/conversationMemory").CanonicalConversationMemory;
  
/** Phase 11A canonical thread-scoped memory; never permanent business knowledge. */
export type { CanonicalConversationMemory, ConversationDetail, ConversationPreference, ConversationFollowUp, SummaryCoverage } from "../memory/conversationMemory";
export { CONVERSATION_MEMORY_SCHEMA_VERSION } from "../memory/conversationMemory";
