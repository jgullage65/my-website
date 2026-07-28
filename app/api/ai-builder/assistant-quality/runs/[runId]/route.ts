import { NextResponse } from "next/server";
import { requireClerkUserId } from "@/app/lib/auth/clerk";
import { ensureAiBuilderSchema } from "@/app/lib/db/ai-builder-schema";
import { ensureAssistantQualitySchema } from "@/app/lib/db/assistant-quality-schema";
import { getSql } from "@/app/lib/db/client";
import { loadAssistantQualityCertification } from "@/app/lib/ai-engine/assistant-quality/loadAssistantQualityCertification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ runId: string }>;
};

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const clerkUserId = await requireClerkUserId();
    const { runId } = await params;
    const normalizedRunId = runId?.trim();

    if (!normalizedRunId) {
      return errorResponse(400, "invalid_assistant_quality_run_id", "A valid certification run ID is required.");
    }

    await ensureAiBuilderSchema();
    await ensureAssistantQualitySchema();

    const sql = getSql();
    const ownershipRows = (await sql`
      SELECT runs.id
      FROM assistant_quality_runs AS runs
      INNER JOIN ai_builder_projects AS projects
        ON projects.id = runs.project_id
      WHERE runs.id = ${normalizedRunId}
        AND projects.clerk_user_id = ${clerkUserId}
        AND projects.archived_at IS NULL
      LIMIT 1
    `) as Array<{ id: string }>;

    if (!ownershipRows[0]) {
      return errorResponse(404, "assistant_quality_run_not_found", "This certification run could not be found.");
    }

    const certification = await loadAssistantQualityCertification(normalizedRunId);

    if (!certification) {
      return errorResponse(404, "assistant_quality_run_not_found", "This certification run could not be found.");
    }

    return NextResponse.json({ ok: true, certification });
  } catch (error) {
    const code = error instanceof Error ? error.message : "assistant_quality_run_load_failed";

    if (code === "authentication_required") {
      return errorResponse(401, code, "Sign in to view Assistant Quality certification results.");
    }

    if (code === "assistant_quality_certification_integrity_error") {
      return errorResponse(409, code, "This certification record is incomplete or inconsistent.");
    }

    console.error("assistant_quality_run_detail_failed", error);
    return errorResponse(500, "assistant_quality_run_load_failed", "The certification run could not be loaded.");
  }
}
