import type { AssistantQualityEvaluationContext } from "./evidenceContracts";
import {
  ASSISTANT_QUALITY_EVALUATION_DIMENSIONS,
  type AssistantQualityDimensionEvaluation,
  type AssistantQualityQuestionEvaluation,
  type AssistantQualityRunEvaluation,
} from "./evaluationContracts";
import {
  evaluateAssistantQualityQuestion,
  type AssistantQualityEvaluatorProvider,
} from "./evaluateQuestion";

export type EvaluateAssistantQualityRunInput = {
  runId: string;
  contexts: AssistantQualityEvaluationContext[];
  provider?: AssistantQualityEvaluatorProvider;
  model?: string | null;
  passingScore?: number;
};

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

function normalizeErrorCode(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim().slice(0, 200);
  }

  return "assistant_quality_evaluation_failed";
}

function createExecutionFailureEvaluation(
  context: AssistantQualityEvaluationContext,
): AssistantQualityQuestionEvaluation {
  const errorCode =
    context.result.errorCode?.trim() || "assistant_quality_execution_failed";
  const evaluatedAt = new Date().toISOString();

  return {
    runId: context.runId,
    questionId: context.question.id,
    status: "execution_failed",
    overallScore: 0,
    passed: false,
    summary: "The assistant could not complete this certification question.",
    strengths: [],
    issues: [`Execution failed: ${errorCode}`],
    dimensions: createNotScoredDimensions(
      "This dimension was not scored because the assistant execution failed.",
    ),
    evaluator: null,
    errorCode,
    evaluatedAt,
  };
}

function createEvaluationFailureEvaluation(
  context: AssistantQualityEvaluationContext,
  error: unknown,
): AssistantQualityQuestionEvaluation {
  const errorCode = normalizeErrorCode(error);
  const evaluatedAt = new Date().toISOString();

  return {
    runId: context.runId,
    questionId: context.question.id,
    status: "evaluation_failed",
    overallScore: null,
    passed: null,
    summary: "The assistant answered, but the certification engine could not score this question.",
    strengths: [],
    issues: [`Evaluation failed: ${errorCode}`],
    dimensions: createNotScoredDimensions(
      "This dimension was not scored because the certification evaluation failed.",
    ),
    evaluator: null,
    errorCode,
    evaluatedAt,
  };
}

function validateInput({
  runId,
  contexts,
  passingScore,
}: Pick<EvaluateAssistantQualityRunInput, "runId" | "contexts" | "passingScore">): string {
  const normalizedRunId = runId.trim();

  if (!normalizedRunId || contexts.length === 0) {
    throw new Error("invalid_assistant_quality_evaluation_request");
  }

  if (
    !Number.isInteger(passingScore) ||
    passingScore === undefined ||
    passingScore < 0 ||
    passingScore > 100
  ) {
    throw new Error("invalid_assistant_quality_passing_score");
  }

  const questionIds = new Set<string>();

  for (const context of contexts) {
    if (context.runId !== normalizedRunId || context.result.runId !== normalizedRunId) {
      throw new Error("assistant_quality_run_evaluation_context_mismatch");
    }

    if (questionIds.has(context.question.id)) {
      throw new Error("duplicate_assistant_quality_evaluation_question");
    }

    questionIds.add(context.question.id);
  }

  return normalizedRunId;
}

export async function evaluateAssistantQualityRun({
  runId,
  contexts,
  provider = "openai",
  model = null,
  passingScore = 80,
}: EvaluateAssistantQualityRunInput): Promise<AssistantQualityRunEvaluation> {
  const normalizedRunId = validateInput({
    runId,
    contexts,
    passingScore,
  });
  const orderedContexts = [...contexts].sort(
    (left, right) => left.question.sequence - right.question.sequence,
  );
  const evaluations: AssistantQualityQuestionEvaluation[] = [];

  for (const context of orderedContexts) {
    if (context.result.status !== "completed") {
      evaluations.push(createExecutionFailureEvaluation(context));
      continue;
    }

    try {
      const result = await evaluateAssistantQualityQuestion({
        context,
        provider,
        model,
      });

      evaluations.push(result.evaluation);
    } catch (error) {
      evaluations.push(createEvaluationFailureEvaluation(context, error));
    }
  }

  const completedEvaluations = evaluations.filter(
    (evaluation): evaluation is AssistantQualityQuestionEvaluation & {
      status: "completed";
      overallScore: number;
      passed: boolean;
    } =>
      evaluation.status === "completed" &&
      evaluation.overallScore !== null &&
      evaluation.passed !== null,
  );
  const failedQuestionCount = evaluations.filter(
    (evaluation) => evaluation.status === "execution_failed",
  ).length;
  const evaluationFailureCount = evaluations.filter(
    (evaluation) => evaluation.status === "evaluation_failed",
  ).length;
  const overallScore = completedEvaluations.length
    ? Math.round(
        completedEvaluations.reduce(
          (total, evaluation) => total + evaluation.overallScore,
          0,
        ) / completedEvaluations.length,
      )
    : null;
  const passed =
    overallScore === null
      ? null
      : failedQuestionCount === 0 &&
        evaluationFailureCount === 0 &&
        completedEvaluations.length === evaluations.length &&
        completedEvaluations.every((evaluation) => evaluation.passed) &&
        overallScore >= passingScore;

  return {
    runId: normalizedRunId,
    overallScore,
    passed,
    completedQuestionCount: completedEvaluations.length,
    failedQuestionCount,
    evaluationFailureCount,
    evaluations,
    evaluatedAt: new Date().toISOString(),
  };
}
