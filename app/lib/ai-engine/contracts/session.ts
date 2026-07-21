/**
 * AI Builder Session Contracts
 *
 * Defines the lifecycle of one visitor-created AI system.
 */

import type {
    BusinessContextCounts,
    BusinessContextEntry,
    GeneratedFaqEntry,
  } from "./business";
  
  export const AI_BUILDER_SESSION_STATUSES = [
    "draft",
    "extracting",
    "review_required",
    "ready",
    "failed",
    "expired",
  ] as const;
  
  export type AiBuilderSessionStatus =
    (typeof AI_BUILDER_SESSION_STATUSES)[number];
  
  export type IntakeBlock = {
    id: string;
    label: string;
    content: string;
    createdAt: string;
    updatedAt: string;
  };
  
  export type AssistantConfiguration = {
    name: string;
    purpose: string;
    tone: string;
    responseStyle: string;
    primaryAudience: string | null;
    escalationInstructions: string[];
  };
  
  export type IntakeConflict = {
    id: string;
    topic: string;
    firstStatement: string;
    secondStatement: string;
    sourceExcerpts: string[];
    suggestedQuestion: string;
    resolved: boolean;
    resolution?: string | null;
  };
  
  export type MissingBusinessInformation = {
    id: string;
    topic: string;
    reason: string;
    suggestedQuestion: string;
    resolved: boolean;
  };
  
  export type BuildProgress = {
    stage:
      | "reading_business"
      | "extracting_facts"
      | "generating_qa"
      | "detecting_conflicts"
      | "building_memory"
      | "preparing_demo"
      | "complete";
    message: string;
    completed: boolean;
    count?: number | null;
    createdAt: string;
  };
  
  export type AiBuilderSession = {
    id: string;
    status: AiBuilderSessionStatus;
    intakeBlocks: IntakeBlock[];
    assistantConfiguration: AssistantConfiguration;
    contextEntries: BusinessContextEntry[];
    faqEntries: GeneratedFaqEntry[];
    conflicts: IntakeConflict[];
    missingInformation: MissingBusinessInformation[];
    contextCounts: BusinessContextCounts;
    buildProgress: BuildProgress[];
    createdAt: string;
    updatedAt: string;
    expiresAt: string | null;
    /** Optimistic concurrency token for legacy full-session governance saves. */
    governanceRevision?: number;
  };

