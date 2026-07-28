import { NextResponse } from "next/server";
import { requireClerkUserId } from "@/app/lib/auth/clerk";
import { ensureAiBuilderSchema } from "@/app/lib/db/ai-builder-schema";
import { ensureAssistantQualitySchema } from "@/app/lib/db/assistant-quality-schema";
import { getSql } from "@/app/lib/db/client";
import { loadAssistantQualityCertification } from "@/app/lib/ai-engine/assistant-quality/loadAssistantQualityCertification";
import { evaluateAssistantQualityReleaseGate } from "@/app/lib/ai-engine/assistant-quality/evaluateAssistantQualityReleaseGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

function parseOptionalNumber(value: string | null): number | undefined | null {
  if (value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalBoolean(value: string | null): boolean | undefined | null {
  if (value === null) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

export async function GET(request: Request) {
  try {
    const clerkUserId = await requireClerkUserId();
    const url = new URL(request.url);
    const runId = url.searchParams.get("runId")?.trim() ?? "";
    const previousRunId = url.searchParams.get("previousRunId")?.trim() || null;
    const requiredScore = parseOptionalNumber(url.searchParams.get("requiredScore"));
    const maximumScoreRegression = parseOptionalNumber(url.searchParams.get("maximumScoreRegression"));
    const allowExecutionFailures = parseOptionalBoolean(url.searchParams.get("allowExecutionFailures"));
    const allowEvaluationFailures = parseOptionalBoolean(url.searchParams.get("allowEvaluationFailures"));

    if (!runId) {
      return errorResponse(400, "invalid_assistant_quality_run_id", "A valid certification run ID is required.");
    }

    if (previousRunId === runId) {
      return errorResponse(400, "invalid_assistant_quality_previous_run_id", "The previous run must be different from the current run.");
    }

    if (
      requiredScore === null ||
      maximumScoreRegression === null ||
      allowExecutionFailures === null ||
      allowEvaluationFailures === null
    ) {
      return errorResponse(400, "invalid_assistant_quality_release_policy", "One or more release policy values are invalid.");
    }

    await ensureAiBuilderSchema();
    await ensureAssistantQualitySchema();

    const sql = getSql();
    const requestedRunIds = previousRunId ? [runId, previousRunId] : [runId];
    const ownershipRows = (await sql`
      SELECT runs.id, runs.project_id
      FROM assistant_quality_runs AS runs
      INNER JOIN ai_builder_projects AS projects
        ON projects.id = runs.project_id
      WHERE runs.id = ANY(${requestedRunIds})
        AND projects.clerk_user_id = ${clerkUserId}
        AND projects.archived_at IS NULL
    `) as Array<{ id: string; project_id: string }>;

    if (ownershipRows.length !== requestedRunIds.length) {
      return errorResponse(404, "assistant_quality_run_not_found", "One or more certification runs could not be found.");
    }

    const projectIds = new Set(ownershipRows.map((row) => row.project_id));
    if (projectIds.size !== 1) {
      return errorResponse(409, "assistant_quality_project_mismatch", "Certification runs from different projects cannot share a release gate decision.");
    }

    const current = await loadAssistantQualityCertification(runId);
    if (!current) {
      return errorResponse(404, "assistant_quality_run_not_found", "The certification run could not be found.");
    }

    let previousOverallScore: number | null = null;
    let resolvedPreviousRunId: string | null = previousRunId;

    if (previousRunId) {
      const previous = await loadAssistantQualityCertification(previousRunId);
      if (!previous) {
        return errorResponse(404, "assistant_quality_run_not_found", "The previous certification run could not be found.");
      }
      previousOverallScore = previous.evaluation.overallScore;
    } else {
      const previousRows = (await sql`
        SELECT id, overall_score
        FROM assistant_quality_runs
        WHERE project_id = ${current.run.projectId}
          AND id <> ${runId}
          AND created_at < ${current.run.createdAt}
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `) as Array<{ id: string; overall_score: number | null }>;

      if (previousRows[0]) {
        resolvedPreviousRunId = previousRows[0].id;
        previousOverallScore = previousRows[0].overall_score === null
          ? null
          : Number(previousRows[0].overall_score);
      }
    }

    const decision = evaluateAssistantQualityReleaseGate({
      evaluation: current.evaluation,
      previousOverallScore,
      policy: {
        ...(requiredScore !== undefined ? { requiredScore } : {}),
        ...(maximumScoreRegression !== undefined ? { maximumScoreRegression } : {}),
        ...(allowExecutionFailures !== undefined ? { allowExecutionFailures } : {}),
        ...(allowEvaluationFailures !== undefined ? { allowEvaluationFailures } : {}),
      },
    });

    return NextResponse.json({
      ok: true,
      projectId: current.run.projectId,
      runId,
      previousRunId: resolvedPreviousRunId,
      decision,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "assistant_quality_release_gate_failed";

    if (code === "authentication_required") {
      return errorResponse(401, code, "Sign in to evaluate Assistant Quality release readiness.");
    }

    if (code === "assistant_quality_certification_integrity_error") {
      return errorResponse(409, code, "The certification record is incomplete or inconsistent.");
    }

    if (
      code === "invalid_assistant_quality_release_required_score" ||
      code === "invalid_assistant_quality_release_regression_limit"
    ) {
      return errorResponse(400, code, "The release gate policy is outside its supported range.");
    }

    console.error("assistant_quality_release_gate_failed", error);
    return errorResponse(500, "assistant_quality_release_gate_failed", "Release readiness could not be evaluated.");
  }
}
