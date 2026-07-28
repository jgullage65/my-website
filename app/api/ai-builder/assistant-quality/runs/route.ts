import { NextResponse } from "next/server";
import { requireClerkUserId } from "@/app/lib/auth/clerk";
import { ensureAiBuilderSchema } from "@/app/lib/db/ai-builder-schema";
import { ensureAssistantQualitySchema } from "@/app/lib/db/assistant-quality-schema";
import { getSql } from "@/app/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

type RunHistoryRow = {
  id: string;
  project_id: string;
  status: string;
  assistant_provider: string;
  assistant_model: string;
  evaluator_provider: string | null;
  evaluator_model: string | null;
  passing_score: number;
  overall_score: number | null;
  passed: boolean | null;
  completed_question_count: number;
  failed_question_count: number;
  evaluation_failure_count: number;
  created_at: string | Date;
  started_at: string | Date | null;
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
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_LIMIT ? parsed : null;
}

function parseOffset(value: string | null): number | null {
  if (value === null) return 0;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export async function GET(request: Request) {
  try {
    const clerkUserId = await requireClerkUserId();
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId")?.trim() ?? "";
    const limit = parseLimit(url.searchParams.get("limit"));
    const offset = parseOffset(url.searchParams.get("offset"));

    if (!projectId) {
      return errorResponse(400, "invalid_assistant_quality_project_id", "A valid AI Builder project ID is required.");
    }

    if (limit === null || offset === null) {
      return errorResponse(400, "invalid_assistant_quality_pagination", "Pagination values are invalid.");
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
        project_id,
        status,
        assistant_provider,
        assistant_model,
        evaluator_provider,
        evaluator_model,
        passing_score,
        overall_score,
        passed,
        completed_question_count,
        failed_question_count,
        evaluation_failure_count,
        created_at,
        started_at,
        completed_at,
        evaluated_at
      FROM assistant_quality_runs
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit + 1}
      OFFSET ${offset}
    `) as RunHistoryRow[];

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    const runs = pageRows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      status: row.status,
      assistant: {
        provider: row.assistant_provider,
        model: row.assistant_model,
      },
      evaluator: row.evaluator_provider && row.evaluator_model
        ? { provider: row.evaluator_provider, model: row.evaluator_model }
        : null,
      passingScore: Number(row.passing_score),
      overallScore: row.overall_score === null ? null : Number(row.overall_score),
      passed: row.passed === null ? null : Boolean(row.passed),
      completedQuestionCount: Number(row.completed_question_count),
      failedQuestionCount: Number(row.failed_question_count),
      evaluationFailureCount: Number(row.evaluation_failure_count),
      createdAt: iso(row.created_at),
      startedAt: nullableIso(row.started_at),
      completedAt: nullableIso(row.completed_at),
      evaluatedAt: nullableIso(row.evaluated_at),
    }));

    return NextResponse.json({
      ok: true,
      projectId,
      runs,
      pagination: {
        limit,
        offset,
        nextOffset: hasMore ? offset + limit : null,
        hasMore,
      },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "assistant_quality_run_history_failed";

    if (code === "authentication_required") {
      return errorResponse(401, code, "Sign in to view Assistant Quality certification history.");
    }

    console.error("assistant_quality_run_history_failed", error);
    return errorResponse(500, "assistant_quality_run_history_failed", "Certification history could not be loaded.");
  }
}
