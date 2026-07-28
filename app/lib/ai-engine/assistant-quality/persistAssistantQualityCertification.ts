import "server-only";

import { Pool, type PoolClient } from "@neondatabase/serverless";
import { ensureAiBuilderSchema } from "@/app/lib/db/ai-builder-schema";
import { ensureAssistantQualitySchema } from "@/app/lib/db/assistant-quality-schema";
import type { AssistantQualityRun } from "./contracts";
import type { AssistantQualityEvaluationContext } from "./evidenceContracts";
import type { AssistantQualityRunEvaluation } from "./evaluationContracts";

let pool: Pool | null = null;

function transactionPool(): Pool {
  return (pool ??= new Pool({ connectionString: process.env.DATABASE_URL }));
}

export type PersistAssistantQualityCertificationInput = {
  run: AssistantQualityRun;
  contexts: AssistantQualityEvaluationContext[];
  evaluation: AssistantQualityRunEvaluation;
  evaluatorProvider: string;
  evaluatorModel: string;
  passingScore?: number;
};

function assertCertificationConsistency({
  run,
  contexts,
  evaluation,
  passingScore,
}: Pick<
  PersistAssistantQualityCertificationInput,
  "run" | "contexts" | "evaluation" | "passingScore"
>): number {
  const normalizedPassingScore = passingScore ?? 80;

  if (
    !run.id.trim() ||
    !run.projectId.trim() ||
    evaluation.runId !== run.id ||
    contexts.length !== run.questions.length ||
    evaluation.evaluations.length !== run.questions.length ||
    !Number.isInteger(normalizedPassingScore) ||
    normalizedPassingScore < 0 ||
    normalizedPassingScore > 100
  ) {
    throw new Error("invalid_assistant_quality_certification_snapshot");
  }

  const runQuestionIds = new Set(run.questions.map((question) => question.id));
  const contextQuestionIds = new Set<string>();
  const evaluationQuestionIds = new Set<string>();

  for (const context of contexts) {
    if (
      context.runId !== run.id ||
      context.projectId !== run.projectId ||
      context.result.runId !== run.id ||
      context.result.questionId !== context.question.id ||
      !runQuestionIds.has(context.question.id) ||
      contextQuestionIds.has(context.question.id)
    ) {
      throw new Error("assistant_quality_certification_context_mismatch");
    }

    contextQuestionIds.add(context.question.id);
  }

  for (const questionEvaluation of evaluation.evaluations) {
    if (
      questionEvaluation.runId !== run.id ||
      !runQuestionIds.has(questionEvaluation.questionId) ||
      evaluationQuestionIds.has(questionEvaluation.questionId)
    ) {
      throw new Error("assistant_quality_certification_evaluation_mismatch");
    }

    evaluationQuestionIds.add(questionEvaluation.questionId);
  }

  return normalizedPassingScore;
}

async function upsertRun(
  client: PoolClient,
  input: PersistAssistantQualityCertificationInput,
  passingScore: number,
): Promise<void> {
  const { run, evaluation, evaluatorProvider, evaluatorModel } = input;

  await client.query(
    `
      INSERT INTO assistant_quality_runs (
        id, project_id, status, assistant_provider, assistant_model,
        evaluator_provider, evaluator_model, passing_score, overall_score,
        passed, completed_question_count, failed_question_count,
        evaluation_failure_count, created_at, started_at, completed_at,
        evaluated_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        assistant_provider = EXCLUDED.assistant_provider,
        assistant_model = EXCLUDED.assistant_model,
        evaluator_provider = EXCLUDED.evaluator_provider,
        evaluator_model = EXCLUDED.evaluator_model,
        passing_score = EXCLUDED.passing_score,
        overall_score = EXCLUDED.overall_score,
        passed = EXCLUDED.passed,
        completed_question_count = EXCLUDED.completed_question_count,
        failed_question_count = EXCLUDED.failed_question_count,
        evaluation_failure_count = EXCLUDED.evaluation_failure_count,
        started_at = EXCLUDED.started_at,
        completed_at = EXCLUDED.completed_at,
        evaluated_at = EXCLUDED.evaluated_at,
        updated_at = NOW()
    `,
    [
      run.id,
      run.projectId,
      run.status,
      run.modelSelection.provider,
      run.modelSelection.model,
      evaluatorProvider,
      evaluatorModel,
      passingScore,
      evaluation.overallScore,
      evaluation.passed,
      evaluation.completedQuestionCount,
      evaluation.failedQuestionCount,
      evaluation.evaluationFailureCount,
      run.createdAt,
      run.startedAt,
      run.completedAt,
      evaluation.evaluatedAt,
    ],
  );
}

async function upsertQuestionSnapshot(
  client: PoolClient,
  context: AssistantQualityEvaluationContext,
): Promise<void> {
  const { question, definition, result } = context;

  await client.query(
    `
      INSERT INTO assistant_quality_run_questions (
        id, run_id, definition_id, title, prompt, category, source,
        purpose, expected_behavior, tags, status, sequence, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        definition_id = EXCLUDED.definition_id,
        title = EXCLUDED.title,
        prompt = EXCLUDED.prompt,
        category = EXCLUDED.category,
        source = EXCLUDED.source,
        purpose = EXCLUDED.purpose,
        expected_behavior = EXCLUDED.expected_behavior,
        tags = EXCLUDED.tags,
        status = EXCLUDED.status,
        sequence = EXCLUDED.sequence,
        updated_at = NOW()
    `,
    [
      question.id,
      context.runId,
      question.definitionId,
      question.title,
      question.prompt,
      question.category,
      question.source,
      definition?.purpose ?? null,
      JSON.stringify(definition?.expectedBehavior ?? []),
      JSON.stringify(definition?.tags ?? []),
      question.status,
      question.sequence,
    ],
  );

  await client.query(
    `
      INSERT INTO assistant_quality_question_results (
        id, run_id, question_id, status, answer, citations,
        execution_metadata, error_code, started_at, completed_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, NOW()
      )
      ON CONFLICT (run_id, question_id) DO UPDATE SET
        id = EXCLUDED.id,
        status = EXCLUDED.status,
        answer = EXCLUDED.answer,
        citations = EXCLUDED.citations,
        execution_metadata = EXCLUDED.execution_metadata,
        error_code = EXCLUDED.error_code,
        started_at = EXCLUDED.started_at,
        completed_at = EXCLUDED.completed_at,
        updated_at = NOW()
    `,
    [
      result.id,
      result.runId,
      result.questionId,
      result.status,
      result.answer,
      JSON.stringify(result.citations),
      result.execution ? JSON.stringify(result.execution) : null,
      result.errorCode,
      result.startedAt,
      result.completedAt,
    ],
  );
}

async function upsertQuestionEvaluation(
  client: PoolClient,
  evaluation: AssistantQualityRunEvaluation["evaluations"][number],
): Promise<void> {
  await client.query(
    `
      INSERT INTO assistant_quality_question_evaluations (
        run_id, question_id, status, overall_score, passed, summary,
        strengths, issues, dimensions, evaluator_metadata, error_code,
        evaluated_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb,
        $10::jsonb, $11, $12, NOW()
      )
      ON CONFLICT (run_id, question_id) DO UPDATE SET
        status = EXCLUDED.status,
        overall_score = EXCLUDED.overall_score,
        passed = EXCLUDED.passed,
        summary = EXCLUDED.summary,
        strengths = EXCLUDED.strengths,
        issues = EXCLUDED.issues,
        dimensions = EXCLUDED.dimensions,
        evaluator_metadata = EXCLUDED.evaluator_metadata,
        error_code = EXCLUDED.error_code,
        evaluated_at = EXCLUDED.evaluated_at,
        updated_at = NOW()
    `,
    [
      evaluation.runId,
      evaluation.questionId,
      evaluation.status,
      evaluation.overallScore,
      evaluation.passed,
      evaluation.summary,
      JSON.stringify(evaluation.strengths),
      JSON.stringify(evaluation.issues),
      JSON.stringify(evaluation.dimensions),
      evaluation.evaluator ? JSON.stringify(evaluation.evaluator) : null,
      evaluation.errorCode,
      evaluation.evaluatedAt,
    ],
  );
}

export async function persistAssistantQualityCertification(
  input: PersistAssistantQualityCertificationInput,
): Promise<void> {
  const passingScore = assertCertificationConsistency(input);

  await ensureAiBuilderSchema();
  await ensureAssistantQualitySchema();

  const client = await transactionPool().connect();

  try {
    await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
    await upsertRun(client, input, passingScore);

    for (const context of [...input.contexts].sort(
      (left, right) => left.question.sequence - right.question.sequence,
    )) {
      await upsertQuestionSnapshot(client, context);
    }

    for (const evaluation of input.evaluation.evaluations) {
      await upsertQuestionEvaluation(client, evaluation);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
