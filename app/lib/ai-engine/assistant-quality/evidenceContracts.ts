import type {
  AssistantQualityQuestionDefinition,
  AssistantQualityQuestionResult,
  AssistantQualityRunQuestion,
} from "./contracts";

export type AssistantQualityEvidenceItem = {
  id: string;
  label: string;
  content: string;
  category:
    | "company"
    | "service"
    | "product"
    | "pricing"
    | "policy"
    | "faq"
    | "restriction"
    | "other";
  sourceUrl: string | null;
};

export type AssistantQualityEvaluationContext = {
  runId: string;
  projectId: string;
  question: AssistantQualityRunQuestion;
  definition: AssistantQualityQuestionDefinition | null;
  result: AssistantQualityQuestionResult;
  canonicalEvidence: AssistantQualityEvidenceItem[];
};

export type BuildAssistantQualityEvaluationContextInput = {
  runId: string;
  projectId: string;
  question: AssistantQualityRunQuestion;
  definition?: AssistantQualityQuestionDefinition | null;
  result: AssistantQualityQuestionResult;
  canonicalEvidence?: AssistantQualityEvidenceItem[];
};

export function buildAssistantQualityEvaluationContext({
  runId,
  projectId,
  question,
  definition = null,
  result,
  canonicalEvidence = [],
}: BuildAssistantQualityEvaluationContextInput): AssistantQualityEvaluationContext {
  const normalizedRunId = runId.trim();
  const normalizedProjectId = projectId.trim();

  if (!normalizedRunId || !normalizedProjectId) {
    throw new Error("invalid_assistant_quality_evaluation_context");
  }

  if (result.runId !== normalizedRunId || result.questionId !== question.id) {
    throw new Error("assistant_quality_evaluation_context_mismatch");
  }

  return {
    runId: normalizedRunId,
    projectId: normalizedProjectId,
    question,
    definition,
    result,
    canonicalEvidence,
  };
}
