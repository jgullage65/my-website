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
  
  export type ConversationFact = {
    key: string;
    value: string;
    confidence: "high" | "medium" | "low";
    sourceTurnId: string;
    updatedAt: string;
  };
  
  export type ConversationMemory = {
    threadId: string;
    currentSubject: string | null;
    customerGoal: string | null;
    selectedService: string | null;
    collectedDetails: ConversationFact[];
    unresolvedQuestions: string[];
    recentClarifications: string[];
    summary: string;
    updatedAt: string;
  };
  