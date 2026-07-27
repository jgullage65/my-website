import { runAssistant } from "@/app/lib/ai-engine/assistant-runtime/runAssistant";
import type {
  AssistantQualityModelSelection,
  AssistantQualityQuestionResult,
  AssistantQualityRunQuestion,
} from "./contracts";

export type RunAssistantQualityInput = {
  runId: string;
  projectId: string;
  modelSelection: AssistantQualityModelSelection;
  questions: AssistantQualityRunQuestion[];
};

export type RunAssistantQualityResult = {
  runId: string;
  status: "completed" | "failed";
  results: AssistantQualityQuestionResult[];
  startedAt: string;
  completedAt: string;
};

function normalizeErrorCode(cause: unknown): string {
  if (cause instanceof Error && cause.message.trim()) {
    return cause.message.trim().slice(0, 200);
  }

  return "assistant_quality_execution_failed";
}

function createResultId(runId: string, questionId: string): string {
  return `${runId}:${questionId}`;
}

export async function runAssistantQuality({
  runId,
  projectId,
  modelSelection,
  questions,
}: RunAssistantQualityInput): Promise<RunAssistantQualityResult> {
  const startedAt = new Date().toISOString();
  const orderedQuestions = [...questions].sort((a, b) => a.sequence - b.sequence);
  const results: AssistantQualityQuestionResult[] = [];

  for (const question of orderedQuestions) {
    const questionStartedAt = new Date().toISOString();

    try {
      const runtimeResult = await runAssistant({
        projectId,
        message: question.prompt,
        feature: "assistant_quality",
      });

      results.push({
        id: createResultId(runId, question.id),
        runId,
        questionId: question.id,
        status: "completed",
        answer: runtimeResult.response.answer,
        citations: runtimeResult.response.citations,
        execution: {
          provider: modelSelection.provider,
          model: modelSelection.model,
          feature: "assistant_quality",
        },
        errorCode: null,
        startedAt: questionStartedAt,
        completedAt: new Date().toISOString(),
      });
    } catch (cause) {
      results.push({
        id: createResultId(runId, question.id),
        runId,
        questionId: question.id,
        status: "failed",
        answer: null,
        citations: [],
        execution: {
          provider: modelSelection.provider,
          model: modelSelection.model,
          feature: "assistant_quality",
        },
        errorCode: normalizeErrorCode(cause),
        startedAt: questionStartedAt,
        completedAt: new Date().toISOString(),
      });
    }
  }

  const completedAt = new Date().toISOString();
  const completedCount = results.filter((result) => result.status === "completed").length;

  return {
    runId,
    status: completedCount > 0 ? "completed" : "failed",
    results,
    startedAt,
    completedAt,
  };
}
