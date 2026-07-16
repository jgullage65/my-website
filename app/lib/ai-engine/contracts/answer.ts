/**
 * Grounded Answer Contracts
 *
 * Defines model output and deterministic validation results.
 */

import type { ContextConfidence } from "./business";

export type GroundedAnswer = {
  answer: string;
  confidence: ContextConfidence;
  usedContextIds: string[];
  missingInformation: string[];
  suggestedFollowUp: string | null;
};

export const ANSWER_VALIDATION_FAILURES = [
  "missing_answer",
  "invalid_confidence",
  "unknown_context_reference",
  "unsupported_pricing_claim",
  "unsupported_policy_claim",
  "prohibited_claim",
  "unsupported_guarantee",
  "missing_information_not_disclosed",
] as const;

export type AnswerValidationFailure =
  (typeof ANSWER_VALIDATION_FAILURES)[number];

export type AnswerValidationResult = {
  valid: boolean;
  answer: GroundedAnswer | null;
  failures: AnswerValidationFailure[];
  safeFallback: string | null;
};
