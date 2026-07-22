import "server-only";

import type { PoolClient } from "@neondatabase/serverless";
import type { ReviewCommandExecutionLedgerEntry, ReviewCommandExecutionStore, ReviewCommandExecutionTransaction } from "../review-command-executor";
import { reviewProjectStatus } from "../review-read-model";

/** Transaction-bound Neon adapter for the canonical review command executor. */
export class NeonReviewCommandExecutionStore implements ReviewCommandExecutionStore {
  constructor(private readonly client: PoolClient, private readonly projectId: string) {}

  async transaction<T>(_commandId: string, operation: (transaction: ReviewCommandExecutionTransaction) => Promise<T>): Promise<T> {
    return operation({
      findCommittedCommand: async (commandId) => {
        const row = (await this.client.query("SELECT command_id, project_id, item_id, resulting_revision, resulting_state, executed_at, result FROM ai_builder_review_command_ledger WHERE command_id = $1 FOR UPDATE", [commandId])).rows[0];
        if (!row) return null;
        return {
          commandId: String(row.command_id), projectId: String(row.project_id), itemId: String(row.item_id),
          resultingRevision: Number(row.resulting_revision), resultingState: row.resulting_state,
          executedAt: new Date(row.executed_at).toISOString(), historyRecordId: String(row.result.history.id),
          trustedKnowledgePrepared: Boolean(row.result.trustedKnowledgePrepared), result: row.result,
        } as ReviewCommandExecutionLedgerEntry;
      },
      updateReviewItem: async ({ itemKind, itemId, from, to, correction }) => {
        const table = itemKind === "context_entry" ? "ai_builder_context_entries" : "ai_builder_faq_entries";
        const contextCorrection = itemKind === "context_entry" && correction?.itemKind === "context_entry" ? correction : null;
        const faqCorrection = itemKind === "faq" && correction?.itemKind === "faq" ? correction : null;
        const set = contextCorrection ? ", category = COALESCE($5, category), title = COALESCE($6, title), content = $7" : faqCorrection ? ", question = $5, answer = $6" : "";
        const values = contextCorrection ? [itemId, this.projectId, from, to, contextCorrection.category ?? null, contextCorrection.title ?? null, contextCorrection.content] : faqCorrection ? [itemId, this.projectId, from, to, faqCorrection.question, faqCorrection.answer] : [itemId, this.projectId, from, to];
        const result = await this.client.query(`UPDATE ${table} SET status = $4, updated_at = NOW()${set} WHERE id = $1 AND project_id = $2 AND status = $3`, values);
        if (result.rowCount !== 1) throw new Error("review_command_update_failed");
      },
      incrementGovernanceRevision: async ({ expectedRevision }) => {
        const result = await this.client.query("UPDATE ai_builder_projects SET governance_revision = governance_revision + 1, updated_at = NOW() WHERE id = $1 AND governance_revision = $2 RETURNING governance_revision", [this.projectId, expectedRevision]);
        if (result.rowCount !== 1) throw new Error("stale_revision");
        return Number(result.rows[0].governance_revision);
      },
      appendReviewHistory: async (entry) => { await this.client.query("INSERT INTO ai_builder_review_command_history (id, command_id, project_id, item_id, item_kind, command_kind, actor, previous_state, new_state, project_revision, correction, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11::jsonb,$12)", [entry.id, entry.commandId, entry.projectId, entry.itemId, entry.itemKind, entry.commandKind, JSON.stringify(entry.actor), entry.previousState, entry.newState, entry.projectRevision, JSON.stringify(entry.correctedPayload), entry.createdAt]); },
      updateReviewReadModels: async () => {
        const counts = (await this.client.query("SELECT COUNT(*) FILTER (WHERE status IN ('approved','corrected')) AS approved, COUNT(*) FILTER (WHERE status = 'proposed') AS proposed, COUNT(*) FILTER (WHERE status = 'archived') AS archived, COUNT(*) FILTER (WHERE item_kind = 'context_entry' AND status IN ('approved','corrected')) AS approved_business_knowledge, COUNT(*) AS total FROM (SELECT status, 'context_entry' AS item_kind FROM ai_builder_context_entries WHERE project_id = $1 UNION ALL SELECT status, 'faq' AS item_kind FROM ai_builder_faq_entries WHERE project_id = $1) review_items", [this.projectId])).rows[0];
        const categories = (await this.client.query("SELECT category, COUNT(*) AS total FROM ai_builder_context_entries WHERE project_id = $1 GROUP BY category", [this.projectId])).rows;
        await this.client.query("UPDATE ai_builder_projects SET context_counts = $2::jsonb, status = $3 WHERE id = $1", [this.projectId, JSON.stringify({ total: Number(counts.total), approved: Number(counts.approved), proposed: Number(counts.proposed), archived: Number(counts.archived), byCategory: Object.fromEntries(categories.map((row) => [row.category, Number(row.total)])) }), reviewProjectStatus(Number(counts.approved_business_knowledge))]);
      },
      prepareTrustedKnowledge: async () => undefined,
      recordCommittedCommand: async (entry) => { await this.client.query("INSERT INTO ai_builder_review_command_ledger (command_id, project_id, item_id, resulting_revision, resulting_state, executed_at, result) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)", [entry.commandId, entry.projectId, entry.itemId, entry.resultingRevision, entry.resultingState, entry.executedAt, JSON.stringify(entry.result)]); },
    });
  }
}
