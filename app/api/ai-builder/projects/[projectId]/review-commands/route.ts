import { NextResponse } from "next/server";
import { Pool } from "@neondatabase/serverless";
import { ensureAiBuilderSchema } from "@/app/lib/db/ai-builder-schema";
import { requireClerkUserId, isAuthenticationRequired } from "@/app/lib/auth/clerk";
import { CanonicalReviewCommandExecutor, type ReviewCommandExecutionStore } from "@/app/lib/ai-engine/business-memory/review-command-executor";
import { validateReviewCommand, type AuthoritativeReviewProject } from "@/app/lib/ai-engine/business-memory/review-command-validator";
import type { ReviewCommand, ReviewCommandRequest } from "@/app/lib/ai-engine/business-memory/review-commands";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
let pool: Pool | null = null;
const transactionPool = () => (pool ??= new Pool({ connectionString: process.env.DATABASE_URL }));
const error = (status: number, code: string, message: string) => NextResponse.json({ ok: false, error: { code, message } }, { status });

function transition(kind: ReviewCommandRequest["kind"], from: ReviewCommandRequest["expectedCurrentState"]) {
  const to = kind === "approve" || kind === "restore" ? "approved" : kind === "correct" ? "corrected" : "archived";
  return { from, to };
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const projectId = (await context.params).projectId.trim();
  let body: ReviewCommandRequest;
  try { body = await request.json() as ReviewCommandRequest; } catch { return error(400, "invalid_json", "The request body must be valid JSON."); }
  if (!projectId || body.projectId !== projectId || !body.commandId || !body.itemId) return error(400, "invalid_review_command", "The review command is incomplete.");

  try {
    const clerkUserId = await requireClerkUserId();
    await ensureAiBuilderSchema();
    const client = await transactionPool().connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      const projectRow = (await client.query("SELECT id, clerk_user_id, status, archived_at, governance_revision FROM ai_builder_projects WHERE id = $1 FOR UPDATE", [projectId])).rows[0];
      if (!projectRow) { await client.query("ROLLBACK"); return error(404, "project_not_found", "This AI Builder project could not be found."); }
      const contextRows = (await client.query("SELECT id, project_id, status FROM ai_builder_context_entries WHERE project_id = $1 FOR UPDATE", [projectId])).rows;
      const faqRows = (await client.query("SELECT id, project_id, status FROM ai_builder_faq_entries WHERE project_id = $1 FOR UPDATE", [projectId])).rows;
      const committed = await client.query("SELECT command_id FROM ai_builder_review_command_ledger WHERE command_id = $1", [body.commandId]);
      const authoritative: AuthoritativeReviewProject = { id: projectId, ownerClerkUserId: String(projectRow.clerk_user_id), status: String(projectRow.status), archivedAt: projectRow.archived_at ? new Date(projectRow.archived_at).toISOString() : null, governanceRevision: Number(projectRow.governance_revision), items: [...contextRows.map((row) => ({ id: String(row.id), projectId: String(row.project_id), kind: "context_entry" as const, reviewState: row.status })), ...faqRows.map((row) => ({ id: String(row.id), projectId: String(row.project_id), kind: "faq" as const, reviewState: row.status }))], hasProcessedCommandId: (id) => committed.rows.some((row) => row.command_id === id) };
      const command = { ...body, actor: { clerkUserId, displayName: null, email: null }, requestedTransition: transition(body.kind, body.expectedCurrentState), createdAt: new Date().toISOString() } as ReviewCommand;
      const validation = validateReviewCommand(command, authoritative);
      if (!validation.valid) { await client.query("ROLLBACK"); return error(409, validation.issues[0]?.code ?? "invalid_review_command", validation.issues[0]?.message ?? "The review command is invalid."); }
      const store: ReviewCommandExecutionStore = { transaction: async (_commandId, operation) => operation({
        findCommittedCommand: async () => null,
        updateReviewItem: async ({ itemKind, itemId, from, to, correction }) => {
          const table = itemKind === "context_entry" ? "ai_builder_context_entries" : "ai_builder_faq_entries";
          const set = itemKind === "context_entry" && correction?.itemKind === "context_entry" ? ", category = COALESCE($5, category), title = COALESCE($6, title), content = $7" : itemKind === "faq" && correction?.itemKind === "faq" ? ", question = $5, answer = $6" : "";
          const values = itemKind === "context_entry" ? [itemId, projectId, from, to, correction?.itemKind === "context_entry" ? correction.category ?? null : null, correction?.itemKind === "context_entry" ? correction.title ?? null : null, correction?.itemKind === "context_entry" ? correction.content : null] : [itemId, projectId, from, to, correction?.itemKind === "faq" ? correction.question : null, correction?.itemKind === "faq" ? correction.answer : null];
          const result = await client.query(`UPDATE ${table} SET status = $4, updated_at = NOW()${set} WHERE id = $1 AND project_id = $2 AND status = $3`, values);
          if (result.rowCount !== 1) throw new Error("review_command_update_failed");
        },
        incrementGovernanceRevision: async ({ expectedRevision }) => { const result = await client.query("UPDATE ai_builder_projects SET governance_revision = governance_revision + 1, updated_at = NOW() WHERE id = $1 AND governance_revision = $2 RETURNING governance_revision", [projectId, expectedRevision]); if (result.rowCount !== 1) throw new Error("stale_revision"); return Number(result.rows[0].governance_revision); },
        appendReviewHistory: async (entry) => { await client.query("INSERT INTO ai_builder_review_command_history (id, command_id, project_id, item_id, item_kind, command_kind, actor, previous_state, new_state, project_revision, correction, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11::jsonb,$12)", [entry.id, entry.commandId, entry.projectId, entry.itemId, entry.itemKind, entry.commandKind, JSON.stringify(entry.actor), entry.previousState, entry.newState, entry.projectRevision, JSON.stringify(entry.correctedPayload), entry.createdAt]); },
        updateReviewReadModels: async () => { const counts = (await client.query("SELECT COUNT(*) FILTER (WHERE status IN ('approved','corrected')) AS approved, COUNT(*) FILTER (WHERE status = 'proposed') AS proposed, COUNT(*) FILTER (WHERE status = 'archived') AS archived, COUNT(*) AS total FROM ai_builder_context_entries WHERE project_id = $1", [projectId])).rows[0]; const archivedFaq = (await client.query("SELECT COUNT(*) AS total FROM ai_builder_faq_entries WHERE project_id = $1 AND status = 'archived'", [projectId])).rows[0]; const categories = (await client.query("SELECT category, COUNT(*) AS total FROM ai_builder_context_entries WHERE project_id = $1 GROUP BY category", [projectId])).rows; const byCategory = Object.fromEntries(categories.map((row) => [row.category, Number(row.total)])); await client.query("UPDATE ai_builder_projects SET context_counts = $2::jsonb, status = CASE WHEN $3::int > 0 THEN 'ready' ELSE 'review_required' END WHERE id = $1", [projectId, JSON.stringify({ total: Number(counts.total), approved: Number(counts.approved), proposed: Number(counts.proposed), archived: Number(counts.archived) + Number(archivedFaq.total), byCategory }), Number(counts.approved)]); },
        prepareTrustedKnowledge: async () => undefined,
        recordCommittedCommand: async (entry) => { await client.query("INSERT INTO ai_builder_review_command_ledger (command_id, project_id, item_id, resulting_revision, resulting_state, executed_at, result) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)", [entry.commandId, entry.projectId, entry.itemId, entry.resultingRevision, entry.resultingState, entry.executedAt, JSON.stringify(entry.result)]); },
      }) };
      const result = await new CanonicalReviewCommandExecutor(store).execute(validation);
      const item = (await client.query(command.itemKind === "context_entry" ? "SELECT * FROM ai_builder_context_entries WHERE id = $1" : "SELECT * FROM ai_builder_faq_entries WHERE id = $1", [command.itemId])).rows[0];
      const project = (await client.query("SELECT governance_revision, context_counts, status FROM ai_builder_projects WHERE id = $1", [projectId])).rows[0];
      await client.query("COMMIT");
      return NextResponse.json({ ok: true, result, item, governanceRevision: Number(project.governance_revision), contextCounts: project.context_counts, status: project.status });
    } catch (cause) { await client.query("ROLLBACK").catch(() => undefined); throw cause; } finally { client.release(); }
  } catch (cause) {
    if (isAuthenticationRequired(cause)) return error(401, "authentication_required", "Sign in to use AI Builder.");
    return error(500, "review_command_failed", cause instanceof Error ? cause.message : "The review command could not be saved.");
  }
}
