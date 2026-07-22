import "server-only";

import { Pool, type PoolClient } from "@neondatabase/serverless";
import { ensureAiBuilderSchema } from "@/app/lib/db/ai-builder-schema";
import { CanonicalReviewCommandExecutor, ReviewCommandValidationError, type CanonicalReviewCommandExecutionResult } from "../review-command-executor";
import { validateReviewCommand, type AuthoritativeReviewProject } from "../review-command-validator";
import type { ReviewCommand, ReviewCommandRequest } from "../review-commands";
import { NeonReviewCommandExecutionStore } from "../persistence/neon-review-command-execution-store";

let pool: Pool | null = null;
const transactionPool = () => (pool ??= new Pool({ connectionString: process.env.DATABASE_URL }));

export class PersistedReviewCommandError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) { super(message); }
}

export type PersistedReviewCommandResult = {
  result: CanonicalReviewCommandExecutionResult;
  item: Record<string, unknown>;
  governanceRevision: number;
  contextCounts: unknown;
  status: string;
};

function transition(kind: ReviewCommandRequest["kind"], from: ReviewCommandRequest["expectedCurrentState"]) {
  return { from, to: kind === "approve" || kind === "restore" ? "approved" : kind === "unapprove" ? "proposed" : kind === "correct" ? "corrected" : "archived" };
}

/** The server-side application boundary for a persisted review command. */
export async function executePersistedReviewCommand({ projectId, clerkUserId, request }: { projectId: string; clerkUserId: string; request: ReviewCommandRequest }): Promise<PersistedReviewCommandResult> {
  const results = await executePersistedReviewCommandsAtomically({ projectId, clerkUserId, requests: [request] });
  return results[0]!;
}

/** Executes a logical legacy snapshot as one all-or-nothing database transaction. */
export async function executePersistedReviewCommandsAtomically({ projectId, clerkUserId, requests }: { projectId: string; clerkUserId: string; requests: readonly ReviewCommandRequest[] }): Promise<PersistedReviewCommandResult[]> {
  await ensureAiBuilderSchema();
  const client = await transactionPool().connect();
  try {
    // The project row lock is the serialization point. READ COMMITTED makes a
    // waiter observe the winner's ledger row after the lock is released, so an
    // identical concurrent request replays instead of failing with SQLSTATE
    // 40001 from a stale SERIALIZABLE snapshot.
    await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
    const results: PersistedReviewCommandResult[] = [];
    for (const request of requests) results.push(await executeInTransaction(client, { projectId, clerkUserId, request }));
    await client.query("COMMIT");
    return results;
  } catch (cause) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw cause;
  } finally { client.release(); }
}

async function executeInTransaction(client: PoolClient, { projectId, clerkUserId, request }: { projectId: string; clerkUserId: string; request: ReviewCommandRequest }): Promise<PersistedReviewCommandResult> {
  const projectRow = (await client.query("SELECT id, clerk_user_id, status, archived_at, governance_revision FROM ai_builder_projects WHERE id = $1 FOR UPDATE", [projectId])).rows[0];
  if (!projectRow) throw new PersistedReviewCommandError("project_not_found", "This AI Builder project could not be found.", 404);

  const store = new NeonReviewCommandExecutionStore(client, projectId);

  const [contextRows, faqRows] = await Promise.all([
    client.query("SELECT id, project_id, status FROM ai_builder_context_entries WHERE project_id = $1 FOR UPDATE", [projectId]),
    client.query("SELECT id, project_id, status FROM ai_builder_faq_entries WHERE project_id = $1 FOR UPDATE", [projectId]),
  ]);
  const authoritative: AuthoritativeReviewProject = {
      id: projectId, ownerClerkUserId: String(projectRow.clerk_user_id), status: String(projectRow.status),
      archivedAt: projectRow.archived_at ? new Date(projectRow.archived_at).toISOString() : null,
      governanceRevision: Number(projectRow.governance_revision),
      items: [...contextRows.rows.map((row) => ({ id: String(row.id), projectId: String(row.project_id), kind: "context_entry" as const, reviewState: row.status })), ...faqRows.rows.map((row) => ({ id: String(row.id), projectId: String(row.project_id), kind: "faq" as const, reviewState: row.status }))],
  };
  const command = { ...request, actor: { clerkUserId, displayName: null, email: null }, requestedTransition: transition(request.kind, request.expectedCurrentState), createdAt: new Date().toISOString() } as ReviewCommand;
  const validation = validateReviewCommand(command, authoritative);
  let result: CanonicalReviewCommandExecutionResult;
  try { result = await new CanonicalReviewCommandExecutor(store).execute(validation); }
  catch (cause) {
    if (cause instanceof ReviewCommandValidationError) {
      throw new PersistedReviewCommandError(cause.validation.issues[0]?.code ?? "invalid_review_command", cause.validation.issues[0]?.message ?? "The review command is invalid.", 409);
    }
    if (cause instanceof Error && cause.message === "review_command_id_conflict") {
      throw new PersistedReviewCommandError("review_command_id_conflict", "This command ID belongs to a different review command.", 409);
    }
    if (cause instanceof Error && (cause.message === "review_correction_provenance_invalid" || cause.message === "review_correction_support_invalid")) {
      throw new PersistedReviewCommandError(cause.message, "The correction cannot be applied because its stored provenance or support is invalid.", 409);
    }
    throw cause;
  }
  return loadAuthoritativeResponse(client, projectId, command.itemKind, command.itemId, result);
}

async function loadAuthoritativeResponse(client: { query: Function }, projectId: string, itemKind: ReviewCommandRequest["itemKind"], itemId: string, result: CanonicalReviewCommandExecutionResult): Promise<PersistedReviewCommandResult> {
  const [itemResult, projectResult] = await Promise.all([
    client.query(itemKind === "context_entry" ? "SELECT * FROM ai_builder_context_entries WHERE id = $1 AND project_id = $2" : "SELECT * FROM ai_builder_faq_entries WHERE id = $1 AND project_id = $2", [itemId, projectId]),
    client.query("SELECT governance_revision, context_counts, status FROM ai_builder_projects WHERE id = $1", [projectId]),
  ]);
  const project = projectResult.rows[0];
  if (!itemResult.rows[0] || !project) throw new Error("review_command_response_load_failed");
  return { result, item: itemResult.rows[0], governanceRevision: Number(project.governance_revision), contextCounts: project.context_counts, status: String(project.status) };
}
