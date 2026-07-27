import { runOpenAiEvaluation } from "../providers/openaiEvaluationRunner";
import { buildAssistantQualityEvaluationPrompt } from "./buildEvaluationPrompt";
import type { AssistantQualityEvaluationContext } from "./evidenceContracts";
import type { AssistantQualityQuestionEvaluation } from "./evaluationContracts";
import { parseAssistantQualityEvaluationResponse } from "./parseEvaluationResponse";

export type AssistantQualityEvaluatorProvider = "openai";

export type AssistantQualityEvaluatorMetadata = {
  provider: AssistantQualityEvaluatorProvider;
  model: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
};

export type EvaluateAssistantQualityQuestionInput = {
  context: AssistantQualityEvaluationContext;
  provider?: AssistantQualityEvaluatorProvider;
  model?: string | null;
};

export type EvaluateAssistantQualityQuestionOutput = {
  evaluation: AssistantQualityQuestionEvaluation;
  evaluator: AssistantQualityEvaluatorMetadata;
};

function normalizeEvaluatorError(error: unknown): Error {
  if (error instanceof Error && error.message.trim()) {
    return error;
  }

  return new Error("assistant_quality_evaluation_failed");
}

export async function evaluateAssistantQualityQuestion({
  context,
  provider = "openai",
  model = null,
}: EvaluateAssistantQualityQuestionInput): Promise<EvaluateAssistantQualityQuestionOutput> {
  if (context.result.status !== "completed" || !context.result.answer?.trim()) {
    throw new Error("assistant_quality_question_not_ready_for_evaluation");
  }

  if (provider !== "openai") {
    throw new Error(`unsupported_assistant_quality_evaluator_provider:${provider}`);
  }

  const prompt = buildAssistantQualityEvaluationPrompt(context);
  const startedAt = new Date();
  const startedAtIso = startedAt.toISOString();

  try {
    const providerResult = await runOpenAiEvaluation({
      prompt,
      model,
    });
    const parsed = parseAssistantQualityEvaluationResponse(
      providerResult.response,
    );
    const completedAt = new Date();

    return {
      evaluation: {
        runId: context.runId,
        questionId: context.question.id,
        overallScore: parsed.overallScore,
        passed: parsed.passed,
        summary: parsed.summary,
        strengths: parsed.strengths,
        issues: parsed.issues,
        dimensions: parsed.dimensions,
        evaluatedAt: completedAt.toISOString(),
      },
      evaluator: {
        provider: providerResult.provider,
        model: providerResult.model,
        startedAt: startedAtIso,
        completedAt: completedAt.toISOString(),
        durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
      },
    };
  } catch (error) {
    throw normalizeEvaluatorError(error);
  }
}
