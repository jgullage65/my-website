import { NextResponse } from "next/server";
import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
import { getAiBuilderProject } from "@/app/lib/db/ai-builder-repository";
import { ensureAiBuilderSchema } from "@/app/lib/db/ai-builder-schema";
import { getSql } from "@/app/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

type UpdateProjectBody = {
  session?: AiBuilderSession;
};

function normalizeProjectId(value: unknown): string {
  return String(value ?? "").trim();
}

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    {
      ok: false,
      error: { code, message },
    },
    { status },
  );
}

export async function GET(_request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  const normalizedProjectId = normalizeProjectId(projectId);

  if (!normalizedProjectId) {
    return errorResponse(400, "missing_project_id", "A project ID is required.");
  }

  try {
    const project = await getAiBuilderProject(normalizedProjectId);

    if (!project) {
      return errorResponse(
        404,
        "project_not_found",
        "This AI Builder project could not be found.",
      );
    }

    return NextResponse.json({
      ok: true,
      projectId: project.session.id,
      session: project.session,
      builder: {
        businessName: project.businessName,
        industry: project.industry,
        website: project.website ?? "",
        tone: project.session.assistantConfiguration.tone,
      },
    });
  } catch (error) {
    console.error("AI_BUILDER_PROJECT_LOAD_FAILED", {
      projectId: normalizedProjectId,
      message: error instanceof Error ? error.message : "unknown_error",
    });

    return errorResponse(
      500,
      "project_load_failed",
      "The AI Builder project could not be loaded.",
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  const normalizedProjectId = normalizeProjectId(projectId);

  if (!normalizedProjectId) {
    return errorResponse(400, "missing_project_id", "A project ID is required.");
  }

  let body: UpdateProjectBody;

  try {
    body = (await request.json()) as UpdateProjectBody;
  } catch {
    return errorResponse(400, "invalid_json", "The request body must be valid JSON.");
  }

  const session = body.session;

  if (!session || session.id !== normalizedProjectId) {
    return errorResponse(
      400,
      "invalid_session",
      "The saved session must match the requested project.",
    );
  }

  if (!Array.isArray(session.contextEntries) || !Array.isArray(session.faqEntries)) {
    return errorResponse(
      400,
      "invalid_session",
      "The AI Builder session is incomplete.",
    );
  }

  try {
    await ensureAiBuilderSchema();
    const sql = getSql();

    const existing = (await sql`
      SELECT id
      FROM ai_builder_projects
      WHERE id = ${normalizedProjectId}
      LIMIT 1
    `) as Array<Record<string, unknown>>;

    if (!existing[0]) {
      return errorResponse(
        404,
        "project_not_found",
        "This AI Builder project could not be found.",
      );
    }

    await sql`
      UPDATE ai_builder_projects
      SET
        status = ${session.status},
        assistant_configuration = ${JSON.stringify(session.assistantConfiguration)}::jsonb,
        context_counts = ${JSON.stringify(session.contextCounts)}::jsonb,
        updated_at = ${session.updatedAt}::timestamptz,
        expires_at = ${session.expiresAt}::timestamptz
      WHERE id = ${normalizedProjectId}
    `;

    await Promise.all(
      session.contextEntries.map((entry) => sql`
        UPDATE ai_builder_context_entries
        SET
          category = ${entry.category},
          title = ${entry.title},
          content = ${entry.content},
          confidence = ${entry.confidence},
          confidence_score = ${entry.confidenceScore},
          status = ${entry.status},
          source = ${JSON.stringify(entry.source)}::jsonb,
          metadata = ${JSON.stringify(entry.metadata)}::jsonb,
          updated_at = ${entry.updatedAt}::timestamptz
        WHERE id = ${entry.id}
          AND project_id = ${normalizedProjectId}
      `),
    );

    await Promise.all(
      session.faqEntries.map((entry) => sql`
        UPDATE ai_builder_faq_entries
        SET
          question = ${entry.question},
          answer = ${entry.answer},
          confidence = ${entry.confidence},
          confidence_score = ${entry.confidenceScore},
          source_entry_ids = ${JSON.stringify(entry.sourceEntryIds)}::jsonb,
          status = ${entry.status},
          updated_at = ${entry.updatedAt}::timestamptz
        WHERE id = ${entry.id}
          AND project_id = ${normalizedProjectId}
      `),
    );

    return NextResponse.json({
      ok: true,
      projectId: normalizedProjectId,
      updatedAt: session.updatedAt,
    });
  } catch (error) {
    console.error("AI_BUILDER_PROJECT_SAVE_FAILED", {
      projectId: normalizedProjectId,
      message: error instanceof Error ? error.message : "unknown_error",
    });

    return errorResponse(
      500,
      "project_save_failed",
      "The AI Builder project changes could not be saved.",
    );
  }
}
