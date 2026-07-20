import { NextResponse } from "next/server";
import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
import {
  archiveAiBuilderProject,
  getAiBuilderProject,
  renameAiBuilderProject,
} from "@/app/lib/db/ai-builder-repository";
import { ensureAiBuilderSchema } from "@/app/lib/db/ai-builder-schema";
import { getSql } from "@/app/lib/db/client";
import { isAuthenticationRequired, requireClerkUserId } from "@/app/lib/auth/clerk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

type UpdateProjectBody = {
  session?: AiBuilderSession;
  businessName?: string;
};

type StoredChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: string[];
  diagnostics?: {
    retrievedFacts: number;
    retrievedFaq: number;
    retrievalMs: number;
    runtimeSource?: "server_legacy_projection";
  };
  createdAt: string;
};

type DatabaseRow = Record<string, unknown>;

function normalizeProjectId(value: unknown): string {
  return String(value ?? "").trim();
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
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

    let chatThread: {
      id: string;
      messages: StoredChatMessage[];
    } | null = null;

    if (project.initialThread) {
      const sql = getSql();

      const messageRows = (await sql`
        SELECT
          id,
          role,
          content,
          metadata,
          created_at
        FROM ai_builder_chat_messages
        WHERE thread_id = ${project.initialThread.id}
        ORDER BY created_at, id
      `) as DatabaseRow[];

      chatThread = {
        id: project.initialThread.id,
        messages: messageRows.map((row) => {
          const metadata =
            row.metadata && typeof row.metadata === "object"
              ? (row.metadata as Record<string, unknown>)
              : {};

          const citations = Array.isArray(metadata.citations)
            ? metadata.citations.filter(
                (citation): citation is string => typeof citation === "string",
              )
            : undefined;

          const rawDiagnostics =
            metadata.diagnostics && typeof metadata.diagnostics === "object"
              ? (metadata.diagnostics as Record<string, unknown>)
              : null;

          const diagnostics = rawDiagnostics
            ? {
                retrievedFacts: Number(rawDiagnostics.retrievedFacts ?? 0),
                retrievedFaq: Number(rawDiagnostics.retrievedFaq ?? 0),
                retrievalMs: Number(rawDiagnostics.retrievalMs ?? 0),
                runtimeSource:
                  rawDiagnostics.runtimeSource === "server_legacy_projection"
                    ? ("server_legacy_projection" as const)
                    : undefined,
              }
            : undefined;

          return {
            id: String(row.id),
            role:
              row.role === "user" ? ("user" as const) : ("assistant" as const),
            content: String(row.content),
            citations,
            diagnostics,
            createdAt: toIsoString(row.created_at),
          };
        }),
      };
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
      websiteKnowledge: project.websiteKnowledge,
      chatThread,
    });
  } catch (error) {
    if (isAuthenticationRequired(error)) return errorResponse(401, "authentication_required", "Sign in to use AI Builder.");
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
    return errorResponse(
      400,
      "invalid_json",
      "The request body must be valid JSON.",
    );
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
    const clerkUserId = await requireClerkUserId();
    await ensureAiBuilderSchema();
    const sql = getSql();

    const existing = (await sql`
      SELECT id
      FROM ai_builder_projects
      WHERE id = ${normalizedProjectId}
        AND clerk_user_id = ${clerkUserId}
        AND archived_at IS NULL
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
        AND clerk_user_id = ${clerkUserId}
        AND archived_at IS NULL
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
    if (isAuthenticationRequired(error)) return errorResponse(401, "authentication_required", "Sign in to use AI Builder.");
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

export async function PATCH(request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  const normalizedProjectId = normalizeProjectId(projectId);
  let body: UpdateProjectBody;

  try {
    body = (await request.json()) as UpdateProjectBody;
  } catch {
    return errorResponse(400, "invalid_json", "The request body must be valid JSON.");
  }

  const businessName = String(body.businessName ?? "").trim().slice(0, 160);
  if (!normalizedProjectId || !businessName) {
    return errorResponse(400, "invalid_project_name", "A project name is required.");
  }

  try {
    const renamed = await renameAiBuilderProject(normalizedProjectId, businessName);
    if (!renamed) {
      return errorResponse(
        404,
        "project_not_found",
        "This AI Builder project could not be found.",
      );
    }
    return NextResponse.json({
      ok: true,
      projectId: normalizedProjectId,
      businessName,
    });
  } catch (error) {
    if (isAuthenticationRequired(error)) return errorResponse(401, "authentication_required", "Sign in to use AI Builder.");
    console.error("AI_BUILDER_PROJECT_RENAME_FAILED", {
      projectId: normalizedProjectId,
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return errorResponse(
      500,
      "project_rename_failed",
      "The project could not be renamed.",
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  const normalizedProjectId = normalizeProjectId(projectId);

  if (!normalizedProjectId) {
    return errorResponse(400, "missing_project_id", "A project ID is required.");
  }

  try {
    const archived = await archiveAiBuilderProject(normalizedProjectId);
    if (!archived) {
      return errorResponse(
        404,
        "project_not_found",
        "This AI Builder project could not be found.",
      );
    }
    return NextResponse.json({ ok: true, archived: true });
  } catch (error) {
    if (isAuthenticationRequired(error)) return errorResponse(401, "authentication_required", "Sign in to use AI Builder.");
    console.error("AI_BUILDER_PROJECT_ARCHIVE_FAILED", {
      projectId: normalizedProjectId,
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return errorResponse(
      500,
      "project_archive_failed",
      "The project could not be archived.",
    );
  }
}
