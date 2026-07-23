import { NextResponse } from "next/server";
import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
import {
  archiveAiBuilderProject,
  getAiBuilderProject,
  renameAiBuilderProject,
  restoreAiBuilderProject,
  AiBuilderRevisionConflictError,
} from "@/app/lib/db/ai-builder-repository";
import { getSql } from "@/app/lib/db/client";
import { isAuthenticationRequired, requireClerkUserId } from "@/app/lib/auth/clerk";
import { commandsFromLegacyReviewSession, UnsupportedLegacyReviewMutationError } from "@/app/lib/ai-engine/business-memory/legacy-review-command-adapter";
import { executePersistedReviewCommandsAtomically, PersistedReviewCommandError } from "@/app/lib/ai-engine/business-memory/services/execute-persisted-review-command";

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
  restore?: boolean;
  expectedRevision?: number;
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
          sequence,
          created_at
        FROM ai_builder_chat_messages
        WHERE thread_id = ${project.initialThread.id}
        ORDER BY sequence
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
      stateRevision: project.stateRevision,
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
    const existing = await getAiBuilderProject(normalizedProjectId);
    if (!existing) return errorResponse(404, "project_not_found", "This AI Builder project could not be found.");

    const commands = commandsFromLegacyReviewSession(existing.session, session, {
      clerkUserId, displayName: null, email: null,
    });
    const results = await executePersistedReviewCommandsAtomically({ projectId: normalizedProjectId, clerkUserId, requests: commands });
    const governanceRevision = results.at(-1)?.governanceRevision ?? Number(existing.session.governanceRevision ?? 0);
    return NextResponse.json({ ok: true, projectId: normalizedProjectId, updatedAt: session.updatedAt, governanceRevision });
  } catch (error) {
    if (isAuthenticationRequired(error)) return errorResponse(401, "authentication_required", "Sign in to use AI Builder.");
    if (error instanceof UnsupportedLegacyReviewMutationError) return errorResponse(400, "unsupported_legacy_review_mutation", "The submitted review snapshot contains an unsupported mutation.");
    if (error instanceof PersistedReviewCommandError) return errorResponse(error.status, error.code, error.message);
    const message = error instanceof Error ? error.message : "unknown_error";
    console.error("AI_BUILDER_PROJECT_SAVE_FAILED", {
      projectId: normalizedProjectId,
      message,
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

  if (!normalizedProjectId) {
    return errorResponse(400, "invalid_project_name", "A project name is required.");
  }
  if (!Number.isSafeInteger(body.expectedRevision) || Number(body.expectedRevision) < 0) return errorResponse(400, "invalid_expected_revision", "A valid expected revision is required.");

  if (body.restore === true) {
    try {
      const restored = await restoreAiBuilderProject(normalizedProjectId, Number(body.expectedRevision));
      if (!restored) return errorResponse(404, "project_not_found", "This archived AI Builder project could not be found.");
      return NextResponse.json({ ok: true, projectId: normalizedProjectId, restored: true, stateRevision: restored.stateRevision });
    } catch (error) {
      if (isAuthenticationRequired(error)) return errorResponse(401, "authentication_required", "Sign in to use AI Builder.");
      if (error instanceof AiBuilderRevisionConflictError) return NextResponse.json({ok:false,error:{code:"ai_builder_revision_conflict",message:"This project changed. Refresh and try again."},currentRevision:error.currentRevision},{status:409});
      return errorResponse(500, "project_restore_failed", "The project could not be restored.");
    }
  }

  const businessName = String(body.businessName ?? "").trim().slice(0, 160);
  if (!businessName) return errorResponse(400, "invalid_project_name", "A project name is required.");

  try {
    const renamed = await renameAiBuilderProject(normalizedProjectId, businessName, Number(body.expectedRevision));
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
      stateRevision: renamed.stateRevision,
    });
  } catch (error) {
    if (isAuthenticationRequired(error)) return errorResponse(401, "authentication_required", "Sign in to use AI Builder.");
    if (error instanceof AiBuilderRevisionConflictError) return NextResponse.json({ok:false,error:{code:"ai_builder_revision_conflict",message:"This project changed. Refresh and try again."},currentRevision:error.currentRevision},{status:409});
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

export async function DELETE(request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  const normalizedProjectId = normalizeProjectId(projectId);

  if (!normalizedProjectId) {
    return errorResponse(400, "missing_project_id", "A project ID is required.");
  }
  const expectedRevisionValue = new URL(request.url).searchParams.get("expectedRevision");
  const expectedRevision = Number(expectedRevisionValue);
  if (expectedRevisionValue === null || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) return errorResponse(400, "invalid_expected_revision", "A valid expected revision is required.");

  try {
    const archived = await archiveAiBuilderProject(normalizedProjectId, expectedRevision);
    if (!archived) {
      return errorResponse(
        404,
        "project_not_found",
        "This AI Builder project could not be found.",
      );
    }
    return NextResponse.json({ ok: true, archived: true, stateRevision: archived.stateRevision });
  } catch (error) {
    if (isAuthenticationRequired(error)) return errorResponse(401, "authentication_required", "Sign in to use AI Builder.");
    if (error instanceof AiBuilderRevisionConflictError) return NextResponse.json({ok:false,error:{code:"ai_builder_revision_conflict",message:"This project changed. Refresh and try again."},currentRevision:error.currentRevision},{status:409});
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
