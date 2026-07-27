import type { AssistantQualityQuestionResult } from "./contracts";
import {
  ASSISTANT_QUALITY_EVALUATION_DIMENSIONS,
  type AssistantQualityDimensionEvaluation,
  type AssistantQualityQuestionEvaluation,
  type AssistantQualityRunEvaluation,
} from "./evaluationContracts";

function createNotScoredDimensions(
  rationale: string,
): AssistantQualityDimensionEvaluation[] {
  return ASSISTANT_QUALITY_EVALUATION_DIMENSIONS.map((dimension) => ({
    dimension,
    score: null,
    rating: "not_scored",
    rationale,
    evidence: [],
  }));
}

function evaluateExecutionFailure(
  result: AssistantQualityQuestionResult,
): AssistantQualityQuestionEvaluation {
  const issue = result.errorCode
    ? `Execution failed: ${result.errorCode}`
    : "Execution failed before an assistant answer was produced.";

  return {
    runId: result.runId,
    questionId: result.questionId,
    overallScore: 0,
    passed: false,
    summary: "The assistant could not complete this validation question.",
    strengths: [],
    issues: [issue],
    dimensions: createNotScoredDimensions(
      "This dimension was not scored because the assistant execution failed.",
    ),
    evaluatedAt: new Date().toISOString(),
  };
}

function createPendingEvaluation(
  result: AssistantQualityQuestionResult,
): AssistantQualityQuestionEvaluation {
  return {
    runId: result.runId,
    questionId: result.questionId,
    overallScore: null,
    passed: null,
    summary: "The assistant answer is ready for evidence-aware quality evaluation.",
    strengths: [],
    issues: [],
    dimensions: createNotScoredDimensions(
      "This dimension requires the evidence-aware evaluator and has not been scored yet.",
    ),
    evaluatedAt: new Date().toISOString(),
  };
}

export function evaluateAssistantQualityRun(
  runId: string,
  results: AssistantQualityQuestionResult[],
): AssistantQualityRunEvaluation {
  const normalizedRunId = runId.trim();

  if (!normalizedRunId) {
    throw new Error("invalid_assistant_quality_evaluation_request");
  }

  const evaluations = results.map((result) =>
    result.status === "failed"
      ? evaluateExecutionFailure(result)
      : createPendingEvaluation(result),
  );

  const scoredEvaluations = evaluations.filter(
    (evaluation): evaluation is AssistantQualityQuestionEvaluation & { overallScore: number } =>
      evaluation.overallScore !== null,
  );
  const completedQuestionCount = results.filter(
    (result) => result.status === "completed",
  ).length;
  const failedQuestionCount = results.filter(
    (result) => result.status === "failed",
  ).length;
  const overallScore = scoredEvaluations.length
    ? Math.round(
        scoredEvaluations.reduce((total, evaluation) => total + evaluation.overallScore, 0) /
          scoredEvaluations.length,
      )
    : null;

  return {
    runId: normalizedRunId,
    overallScore,
    passed:
      overallScore === null
        ? null
        : failedQuestionCount === 0 && overallScore >= 80,
    completedQuestionCount,
    failedQuestionCount,
    evaluations,
    evaluatedAt: new Date().toISOString(),
  };
}
