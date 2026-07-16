/**
 * Intake Validator
 *
 * Purpose:
 * Converts unknown model output into a strict IntakeExtractionResult.
 *
 * Validation rules:
 * - every fact must use a known category
 * - every fact must reference a real intake block
 * - every fact must include supporting source text
 * - confidence scores must be between 0 and 1
 * - unsupported or malformed items are rejected
 */

import {
    BUSINESS_CONTEXT_CATEGORIES,
    type BusinessContextCategory,
  } from "@/app/lib/ai-engine/contracts";
  import type {
    ExtractedBusinessFact,
    ExtractedConflictCandidate,
    ExtractedFaqCandidate,
    ExtractedMissingInformation,
    IntakeExtractionRequest,
    IntakeExtractionResult,
    IntakeValidationIssue,
    IntakeValidationResult,
  } from "./contracts";
  import {
    clampConfidenceScore,
    dedupeByKey,
    normalizeConfidence,
    normalizeInlineText,
    sourceExcerptExists,
    stableIntakeId,
    uniqueStrings,
  } from "./normalizer";
  
  function asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
  }
  
  function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }
  
  function asOptionalText(value: unknown): string | null {
    const normalized = normalizeInlineText(value);
    return normalized || null;
  }
  
  function isBusinessCategory(
    value: unknown,
  ): value is BusinessContextCategory {
    return BUSINESS_CONTEXT_CATEGORIES.includes(
      value as BusinessContextCategory,
    );
  }
  
  function addIssue(
    issues: IntakeValidationIssue[],
    issue: IntakeValidationIssue,
  ): void {
    issues.push(issue);
  }
  
  function validateFact(
    value: unknown,
    index: number,
    request: IntakeExtractionRequest,
    issues: IntakeValidationIssue[],
  ): ExtractedBusinessFact | null {
    const row = asRecord(value);
    const path = `facts[${index}]`;
    const category = row.category;
    const content = normalizeInlineText(row.content);
    const title = normalizeInlineText(row.title || content.slice(0, 100));
    const sourceBlockId = normalizeInlineText(
      row.sourceBlockId ?? row.source_block_id,
    );
    const sourceExcerpt = normalizeInlineText(
      row.sourceExcerpt ?? row.source_excerpt,
    );
    const confidenceScore = clampConfidenceScore(
      row.confidenceScore ?? row.confidence_score,
    );
  
    if (!isBusinessCategory(category)) {
      addIssue(issues, {
        code: "invalid_category",
        path: `${path}.category`,
        message: "Fact uses an unsupported business context category.",
      });
      return null;
    }
  
    if (!content || content.length < 4) {
      addIssue(issues, {
        code: "invalid_fact",
        path: `${path}.content`,
        message: "Fact content is missing or too short.",
      });
      return null;
    }
  
    const sourceBlock = request.blocks.find(
      (block) => block.id === sourceBlockId,
    );
  
    if (!sourceBlock) {
      addIssue(issues, {
        code: "missing_source_block",
        path: `${path}.sourceBlockId`,
        message: "Fact does not reference a known intake block.",
      });
      return null;
    }
  
    if (!sourceExcerpt) {
      addIssue(issues, {
        code: "missing_source_excerpt",
        path: `${path}.sourceExcerpt`,
        message: "Fact does not include supporting source text.",
      });
      return null;
    }
  
    if (!sourceExcerptExists(sourceBlock.content, sourceExcerpt)) {
      addIssue(issues, {
        code: "source_excerpt_not_found",
        path: `${path}.sourceExcerpt`,
        message: "Supporting source text was not found in the referenced block.",
      });
      return null;
    }
  
    return {
      temporaryId:
        normalizeInlineText(row.temporaryId ?? row.temporary_id) ||
        stableIntakeId(
          `${request.sessionId}:${category}:${content}:${sourceBlockId}`,
          "fact",
        ),
      category,
      title: title || content.slice(0, 100),
      content,
      confidence: normalizeConfidence(row.confidence, confidenceScore),
      confidenceScore,
      sourceBlockId,
      sourceExcerpt,
      tags: uniqueStrings(asArray(row.tags), 8),
    };
  }
  
  function validateFaq(
    value: unknown,
    index: number,
    request: IntakeExtractionRequest,
    factIds: Set<string>,
    issues: IntakeValidationIssue[],
  ): ExtractedFaqCandidate | null {
    const row = asRecord(value);
    const path = `faqCandidates[${index}]`;
    const question = normalizeInlineText(row.question);
    const answer = normalizeInlineText(row.answer);
    const confidenceScore = clampConfidenceScore(
      row.confidenceScore ?? row.confidence_score,
    );
    const sourceBlockIds = uniqueStrings(
      asArray(row.sourceBlockIds ?? row.source_block_ids),
      8,
    ).filter((id) => request.blocks.some((block) => block.id === id));
    const sourceFactIds = uniqueStrings(
      asArray(row.sourceFactIds ?? row.source_fact_ids),
      12,
    ).filter((id) => factIds.has(id));
    const sourceExcerpts = uniqueStrings(
      asArray(row.sourceExcerpts ?? row.source_excerpts),
      8,
    );
  
    if (!question || !answer) {
      addIssue(issues, {
        code: "invalid_faq_candidate",
        path,
        message: "FAQ candidate must include both a question and an answer.",
      });
      return null;
    }
  
    if (sourceBlockIds.length === 0 || sourceExcerpts.length === 0) {
      addIssue(issues, {
        code: "missing_source_excerpt",
        path,
        message: "FAQ candidate must include source blocks and excerpts.",
      });
      return null;
    }
  
    return {
      temporaryId:
        normalizeInlineText(row.temporaryId ?? row.temporary_id) ||
        stableIntakeId(
          `${request.sessionId}:${question}:${answer}`,
          "faq",
        ),
      question,
      answer,
      confidence: normalizeConfidence(row.confidence, confidenceScore),
      confidenceScore,
      sourceBlockIds,
      sourceExcerpts,
      sourceFactIds,
    };
  }
  
  function validateConflict(
    value: unknown,
    index: number,
    request: IntakeExtractionRequest,
    issues: IntakeValidationIssue[],
  ): ExtractedConflictCandidate | null {
    const row = asRecord(value);
    const path = `conflicts[${index}]`;
    const topic = normalizeInlineText(row.topic);
    const firstStatement = normalizeInlineText(
      row.firstStatement ?? row.first_statement,
    );
    const secondStatement = normalizeInlineText(
      row.secondStatement ?? row.second_statement,
    );
    const sourceBlockIds = uniqueStrings(
      asArray(row.sourceBlockIds ?? row.source_block_ids),
      6,
    ).filter((id) => request.blocks.some((block) => block.id === id));
    const sourceExcerpts = uniqueStrings(
      asArray(row.sourceExcerpts ?? row.source_excerpts),
      6,
    );
    const suggestedQuestion = normalizeInlineText(
      row.suggestedQuestion ?? row.suggested_question,
    );
  
    if (
      !topic ||
      !firstStatement ||
      !secondStatement ||
      !suggestedQuestion ||
      sourceBlockIds.length === 0 ||
      sourceExcerpts.length < 2
    ) {
      addIssue(issues, {
        code: "invalid_conflict",
        path,
        message: "Conflict candidate is incomplete.",
      });
      return null;
    }
  
    return {
      temporaryId:
        normalizeInlineText(row.temporaryId ?? row.temporary_id) ||
        stableIntakeId(
          `${request.sessionId}:${topic}:${firstStatement}:${secondStatement}`,
          "conflict",
        ),
      topic,
      firstStatement,
      secondStatement,
      sourceBlockIds,
      sourceExcerpts,
      suggestedQuestion,
    };
  }
  
  function validateMissingInformation(
    value: unknown,
    index: number,
    issues: IntakeValidationIssue[],
  ): ExtractedMissingInformation | null {
    const row = asRecord(value);
    const path = `missingInformation[${index}]`;
    const topic = normalizeInlineText(row.topic);
    const reason = normalizeInlineText(row.reason);
    const suggestedQuestion = normalizeInlineText(
      row.suggestedQuestion ?? row.suggested_question,
    );
  
    if (!topic || !reason || !suggestedQuestion) {
      addIssue(issues, {
        code: "invalid_missing_item",
        path,
        message: "Missing-information candidate is incomplete.",
      });
      return null;
    }
  
    return {
      temporaryId:
        normalizeInlineText(row.temporaryId ?? row.temporary_id) ||
        stableIntakeId(`${topic}:${reason}`, "missing"),
      topic,
      reason,
      suggestedQuestion,
    };
  }
  
  export function validateIntakeExtraction(params: {
    value: unknown;
    request: IntakeExtractionRequest;
  }): IntakeValidationResult {
    const root = asRecord(params.value);
    const issues: IntakeValidationIssue[] = [];
  
    if (Object.keys(root).length === 0) {
      return {
        valid: false,
        value: null,
        issues: [
          {
            code: "invalid_root",
            path: "$",
            message: "Extraction output must be an object.",
          },
        ],
      };
    }
  
    const facts = asArray(root.facts)
      .map((item, index) =>
        validateFact(item, index, params.request, issues),
      )
      .filter((item): item is ExtractedBusinessFact => Boolean(item));
  
    const dedupedFacts = dedupeByKey(
      facts,
      (fact) => `${fact.category}:${fact.content}`,
    );
  
    if (dedupedFacts.length !== facts.length) {
      addIssue(issues, {
        code: "duplicate_item",
        path: "facts",
        message: "Duplicate facts were removed.",
      });
    }
  
    const factIds = new Set(dedupedFacts.map((fact) => fact.temporaryId));
  
    const faqCandidates = dedupeByKey(
      asArray(root.faqCandidates ?? root.faq_candidates)
        .map((item, index) =>
          validateFaq(item, index, params.request, factIds, issues),
        )
        .filter((item): item is ExtractedFaqCandidate => Boolean(item)),
      (faq) => faq.question,
    );
  
    const conflicts = dedupeByKey(
      asArray(root.conflicts)
        .map((item, index) =>
          validateConflict(item, index, params.request, issues),
        )
        .filter((item): item is ExtractedConflictCandidate => Boolean(item)),
      (conflict) =>
        `${conflict.topic}:${conflict.firstStatement}:${conflict.secondStatement}`,
    );
  
    const missingInformation = dedupeByKey(
      asArray(root.missingInformation ?? root.missing_information)
        .map((item, index) =>
          validateMissingInformation(item, index, issues),
        )
        .filter(
          (item): item is ExtractedMissingInformation => Boolean(item),
        ),
      (item) => item.topic,
    );
  
    const summaryRow = asRecord(root.summary);
  
    const value: IntakeExtractionResult = {
      facts: dedupedFacts,
      faqCandidates,
      conflicts,
      missingInformation,
      summary: {
        businessName: asOptionalText(
          summaryRow.businessName ?? summaryRow.business_name,
        ),
        businessType: asOptionalText(
          summaryRow.businessType ?? summaryRow.business_type,
        ),
        primaryAudience: asOptionalText(
          summaryRow.primaryAudience ?? summaryRow.primary_audience,
        ),
        totalFacts: dedupedFacts.length,
        totalFaqCandidates: faqCandidates.length,
        totalConflicts: conflicts.length,
        totalMissingInformation: missingInformation.length,
      },
    };
  
    const fatalIssueCodes = new Set([
      "invalid_root",
      "invalid_fact",
      "invalid_category",
      "missing_source_block",
      "missing_source_excerpt",
      "source_excerpt_not_found",
    ]);
  
    return {
      valid: !issues.some((issue) => fatalIssueCodes.has(issue.code)),
      value,
      issues,
    };
  }
  