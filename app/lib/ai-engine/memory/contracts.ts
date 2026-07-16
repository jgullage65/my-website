/**
 * Memory Layer Contracts
 *
 * Purpose:
 * Defines deterministic inputs and outputs for permanent business memory
 * and temporary conversation memory updates.
 */

import type {
    BusinessContextEntry,
    BusinessMemory,
    DemoThreadMemory,
    ThreadDecision,
  } from "@/app/lib/ai-engine/contracts";
  
  export type BusinessMemoryMergeReason =
    | "initial_build"
    | "approval"
    | "correction"
    | "archive"
    | "website_enrichment"
    | "manual_addition";
  
  export type BusinessMemoryMergeInput = {
    sessionId: string;
    current: BusinessMemory | null;
    incoming: BusinessContextEntry[];
    reason: BusinessMemoryMergeReason;
    updatedAt?: string;
  };
  
  export type BusinessMemoryMergeResult = {
    memory: BusinessMemory;
    addedEntryIds: string[];
    updatedEntryIds: string[];
    archivedEntryIds: string[];
    skippedEntryIds: string[];
    changed: boolean;
  };
  
  export type ThreadMemoryProposal = {
    primaryGoal?: string | null;
    currentSubject?: string | null;
    selectedService?: string | null;
    activeConstraints?: string[];
    collectedDetails?: string[];
    unresolvedQuestions?: string[];
    recentClarifications?: string[];
    summary?: string;
    stickyState?: Record<string, unknown>;
  };
  
  export type ThreadMemoryUpdateInput = {
    previous: DemoThreadMemory;
    decision: ThreadDecision;
    userMessage: string;
    assistantMessage: string;
    proposal?: ThreadMemoryProposal | null;
    updatedAt?: string;
  };
  
  export type ThreadMemoryGuardFailure =
    | "sidetrack_primary_goal_overwrite_blocked"
    | "sidetrack_subject_overwrite_blocked"
    | "sidetrack_service_overwrite_blocked"
    | "low_signal_summary_blocked"
    | "low_signal_goal_blocked"
    | "low_signal_subject_blocked"
    | "empty_update_blocked";
  
  export type ThreadMemoryUpdateResult = {
    memory: DemoThreadMemory;
    failures: ThreadMemoryGuardFailure[];
    changed: boolean;
  };
  