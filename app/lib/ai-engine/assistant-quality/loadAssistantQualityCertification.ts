import "server-only";

import { Pool } from "@neondatabase/serverless";
import { ensureAiBuilderSchema } from "@/app/lib/db/ai-builder-schema";
import { ensureAssistantQualitySchema } from "@/app/lib/db/assistant-quality-schema";
import type {
  AssistantQualityExecutionMetadata,
  AssistantQualityQuestionDefinition,
  AssistantQualityQuestionResult,
  AssistantQualityRun,
  AssistantQualityRunQuestion,
} from "./contracts";
import type {
  AssistantQualityDimensionEvaluation,
  AssistantQualityEvaluatorMetadata,
  AssistantQualityQuestionEvaluation,
  AssistantQualityRunEvaluation,
} from "./evaluationContracts";

let pool: Pool | null = null;

function queryPool(): Pool {
  return (pool ??= new Pool({ connectionString: process.env.DATABASE_URL }));
}

export type LoadedAssistantQualityCertification = {
  run: AssistantQualityRun;
  definitions: Record<string, AssistantQualityQuestionDefinition | null>;
  results: AssistantQualityQuestionResult[];
  evaluation: AssistantQualityRunEvaluation;
  passingScore: number;
  evaluatorProvider: string | null;
  evaluatorModel: string | null;
};

function iso(value: unknown): string {
  return new Date(value as string | number | Date).toISOString();
}

function nullableIso(value: unknown): string | null {
  return value ? iso(value) : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error("invalid_assistant_quality_persisted_json");
  }
  return value;
}

export async function loadAssistantQualityCertification(
  runId: string,
): Promise<LoadedAssistantQualityCertification | null> {
  const normalizedRunId = runId.trim();
  if (!normalizedRunId) throw new Error("invalid_assistant_quality_run_id");

  await ensureAiBuilderSchema();
  await ensureAssistantQualitySchema();

  const client = await queryPool().connect();

  try {
    const [runResult, questionResult, executionResult, evaluationResult] =
      await Promise.all([
        client.query("SELECT * FROM assistant_quality_runs WHERE id = $1", [normalizedRunId]),
        client.query(
          "SELECT * FROM assistant_quality_run_questions WHERE run_id = $1 ORDER BY sequence ASC",
          [normalizedRunId],
        ),
        client.query(
          "SELECT * FROM assistant_quality_question_results WHERE run_id = $1 ORDER BY created_at ASC",
          [normalizedRunId],
        ),
        client.query(
          "SELECT * FROM assistant_quality_question_evaluations WHERE run_id = $1 ORDER BY created_at ASC",
          [normalizedRunId],
        ),
      ]);

    const runRow = runResult.rows[0];
    if (!runRow) return null;

    const questions: AssistantQualityRunQuestion[] = questionResult.rows.map((row) => ({
      id: String(row.id),
      definitionId: row.definition_id ? String(row.definition_id) : null,
      title: String(row.title),
      prompt: String(row.prompt),
      category: row.category,
      source: row.source,
      status: row.status,
      sequence: Number(row.sequence),
    }));

    const definitions: Record<string, AssistantQualityQuestionDefinition | null> = {};
    for (const row of questionResult.rows) {
      definitions[String(row.id)] = row.definition_id
        ? {
            id: String(row.definition_id),
            title: String(row.title),
            prompt: String(row.prompt),
            category: row.category,
            source: row.source,
            purpose: row.purpose ? String(row.purpose) : "",
            expectedBehavior: stringArray(row.expected_behavior),
            tags: stringArray(row.tags),
            enabledByDefault: true,
          }
        : null;
    }

    const results: AssistantQualityQuestionResult[] = executionResult.rows.map((row) => ({
      id: String(row.id),
      runId: String(row.run_id),
      questionId: String(row.question_id),
      status: row.status,
      answer: row.answer === null ? null : String(row.answer),
      citations: stringArray(row.citations),
      execution: row.execution_metadata
        ? (row.execution_metadata as AssistantQualityExecutionMetadata)
        : null,
      errorCode: row.error_code === null ? null : String(row.error_code),
      startedAt: nullableIso(row.started_at),
      completedAt: nullableIso(row.completed_at),
    }));

    const evaluations: AssistantQualityQuestionEvaluation[] = evaluationResult.rows.map((row) => ({
      runId: String(row.run_id),
      questionId: String(row.question_id),
      status: row.status,
      overallScore: row.overall_score === null ? null : Number(row.overall_score),
      passed: row.passed === null ? null : Boolean(row.passed),
      summary: String(row.summary),
      strengths: stringArray(row.strengths),
      issues: stringArray(row.issues),
      dimensions: row.dimensions as AssistantQualityDimensionEvaluation[],
      evaluator: row.evaluator_metadata
        ? (row.evaluator_metadata as AssistantQualityEvaluatorMetadata)
        : null,
      errorCode: row.error_code === null ? null : String(row.error_code),
      evaluatedAt: iso(row.evaluated_at),
    }));

    const questionIds = new Set(questions.map((question) => question.id));
    const resultIds = new Set(results.map((result) => result.questionId));
    const evaluationIds = new Set(evaluations.map((evaluation) => evaluation.questionId));

    if (
      questions.length !== results.length ||
      questions.length !== evaluations.length ||
      resultIds.size !== questions.length ||
      evaluationIds.size !== questions.length ||
      [...resultIds].some((id) => !questionIds.has(id)) ||
      [...evaluationIds].some((id) => !questionIds.has(id)) ||
      results.some((result) => result.runId !== normalizedRunId) ||
      evaluations.some((evaluation) => evaluation.runId !== normalizedRunId)
    ) {
      throw new Error("assistant_quality_certification_integrity_error");
    }

    const run: AssistantQualityRun = {
      id: String(runRow.id),
      projectId: String(runRow.project_id),
      status: runRow.status,
      modelSelection: {
        provider: String(runRow.assistant_provider),
        model: String(runRow.assistant_model),
      },
      questions,
      createdAt: iso(runRow.created_at),
      startedAt: nullableIso(runRow.started_at),
      completedAt: nullableIso(runRow.completed_at),
    };

    const evaluation: AssistantQualityRunEvaluation = {
      runId: String(runRow.id),
      overallScore: runRow.overall_score === null ? null : Number(runRow.overall_score),
      passed: runRow.passed === null ? null : Boolean(runRow.passed),
      completedQuestionCount: Number(runRow.completed_question_count),
      failedQuestionCount: Number(runRow.failed_question_count),
      evaluationFailureCount: Number(runRow.evaluation_failure_count),
      evaluations,
      evaluatedAt: iso(runRow.evaluated_at),
    };

    return {
      run,
      definitions,
      results,
      evaluation,
      passingScore: Number(runRow.passing_score),
      evaluatorProvider: runRow.evaluator_provider ? String(runRow.evaluator_provider) : null,
      evaluatorModel: runRow.evaluator_model ? String(runRow.evaluator_model) : null,
    };
  } finally {
    client.release();
  }
}
