import { NextResponse } from "next/server";
import { requireClerkUserId } from "@/app/lib/auth/clerk";
import { ensureAiBuilderSchema } from "@/app/lib/db/ai-builder-schema";
import { ensureAssistantQualitySchema } from "@/app/lib/db/assistant-quality-schema";
import { getSql } from "@/app/lib/db/client";
import { loadAssistantQualityCertification } from "@/app/lib/ai-engine/assistant-quality/loadAssistantQualityCertification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

function nullableDelta(current: number | null, baseline: number | null): number | null {
  return current === null || baseline === null ? null : current - baseline;
}

export async function GET(request: Request) {
  try {
    const clerkUserId = await requireClerkUserId();
    const url = new URL(request.url);
    const baselineRunId = url.searchParams.get("baselineRunId")?.trim() ?? "";
    const currentRunId = url.searchParams.get("currentRunId")?.trim() ?? "";

    if (!baselineRunId || !currentRunId || baselineRunId === currentRunId) {
      return errorResponse(
        400,
        "invalid_assistant_quality_comparison",
        "Two different certification run IDs are required.",
      );
    }

    await ensureAiBuilderSchema();
    await ensureAssistantQualitySchema();

    const sql = getSql();
    const ownershipRows = (await sql`
      SELECT runs.id, runs.project_id
      FROM assistant_quality_runs AS runs
      INNER JOIN ai_builder_projects AS projects
        ON projects.id = runs.project_id
      WHERE runs.id IN (${baselineRunId}, ${currentRunId})
        AND projects.clerk_user_id = ${clerkUserId}
        AND projects.archived_at IS NULL
    `) as Array<{ id: string; project_id: string }>;

    if (ownershipRows.length !== 2) {
      return errorResponse(404, "assistant_quality_run_not_found", "One or both certification runs could not be found.");
    }

    const projectIds = new Set(ownershipRows.map((row) => row.project_id));
    if (projectIds.size !== 1) {
      return errorResponse(
        409,
        "assistant_quality_project_mismatch",
        "Certification runs from different AI Builder projects cannot be compared.",
      );
    }

    const [baseline, current] = await Promise.all([
      loadAssistantQualityCertification(baselineRunId),
      loadAssistantQualityCertification(currentRunId),
    ]);

    if (!baseline || !current) {
      return errorResponse(404, "assistant_quality_run_not_found", "One or both certification runs could not be found.");
    }

    const baselineByDefinition = new Map(
      baseline.run.questions.map((question) => [question.definitionId ?? question.id, question]),
    );
    const baselineEvaluations = new Map(
      baseline.evaluation.evaluations.map((evaluation) => [evaluation.questionId, evaluation]),
    );
    const currentEvaluations = new Map(
      current.evaluation.evaluations.map((evaluation) => [evaluation.questionId, evaluation]),
    );

    const questions = current.run.questions.map((question) => {
      const comparisonKey = question.definitionId ?? question.id;
      const baselineQuestion = baselineByDefinition.get(comparisonKey) ?? null;
      const baselineEvaluation = baselineQuestion
        ? baselineEvaluations.get(baselineQuestion.id) ?? null
        : null;
      const currentEvaluation = currentEvaluations.get(question.id) ?? null;

      return {
        comparisonKey,
        definitionId: question.definitionId,
        title: question.title,
        category: question.category,
        baseline: baselineEvaluation
          ? {
              questionId: baselineEvaluation.questionId,
              status: baselineEvaluation.status,
              overallScore: baselineEvaluation.overallScore,
              passed: baselineEvaluation.passed,
            }
          : null,
        current: currentEvaluation
          ? {
              questionId: currentEvaluation.questionId,
              status: currentEvaluation.status,
              overallScore: currentEvaluation.overallScore,
              passed: currentEvaluation.passed,
            }
          : null,
        scoreDelta: nullableDelta(
          currentEvaluation?.overallScore ?? null,
          baselineEvaluation?.overallScore ?? null,
        ),
        passStateChanged:
          baselineEvaluation?.passed !== null &&
          baselineEvaluation?.passed !== undefined &&
          currentEvaluation?.passed !== null &&
          currentEvaluation?.passed !== undefined
            ? baselineEvaluation.passed !== currentEvaluation.passed
            : false,
      };
    });

    return NextResponse.json({
      ok: true,
      projectId: current.run.projectId,
      baseline: {
        runId: baseline.run.id,
        createdAt: baseline.run.createdAt,
        completedAt: baseline.run.completedAt,
        overallScore: baseline.evaluation.overallScore,
        passed: baseline.evaluation.passed,
        completedQuestionCount: baseline.evaluation.completedQuestionCount,
        failedQuestionCount: baseline.evaluation.failedQuestionCount,
        evaluationFailureCount: baseline.evaluation.evaluationFailureCount,
      },
      current: {
        runId: current.run.id,
        createdAt: current.run.createdAt,
        completedAt: current.run.completedAt,
        overallScore: current.evaluation.overallScore,
        passed: current.evaluation.passed,
        completedQuestionCount: current.evaluation.completedQuestionCount,
        failedQuestionCount: current.evaluation.failedQuestionCount,
        evaluationFailureCount: current.evaluation.evaluationFailureCount,
      },
      deltas: {
        overallScore: nullableDelta(current.evaluation.overallScore, baseline.evaluation.overallScore),
        completedQuestionCount:
          current.evaluation.completedQuestionCount - baseline.evaluation.completedQuestionCount,
        failedQuestionCount:
          current.evaluation.failedQuestionCount - baseline.evaluation.failedQuestionCount,
        evaluationFailureCount:
          current.evaluation.evaluationFailureCount - baseline.evaluation.evaluationFailureCount,
        passStateChanged:
          baseline.evaluation.passed !== null && current.evaluation.passed !== null
            ? baseline.evaluation.passed !== current.evaluation.passed
            : false,
      },
      questions,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "assistant_quality_comparison_failed";

    if (code === "authentication_required") {
      return errorResponse(401, code, "Sign in to compare Assistant Quality certification runs.");
    }

    if (code === "assistant_quality_certification_integrity_error") {
      return errorResponse(409, code, "One of the certification records is incomplete or inconsistent.");
    }

    console.error("assistant_quality_comparison_failed", error);
    return errorResponse(500, "assistant_quality_comparison_failed", "Certification runs could not be compared.");
  }
}
