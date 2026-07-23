import "server-only";

import type { PoolClient } from "@neondatabase/serverless";
import type { ReviewCommandExecutionLedgerEntry, ReviewCommandExecutionStore, ReviewCommandExecutionTransaction } from "../review-command-executor";
import { reviewProjectStatus } from "../review-read-model";
import { classifyContextStructuralProvenance, classifyFaqStructuralProvenance, correctedProvenanceMetadata } from "@/app/lib/ai-engine/provenance";
import { rebuildTrustedKnowledgeProjection } from "@/app/lib/ai-engine/knowledge/trustedKnowledgeProjection";
import { writeCanonicalGovernanceShadow } from "@/app/lib/db/canonical-provenance-shadow";
import { rebuildPersistedBusinessMemoryFromTrustedKnowledge } from "./rebuild-persisted-business-memory";

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
      updateReviewItem: async ({ itemKind, itemId, from, to, correction, correctionActor, correctionAt }) => {
        const table = itemKind === "context_entry" ? "ai_builder_context_entries" : "ai_builder_faq_entries";
        const contextCorrection = itemKind === "context_entry" && correction?.itemKind === "context_entry" ? correction : null;
        const faqCorrection = itemKind === "faq" && correction?.itemKind === "faq" ? correction : null;
        let correctionMetadata: Record<string, unknown> | null = null;
        if (correction) {
          const item = (await this.client.query(itemKind === "context_entry"
            ? "SELECT source, metadata, status FROM ai_builder_context_entries WHERE id = $1 AND project_id = $2 FOR UPDATE"
            : "SELECT source_entry_ids, metadata, status, question, answer FROM ai_builder_faq_entries WHERE id = $1 AND project_id = $2 FOR UPDATE", [itemId, this.projectId])).rows[0];
          if (!item) throw new Error("review_correction_provenance_invalid");
          if (itemKind === "context_entry") {
            const source = item.source;
            if (!source || typeof source !== "object" || typeof source.intakeBlockId !== "string" || !source.intakeBlockId || typeof source.excerpt !== "string" || !source.excerpt || !["manual_intake", "generated_qa", "website", "user_edit"].includes(source.sourceType)) throw new Error("review_correction_provenance_invalid");
            correctionMetadata = { ...correctedProvenanceMetadata(item.metadata, classifyContextStructuralProvenance({ source, metadata: item.metadata })), userEdited: true, correction: { actor: correctionActor, correctedAt: correctionAt } };
          } else {
            const sourceEntryIds = item.source_entry_ids;
            if (!Array.isArray(sourceEntryIds) || sourceEntryIds.some((id) => typeof id !== "string" || !id)) throw new Error("review_correction_support_invalid");
            if (sourceEntryIds.length) {
              const supported = await this.client.query("SELECT id, project_id, category, title, content, confidence, confidence_score, status, source, metadata, created_at, updated_at FROM ai_builder_context_entries WHERE project_id = $1 AND id = ANY($2::text[])", [this.projectId, sourceEntryIds]);
              if (supported.rowCount !== sourceEntryIds.length) throw new Error("review_correction_support_invalid");
              correctionMetadata = { ...correctedProvenanceMetadata(item.metadata, classifyFaqStructuralProvenance({ sourceEntryIds, question: item.question, answer: item.answer }, supported.rows.map((row) => ({ ...row, sessionId: row.project_id, createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString() })))), userEdited: true, correction: { actor: correctionActor, correctedAt: correctionAt } };
            } else correctionMetadata = { ...correctedProvenanceMetadata(item.metadata, "ai_generated"), userEdited: true, correction: { actor: correctionActor, correctedAt: correctionAt } };
          }
        }
        const set = contextCorrection ? ", category = COALESCE($5, category), title = COALESCE($6, title), content = $7, metadata = $8::jsonb" : faqCorrection ? ", question = $5, answer = $6, metadata = $7::jsonb" : "";
        const values = contextCorrection ? [itemId, this.projectId, from, to, contextCorrection.category ?? null, contextCorrection.title ?? null, contextCorrection.content, JSON.stringify(correctionMetadata)] : faqCorrection ? [itemId, this.projectId, from, to, faqCorrection.question, faqCorrection.answer, JSON.stringify(correctionMetadata)] : [itemId, this.projectId, from, to];
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
      prepareTrustedKnowledge: async ({ itemId, itemKind, commandKind, previousReviewState, actor, projectRevision }) => {
        // First append the authoritative Trusted Knowledge revision.  Business
        // Memory cannot observe the legacy row directly; it is rebuilt only
        // after that revision has been written in this same transaction.
        const row = (await this.client.query(itemKind === "context_entry"
          ? "SELECT id, content, status, updated_at, metadata FROM ai_builder_context_entries WHERE id=$1 AND project_id=$2"
          : "SELECT id, question, answer, status, updated_at, metadata FROM ai_builder_faq_entries WHERE id=$1 AND project_id=$2", [itemId, this.projectId])).rows[0];
        if (!row) throw new Error("canonical_governance_review_item_missing");
        const action = commandKind === "correct" ? "correction" : commandKind;
        await writeCanonicalGovernanceShadow({ projectId: this.projectId, actor, transitions: [{
          action, previousStatus: previousReviewState,
          entry: { kind: itemKind, id: String(row.id), content: itemKind === "context_entry" ? String(row.content) : `${row.question}\n${row.answer}`, status: String(row.status), updatedAt: new Date(row.updated_at).toISOString(), provenance: undefined, conversationCandidateIdentity: itemKind === "context_entry" && typeof row.metadata?.conversationCandidateIdentity === "string" ? row.metadata.conversationCandidateIdentity : undefined },
        }] as never }, this.client);
        await rebuildTrustedKnowledgeProjection(this.client, this.projectId, projectRevision);
        await rebuildPersistedBusinessMemoryFromTrustedKnowledge(this.client, this.projectId, projectRevision);
      },
      recordCommittedCommand: async (entry) => { await this.client.query("INSERT INTO ai_builder_review_command_ledger (command_id, project_id, item_id, resulting_revision, resulting_state, executed_at, result) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)", [entry.commandId, entry.projectId, entry.itemId, entry.resultingRevision, entry.resultingState, entry.executedAt, JSON.stringify(entry.result)]); },
    });
  }
}
