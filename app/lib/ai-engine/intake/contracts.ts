/**
 * Intake Contracts
 *
 * Purpose:
 * Defines the model-agnostic contracts used while converting raw business
 * descriptions into proposed, reviewable business knowledge.
 */

import type {
    BusinessContextCategory,
    ContextConfidence,
    IntakeBlock,
  } from "@/lib/ai-engine/contracts";
  
  export type IntakeSourceBlock = Pick<IntakeBlock, "id" | "label" | "content">;
  
  export type IntakeExtractionRequest = {
    sessionId: string;
    blocks: IntakeSourceBlock[];
    assistantPurpose?: string | null;
    assistantTone?: string | null;
  };
  
  export type ExtractedBusinessFact = {
    temporaryId: string;
    category: BusinessContextCategory;
    title: string;
    content: string;
    confidence: ContextConfidence;
    confidenceScore: number;
    sourceBlockId: string;
    sourceExcerpt: string;
    tags: string[];
  };
  
  export type ExtractedFaqCandidate = {
    temporaryId: string;
    question: string;
    answer: string;
    confidence: ContextConfidence;
    confidenceScore: number;
    sourceBlockIds: string[];
    sourceExcerpts: string[];
    sourceFactIds: string[];
  };
  
  export type ExtractedConflictCandidate = {
    temporaryId: string;
    topic: string;
    firstStatement: string;
    secondStatement: string;
    sourceBlockIds: string[];
    sourceExcerpts: string[];
    suggestedQuestion: string;
  };
  
  export type ExtractedMissingInformation = {
    temporaryId: string;
    topic: string;
    reason: string;
    suggestedQuestion: string;
  };
  
  export type IntakeExtractionResult = {
    facts: ExtractedBusinessFact[];
    faqCandidates: ExtractedFaqCandidate[];
    conflicts: ExtractedConflictCandidate[];
    missingInformation: ExtractedMissingInformation[];
    summary: {
      businessName: string | null;
      businessType: string | null;
      primaryAudience: string | null;
      totalFacts: number;
      totalFaqCandidates: number;
      totalConflicts: number;
      totalMissingInformation: number;
    };
  };
  
  export type IntakeValidationIssueCode =
    | "invalid_root"
    | "invalid_facts"
    | "invalid_fact"
    | "invalid_category"
    | "invalid_confidence"
    | "invalid_confidence_score"
    | "missing_source_block"
    | "missing_source_excerpt"
    | "source_excerpt_not_found"
    | "invalid_faq_candidates"
    | "invalid_faq_candidate"
    | "invalid_conflicts"
    | "invalid_conflict"
    | "invalid_missing_information"
    | "invalid_missing_item"
    | "unsupported_inference"
    | "duplicate_item";
  
  export type IntakeValidationIssue = {
    code: IntakeValidationIssueCode;
    path: string;
    message: string;
  };
  
  export type IntakeValidationResult = {
    valid: boolean;
    value: IntakeExtractionResult | null;
    issues: IntakeValidationIssue[];
  };
  
  export type IntakeModelInput = {
    systemPrompt: string;
    userPrompt: string;
    responseFormatName: "business_intake_extraction";
  };
  
  export type IntakeModelRunner = (
    input: IntakeModelInput,
  ) => Promise<unknown>;
  
  export type IntakeExtractionDiagnostics = {
    inputBlockCount: number;
    inputCharacterCount: number;
    extractedFactCount: number;
    generatedFaqCount: number;
    conflictCount: number;
    missingInformationCount: number;
  };
  
  export type IntakeExtractionResponse = {
    result: IntakeExtractionResult;
    diagnostics: IntakeExtractionDiagnostics;
  };
  
  export type ConflictKind =
    | "duplicate"
    | "pricing"
    | "policy"
    | "service_area"
    | "hours"
    | "service_availability"
    | "general";
  
  export type DetectedIntakeConflict = {
    id: string;
    kind: ConflictKind;
    topic: string;
    firstFactId: string;
    secondFactId: string;
    firstStatement: string;
    secondStatement: string;
    sourceExcerpts: string[];
    suggestedQuestion: string;
  };
  
  export type GeneratedFaq = {
    id: string;
    question: string;
    answer: string;
    confidence: ContextConfidence;
    confidenceScore: number;
    sourceFactIds: string[];
    sourceBlockIds: string[];
    sourceExcerpts: string[];
  };
  