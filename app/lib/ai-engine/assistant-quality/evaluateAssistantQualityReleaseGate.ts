import type { AssistantQualityRunEvaluation } from "./evaluationContracts";

export type AssistantQualityReleaseGateStatus =
  | "passed"
  | "blocked"
  | "incomplete";

export type AssistantQualityReleaseGateReason =
  | "certification_passed"
  | "certification_failed"
  | "certification_incomplete"
  | "score_below_required_threshold"
  | "evaluation_failures_present"
  | "execution_failures_present"
  | "regression_exceeds_limit";

export type AssistantQualityReleaseGatePolicy = {
  requiredScore: number;
  maximumScoreRegression: number;
  allowExecutionFailures: boolean;
  allowEvaluationFailures: boolean;
};

export type AssistantQualityReleaseGateInput = {
  evaluation: AssistantQualityRunEvaluation;
  previousOverallScore?: number | null;
  policy?: Partial<AssistantQualityReleaseGatePolicy>;
};

export type AssistantQualityReleaseGateDecision = {
  status: AssistantQualityReleaseGateStatus;
  allowed: boolean;
  reasons: AssistantQualityReleaseGateReason[];
  requiredScore: number;
  currentScore: number | null;
  previousScore: number | null;
  scoreDelta: number | null;
  maximumScoreRegression: number;
  completedQuestionCount: number;
  failedQuestionCount: number;
  evaluationFailureCount: number;
};

const DEFAULT_POLICY: AssistantQualityReleaseGatePolicy = {
  requiredScore: 80,
  maximumScoreRegression: 5,
  allowExecutionFailures: false,
  allowEvaluationFailures: false,
};

function normalizePolicy(
  input: Partial<AssistantQualityReleaseGatePolicy> | undefined,
): AssistantQualityReleaseGatePolicy {
  const policy = { ...DEFAULT_POLICY, ...input };

  if (!Number.isFinite(policy.requiredScore) || policy.requiredScore < 0 || policy.requiredScore > 100) {
    throw new Error("invalid_assistant_quality_release_required_score");
  }

  if (
    !Number.isFinite(policy.maximumScoreRegression) ||
    policy.maximumScoreRegression < 0 ||
    policy.maximumScoreRegression > 100
  ) {
    throw new Error("invalid_assistant_quality_release_regression_limit");
  }

  return policy;
}

export function evaluateAssistantQualityReleaseGate(
  input: AssistantQualityReleaseGateInput,
): AssistantQualityReleaseGateDecision {
  const policy = normalizePolicy(input.policy);
  const currentScore = input.evaluation.overallScore;
  const previousScore = input.previousOverallScore ?? null;
  const scoreDelta =
    currentScore === null || previousScore === null
      ? null
      : currentScore - previousScore;
  const reasons: AssistantQualityReleaseGateReason[] = [];

  if (currentScore === null || input.evaluation.passed === null) {
    reasons.push("certification_incomplete");
  }

  if (input.evaluation.passed === false) {
    reasons.push("certification_failed");
  }

  if (currentScore !== null && currentScore < policy.requiredScore) {
    reasons.push("score_below_required_threshold");
  }

  if (
    !policy.allowExecutionFailures &&
    input.evaluation.failedQuestionCount > 0
  ) {
    reasons.push("execution_failures_present");
  }

  if (
    !policy.allowEvaluationFailures &&
    input.evaluation.evaluationFailureCount > 0
  ) {
    reasons.push("evaluation_failures_present");
  }

  if (
    scoreDelta !== null &&
    scoreDelta < 0 &&
    Math.abs(scoreDelta) > policy.maximumScoreRegression
  ) {
    reasons.push("regression_exceeds_limit");
  }

  const incomplete = reasons.includes("certification_incomplete");
  const blocked = reasons.some((reason) => reason !== "certification_incomplete");

  if (!incomplete && !blocked) {
    reasons.push("certification_passed");
  }

  const status: AssistantQualityReleaseGateStatus = incomplete
    ? "incomplete"
    : blocked
      ? "blocked"
      : "passed";

  return {
    status,
    allowed: status === "passed",
    reasons,
    requiredScore: policy.requiredScore,
    currentScore,
    previousScore,
    scoreDelta,
    maximumScoreRegression: policy.maximumScoreRegression,
    completedQuestionCount: input.evaluation.completedQuestionCount,
    failedQuestionCount: input.evaluation.failedQuestionCount,
    evaluationFailureCount: input.evaluation.evaluationFailureCount,
  };
}
