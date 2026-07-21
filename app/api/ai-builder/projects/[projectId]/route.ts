import { NextResponse } from "next/server";
import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
import type { AiBuilderProvenanceClassification } from "@/app/lib/ai-engine/provenance";
import {
  archiveAiBuilderProject,
  getAiBuilderProject,
  renameAiBuilderProject,
} from "@/app/lib/db/ai-builder-repository";
import { ensureAiBuilderSchema } from "@/app/lib/db/ai-builder-schema";
import { getSql } from "@/app/lib/db/client";
import { Pool } from "@neondatabase/serverless";
import { interpretLegacyReviewDeltas, verifyCanonicalGovernanceShadow, writeCanonicalGovernanceShadow } from "@/app/lib/db/canonical-provenance-shadow";
import { isAuthenticationRequired, requireClerkUserId } from "@/app/lib/auth/clerk";
import { classifyContextProvenance, classifyFaqProvenance, correctedProvenanceMetadata, isAiBuilderProvenanceClassification, normalizeContextProvenance, normalizeFaqProvenance } from "@/app/lib/ai-engine/provenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Keep the interactive connection pool alongside the application's database
// module lifetime rather than allocating one for every save request.
let transactionPool: Pool | null = null;

function getTransactionPool(): Pool {
  if (transactionPool) return transactionPool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");
  transactionPool = new Pool({ connectionString });
  return transactionPool;
}

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

    // Each retry obtains a fresh interactive connection so locked reads and
    // transition interpretation are never reused from a failed attempt.
    const pool = getTransactionPool();
    for (let attempt = 0; ; attempt += 1) {
        const client = await pool.connect();
        try {
          await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
          const tx = client;
          // This is the authoritative ownership and concurrency check.  The
          // earlier lookup only provides a fast 404; it is never trusted for a
          // governance write.
          const lockedProject = (await tx.query(`SELECT id, governance_revision FROM ai_builder_projects WHERE id = $1 AND clerk_user_id = $2 AND archived_at IS NULL FOR UPDATE`, [normalizedProjectId, clerkUserId])).rows as Array<{ id: string; governance_revision: number }>;
          if (!lockedProject[0]) throw new Error("governance_project_not_found_or_not_owned");
          const expectedRevision = Number(session.governanceRevision ?? 0);
          if (lockedProject[0].governance_revision !== expectedRevision) throw new Error("stale_governance_revision");

          const priorContextRows = (await tx.query(`SELECT id, status, content, source, metadata, updated_at FROM ai_builder_context_entries WHERE project_id = $1 FOR UPDATE`, [normalizedProjectId])).rows as Array<{ id: string; status: string; content: string; source: unknown; metadata: unknown; updated_at: unknown }>;
          const priorFaqRows = (await tx.query(`SELECT id, status, question, answer, source_entry_ids, metadata, updated_at FROM ai_builder_faq_entries WHERE project_id = $1 FOR UPDATE`, [normalizedProjectId])).rows as Array<{ id: string; status: string; question: string; answer: string; source_entry_ids: unknown; metadata: unknown; updated_at: unknown }>;
          const contextIds = new Set(priorContextRows.map((entry) => entry.id));
          const faqIds = new Set(priorFaqRows.map((entry) => entry.id));
          for (const entry of session.contextEntries) if (!contextIds.has(entry.id)) throw new Error(`governance_context_entry_not_found_or_not_owned:${entry.id}`);
          for (const entry of session.faqEntries) if (!faqIds.has(entry.id)) throw new Error(`governance_faq_entry_not_found_or_not_owned:${entry.id}`);
          const interpretedTransitions = interpretLegacyReviewDeltas(
            [...priorContextRows.map((entry) => ({ id: entry.id, status: entry.status, content: entry.content, updatedAt: toIsoString(entry.updated_at), kind: "context_entry" as const })), ...priorFaqRows.map((entry) => ({ id: entry.id, status: entry.status, content: `${entry.question}\n${entry.answer}`, updatedAt: toIsoString(entry.updated_at), kind: "faq" as const }))],
            [...session.contextEntries.map((entry) => ({ id: entry.id, status: entry.status, content: entry.content, updatedAt: entry.updatedAt, kind: "context_entry" as const })), ...session.faqEntries.map((entry) => ({ id: entry.id, status: entry.status, content: `${entry.question}\n${entry.answer}`, updatedAt: entry.updatedAt, kind: "faq" as const }))],
          );
          const persistedContextForProvenance = priorContextRows.map((row) => ({ id: row.id, source: row.source, metadata: row.metadata, status: row.status })) as never;
          const reviewTransitions = interpretedTransitions.map((transition) => {
            if (transition.action !== "correction") return transition;
            const isContext = transition.entry.kind === "context_entry";
            const prior = isContext ? priorContextRows.find((row) => row.id === transition.entry.id) : priorFaqRows.find((row) => row.id === transition.entry.id);
            const priorFaq = prior as typeof priorFaqRows[number] | undefined;
            const priorFaqSource = priorFaq?.source_entry_ids;
            const priorFaqSourceIds = Array.isArray(priorFaqSource) ? priorFaqSource.filter((id: unknown): id is string => typeof id === "string") : [];
            const predecessor = isContext
              ? classifyContextProvenance({ source: (prior as typeof priorContextRows[number] | undefined)?.source, metadata: prior?.metadata, status: prior?.status } as never)
              : classifyFaqProvenance({ sourceEntryIds: priorFaqSourceIds, metadata: prior?.metadata, status: prior?.status, question: priorFaq?.question ?? "", answer: priorFaq?.answer ?? "" } as never, persistedContextForProvenance);
            const priorMetadata = prior?.metadata && typeof prior.metadata === "object" ? prior.metadata as Record<string, unknown> : {};
            const original = isAiBuilderProvenanceClassification(priorMetadata.originalProvenanceClassification) ? priorMetadata.originalProvenanceClassification : predecessor;
            return { ...transition, entry: { ...transition.entry, provenance: { predecessor, original } } };
          });
          const transitionByEntry = new Map(reviewTransitions.map((transition) => [`${transition.entry.kind}:${transition.entry.id}`, transition]));
          const priorContextById = new Map(priorContextRows.map((row) => [row.id, row]));
          const trustedContextEntries = session.contextEntries.map((entry) => {
            const prior = priorContextById.get(entry.id)!;
            const transition = transitionByEntry.get(`context_entry:${entry.id}`);
            // The browser may edit text and state, but it cannot replace a
            // persisted source/provenance chain.
            const metadata = transition?.action === "correction" ? correctedProvenanceMetadata(prior.metadata, (transition.entry.provenance?.predecessor ?? classifyContextProvenance({ source: prior.source, metadata: prior.metadata, status: prior.status } as never)) as AiBuilderProvenanceClassification) : prior.metadata;
            return normalizeContextProvenance({ ...entry, source: prior.source as typeof entry.source, metadata: metadata as typeof entry.metadata });
          });
          for (const entry of trustedContextEntries) {
            const result = await tx.query(`UPDATE ai_builder_context_entries SET category=$1,title=$2,content=$3,confidence=$4,confidence_score=$5,status=$6,source=$7::jsonb,metadata=$8::jsonb,updated_at=$9::timestamptz WHERE id=$10 AND project_id=$11 RETURNING id`, [entry.category, entry.title, entry.content, entry.confidence, entry.confidenceScore, entry.status, JSON.stringify(entry.source), JSON.stringify(entry.metadata), entry.updatedAt, entry.id, normalizedProjectId]);
            if (result.rowCount !== 1) throw new Error(`governance_context_entry_update_failed:${entry.id}`);
          }
          const contextIdSet = new Set(trustedContextEntries.map((entry) => entry.id));
          const priorFaqById = new Map(priorFaqRows.map((row) => [row.id, row]));
          for (const submitted of session.faqEntries) {
            const prior = priorFaqById.get(submitted.id)!;
            const sourceEntryIds = Array.isArray(prior.source_entry_ids) ? prior.source_entry_ids.filter((id): id is string => typeof id === "string") : [];
            if (sourceEntryIds.some((id) => !contextIdSet.has(id))) throw new Error(`governance_faq_source_entry_not_found_or_not_owned:${submitted.id}`);
            const transition = transitionByEntry.get(`faq:${submitted.id}`);
            const metadata = transition?.action === "correction" ? correctedProvenanceMetadata(prior.metadata, (transition.entry.provenance?.predecessor ?? classifyFaqProvenance({ sourceEntryIds, metadata: prior.metadata, status: prior.status, question: prior.question, answer: prior.answer } as never, trustedContextEntries)) as AiBuilderProvenanceClassification) : prior.metadata;
            const entry = normalizeFaqProvenance({ ...submitted, sourceEntryIds, metadata: metadata as typeof submitted.metadata }, trustedContextEntries);
            const result = await tx.query(`UPDATE ai_builder_faq_entries SET question=$1,answer=$2,confidence=$3,confidence_score=$4,source_entry_ids=$5::jsonb,status=$6,metadata=$7::jsonb,updated_at=$8::timestamptz WHERE id=$9 AND project_id=$10 RETURNING id`, [entry.question, entry.answer, entry.confidence, entry.confidenceScore, JSON.stringify(entry.sourceEntryIds), entry.status, JSON.stringify(entry.metadata ?? {}), entry.updatedAt, entry.id, normalizedProjectId]);
            if (result.rowCount !== 1) throw new Error(`governance_faq_entry_update_failed:${entry.id}`);
          }
          const governancePostconditions = await writeCanonicalGovernanceShadow({ projectId: normalizedProjectId, transitions: reviewTransitions, actor: { clerkUserId, displayName: null, email: null } }, tx);
          await verifyCanonicalGovernanceShadow(governancePostconditions, tx);
          const projectUpdate = await tx.query(`UPDATE ai_builder_projects SET status = $1, assistant_configuration = $2::jsonb, context_counts = $3::jsonb, updated_at = $4::timestamptz, expires_at = $5::timestamptz, governance_revision = governance_revision + 1 WHERE id = $6 AND clerk_user_id = $7 AND archived_at IS NULL AND governance_revision = $8 RETURNING governance_revision`, [session.status, JSON.stringify(session.assistantConfiguration), JSON.stringify(session.contextCounts), session.updatedAt, session.expiresAt, normalizedProjectId, clerkUserId, expectedRevision]);
          if (projectUpdate.rowCount !== 1) throw new Error("stale_governance_revision");
          await client.query("COMMIT");
          break;
        } catch (error) {
          await client.query("ROLLBACK").catch(() => undefined);
          const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
          if (code !== "40001" || attempt === 2) throw error;
        } finally { client.release(); }
      }

    return NextResponse.json({
      ok: true,
      projectId: normalizedProjectId,
      updatedAt: session.updatedAt,
      governanceRevision: Number(session.governanceRevision ?? 0) + 1,
    });
  } catch (error) {
    if (isAuthenticationRequired(error)) return errorResponse(401, "authentication_required", "Sign in to use AI Builder.");
    const message = error instanceof Error ? error.message : "unknown_error";
    if (message === "stale_governance_revision") return errorResponse(409, "stale_governance_revision", "This project changed in another session. Reload it before saving review changes.");
    if (message.startsWith("invalid_review_transition")) return errorResponse(400, "invalid_review_transition", "The submitted review-state transition is not supported.");
    if (message.startsWith("governance_context_entry_") || message.startsWith("governance_faq_entry_") || message === "governance_project_not_found_or_not_owned") return errorResponse(409, "governance_row_validation_failed", "A reviewed item no longer belongs to this project or no longer exists.");
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
