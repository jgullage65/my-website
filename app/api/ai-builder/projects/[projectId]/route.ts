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
import { LegacyReviewSessionRequestParseError, parseLegacyReviewSessionRequest } from "@/app/lib/ai-engine/business-memory/legacy-review-session-request-parser";

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
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseExpectedRevision(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) return null;
  return value;
}

function withCombinedReviewCounts(session: AiBuilderSession): AiBuilderSession {
  const reviewItems = [...session.contextEntries, ...session.faqEntries];
  const approved = reviewItems.filter(
    (item) => item.status === "approved" || item.status === "corrected",
  ).length;

  return {
    ...session,
    contextCounts: {
      ...session.contextCounts,
      total: reviewItems.length,
      approved,
      proposed: reviewItems.filter((item) => item.status === "proposed").length,
      archived: reviewItems.filter((item) => item.status === "archived").length,
    },
  };
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

    const sql = getSql();
    let chatThread: {
      id: string;
      messages: StoredChatMessage[];
    } | null = null;

    if (project.initialThread) {
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

    const [crawlDiagnostics,generationDiagnostics]=await Promise.all([
      sql`SELECT status,attempt_number,started_at,completed_at,duration_ms,pages_discovered,pages_processed,pages_skipped,pages_failed,warnings,errors,restrictions,failure_stage FROM ai_builder_crawl_telemetry WHERE project_id=${normalizedProjectId} ORDER BY started_at DESC LIMIT 10`.catch(()=>[] as DatabaseRow[]),
      sql`SELECT status,attempt_number,started_at,completed_at,duration_ms,model,knowledge_count,faq_count,retry_count,input_tokens,output_tokens,total_tokens,warnings,errors,failure_stage FROM ai_builder_generation_telemetry WHERE project_id=${normalizedProjectId} ORDER BY started_at DESC LIMIT 10`.catch(()=>[] as DatabaseRow[]),
    ]) as [DatabaseRow[],DatabaseRow[]];

    return NextResponse.json({
      ok: true,
      projectId: project.session.id,
      stateRevision: project.stateRevision,
      session: withCombinedReviewCounts(project.session),
      builder: {
        businessName: project.businessName,
        industry: project.industry,
        website: project.website ?? "",
        tone: project.session.assistantConfiguration.tone,
      },
      websiteKnowledge: project.websiteKnowledge,
      chatThread,
      diagnostics: { crawls:crawlDiagnostics, generations:generationDiagnostics },
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

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return errorResponse(
      400,
      "invalid_json",
      "The request body must be valid JSON.",
    );
  }

  try {
    const clerkUserId = await requireClerkUserId();
    let session: AiBuilderSession;
    try {
      ({ session } = parseLegacyReviewSessionRequest(payload, normalizedProjectId));
    } catch (error) {
      if (error instanceof LegacyReviewSessionRequestParseError) return errorResponse(400, error.code, error.message);
      throw error;
    }

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

  if (!normalizedProjectId) {
    return errorResponse(400, "missing_project_id", "A project ID is required.");
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "The request body must be valid JSON.");
  }

  if (!isRecord(payload)) {
    return errorResponse(400, "invalid_request_body", "The request body must be a JSON object.");
  }

  const expectedRevision = parseExpectedRevision(payload.expectedRevision);
  if (expectedRevision == null) {
    return errorResponse(400, "invalid_expected_revision", "A valid expected revision is required.");
  }

  const restoreRequested = payload.restore === true;
  const renameRequested = typeof payload.businessName === "string";
  if (restoreRequested === renameRequested) {
    return errorResponse(
      400,
      "invalid_project_update",
      "Specify either a project name or restore action, but not both.",
    );
  }

  if (restoreRequested) {
    try {
      const restored = await restoreAiBuilderProject(normalizedProjectId, expectedRevision);
      if (!restored) return errorResponse(404, "project_not_found", "This archived AI Builder project could not be found.");
      return NextResponse.json({ ok: true, projectId: normalizedProjectId, restored: true, stateRevision: restored.stateRevision });
    } catch (error) {
      if (isAuthenticationRequired(error)) return errorResponse(401, "authentication_required", "Sign in to use AI Builder.");
      if (error instanceof AiBuilderRevisionConflictError) return NextResponse.json({ok:false,error:{code:"ai_builder_revision_conflict",message:"This project changed. Refresh and try again."},currentRevision:error.currentRevision},{status:409});
      return errorResponse(500, "project_restore_failed", "The project could not be restored.");
    }
  }

  const businessName = String(payload.businessName).trim();
  if (!businessName) return errorResponse(400, "invalid_project_name", "A project name is required.");
  if (businessName.length > 160) {
    return errorResponse(400, "project_name_too_long", "Project names must be 160 characters or fewer.");
  }

  try {
    const renamed = await renameAiBuilderProject(normalizedProjectId, businessName, expectedRevision);
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
  if (expectedRevisionValue === null || !/^\d+$/.test(expectedRevisionValue)) {
    return errorResponse(400, "invalid_expected_revision", "A valid expected revision is required.");
  }
  const expectedRevision = Number(expectedRevisionValue);
  if (!Number.isSafeInteger(expectedRevision)) {
    return errorResponse(400, "invalid_expected_revision", "A valid expected revision is required.");
  }

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
      "The AI Builder project could not be archived.",
    );
  }
}
