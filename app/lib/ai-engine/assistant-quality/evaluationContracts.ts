export type AssistantQualityEvaluationDimension =
  | "knowledge_accuracy"
  | "grounding"
  | "conversation_quality"
  | "reasoning"
  | "hallucination_resistance"
  | "tone_consistency"
  | "business_readiness";

export type AssistantQualityEvaluationRating =
  | "excellent"
  | "good"
  | "needs_improvement"
  | "poor"
  | "not_scored";

export type AssistantQualityEvaluationStatus =
  | "completed"
  | "execution_failed"
  | "evaluation_failed";

export type AssistantQualityDimensionEvaluation = {
  dimension: AssistantQualityEvaluationDimension;
  score: number | null;
  rating: AssistantQualityEvaluationRating;
  rationale: string;
  evidence: string[];
};

export type AssistantQualityEvaluatorMetadata = {
  provider: string;
  model: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
};

export type AssistantQualityQuestionEvaluation = {
  runId: string;
  questionId: string;
  status: AssistantQualityEvaluationStatus;
  overallScore: number | null;
  passed: boolean | null;
  summary: string;
  strengths: string[];
  issues: string[];
  dimensions: AssistantQualityDimensionEvaluation[];
  evaluator: AssistantQualityEvaluatorMetadata | null;
  errorCode: string | null;
  evaluatedAt: string;
};

export type AssistantQualityRunEvaluation = {
  runId: string;
  overallScore: number | null;
  passed: boolean | null;
  completedQuestionCount: number;
  failedQuestionCount: number;
  evaluationFailureCount: number;
  evaluations: AssistantQualityQuestionEvaluation[];
  evaluatedAt: string;
};

export const ASSISTANT_QUALITY_EVALUATION_DIMENSIONS: AssistantQualityEvaluationDimension[] = [
  "knowledge_accuracy",
  "grounding",
  "conversation_quality",
  "reasoning",
  "hallucination_resistance",
  "tone_consistency",
  "business_readiness",
];
