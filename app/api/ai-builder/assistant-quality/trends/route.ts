import { NextResponse } from "next/server";
import { requireClerkUserId } from "@/app/lib/auth/clerk";
import { ensureAiBuilderSchema } from "@/app/lib/db/ai-builder-schema";
import { ensureAssistantQualitySchema } from "@/app/lib/db/assistant-quality-schema";
import { getSql } from "@/app/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

type TrendRow = {
  id: string;
  status: string;
  overall_score: number | null;
  passed: boolean | null;
  passing_score: number;
  completed_question_count: number;
  failed_question_count: number;
  evaluation_failure_count: number;
  created_at: string | Date;
  completed_at: string | Date | null;
  evaluated_at: string | Date | null;
};

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

function iso(value: string | Date): string {
  return new Date(value).toISOString();
}

function nullableIso(value: string | Date | null): string | null {
  return value ? iso(value) : null;
}

function parseLimit(value: string | null): number | null {
  if (value === null) return DEFAULT_LIMIT;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 2 && parsed <= MAX_LIMIT ? parsed : null;
}

export async function GET(request: Request) {
  try {
    const clerkUserId = await requireClerkUserId();
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId")?.trim() ?? "";
    const limit = parseLimit(url.searchParams.get("limit"));

    if (!projectId) {
      return errorResponse(400, "invalid_assistant_quality_project_id", "A valid AI Builder project ID is required.");
    }

    if (limit === null) {
      return errorResponse(400, "invalid_assistant_quality_trend_limit", "Trend history must request between 2 and 100 runs.");
    }

    await ensureAiBuilderSchema();
    await ensureAssistantQualitySchema();

    const sql = getSql();
    const projectRows = (await sql`
      SELECT id
      FROM ai_builder_projects
      WHERE id = ${projectId}
        AND clerk_user_id = ${clerkUserId}
        AND archived_at IS NULL
      LIMIT 1
    `) as Array<{ id: string }>;

    if (!projectRows[0]) {
      return errorResponse(404, "assistant_quality_project_not_found", "This AI Builder project could not be found.");
    }

    const rows = (await sql`
      SELECT
        id,
        status,
        overall_score,
        passed,
        passing_score,
        completed_question_count,
        failed_question_count,
        evaluation_failure_count,
        created_at,
        completed_at,
        evaluated_at
      FROM assistant_quality_runs
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit}
    `) as TrendRow[];

    const chronological = [...rows].reverse();
    const points = chronological.map((row, index) => {
      const previous = index > 0 ? chronological[index - 1] : null;
      const score = row.overall_score === null ? null : Number(row.overall_score);
      const previousScore = previous?.overall_score === null || previous?.overall_score === undefined
        ? null
        : Number(previous.overall_score);
      const scoreDelta = score === null || previousScore === null ? null : score - previousScore;
      const passed = row.passed === null ? null : Boolean(row.passed);
      const previousPassed = previous?.passed === null || previous?.passed === undefined
        ? null
        : Boolean(previous.passed);

      return {
        runId: row.id,
        status: row.status,
        overallScore: score,
        passingScore: Number(row.passing_score),
        passed,
        completedQuestionCount: Number(row.completed_question_count),
        failedQuestionCount: Number(row.failed_question_count),
        evaluationFailureCount: Number(row.evaluation_failure_count),
        createdAt: iso(row.created_at),
        completedAt: nullableIso(row.completed_at),
        evaluatedAt: nullableIso(row.evaluated_at),
        scoreDelta,
        passStateChanged:
          previousPassed !== null && passed !== null ? previousPassed !== passed : false,
        regression:
          scoreDelta !== null && scoreDelta < 0
            ? {
                detected: true,
                scoreDrop: Math.abs(scoreDelta),
                crossedBelowPassingThreshold:
                  previousScore !== null &&
                  previousScore >= Number(row.passing_score) &&
                  score < Number(row.passing_score),
              }
            : {
                detected: false,
                scoreDrop: 0,
                crossedBelowPassingThreshold: false,
              },
      };
    });

    const scoredPoints = points.filter((point) => point.overallScore !== null);
    const latest = points.at(-1) ?? null;
    const previous = points.length > 1 ? points.at(-2) ?? null : null;
    const averageScore = scoredPoints.length
      ? scoredPoints.reduce((sum, point) => sum + (point.overallScore ?? 0), 0) / scoredPoints.length
      : null;
    const bestScore = scoredPoints.length
      ? Math.max(...scoredPoints.map((point) => point.overallScore as number))
      : null;
    const worstScore = scoredPoints.length
      ? Math.min(...scoredPoints.map((point) => point.overallScore as number))
      : null;
    const regressionCount = points.filter((point) => point.regression.detected).length;

    return NextResponse.json({
      ok: true,
      projectId,
      summary: {
        runCount: points.length,
        scoredRunCount: scoredPoints.length,
        averageScore,
        bestScore,
        worstScore,
        regressionCount,
        latestRunId: latest?.runId ?? null,
        latestScore: latest?.overallScore ?? null,
        latestPassed: latest?.passed ?? null,
        latestScoreDelta: latest?.scoreDelta ?? null,
        previousRunId: previous?.runId ?? null,
      },
      points,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "assistant_quality_trends_failed";

    if (code === "authentication_required") {
      return errorResponse(401, code, "Sign in to view Assistant Quality certification trends.");
    }

    console.error("assistant_quality_trends_failed", error);
    return errorResponse(500, "assistant_quality_trends_failed", "Certification trends could not be loaded.");
  }
}
