import "server-only";

import type { PoolClient } from "@neondatabase/serverless";
import type { KnowledgeFact, KnowledgeFaq, KnowledgePack } from "./contracts";

type Row = Record<string, unknown>;

const trusted = (state: unknown) => state === "approved" || state === "corrected";

/**
 * Rebuilds the current assistant projection from persisted review authority.
 * This is intentionally a full, project-scoped reconciliation: source IDs,
 * rather than content, define logical identity and stale rows are deactivated.
 */
export async function rebuildTrustedKnowledgeProjection(client: PoolClient, projectId: string, governanceRevision: number): Promise<void> {
  const [contexts, faqs] = await Promise.all([
    client.query("SELECT id, category, title, content, confidence, confidence_score, status, source, metadata, created_at, updated_at FROM ai_builder_context_entries WHERE project_id = $1", [projectId]),
    client.query("SELECT id, question, answer, confidence, confidence_score, source_entry_ids, status, metadata, created_at, updated_at FROM ai_builder_faq_entries WHERE project_id = $1", [projectId]),
  ]);
  const sourceKeys: string[] = [];
  for (const row of contexts.rows as Row[]) {
    const id = String(row.id); sourceKeys.push(`context_entry:${id}`);
    await client.query(`INSERT INTO ai_builder_trusted_knowledge_projection (project_id, source_item_id, source_item_kind, review_state, active, content, provenance, source_entry_ids, governance_revision, created_at, updated_at)
      VALUES ($1,$2,'context_entry',$3,$4,$5::jsonb,$6::jsonb,'[]'::jsonb,$7,$8,$9)
      ON CONFLICT (project_id, source_item_kind, source_item_id) DO UPDATE SET review_state=EXCLUDED.review_state, active=EXCLUDED.active, content=EXCLUDED.content, provenance=EXCLUDED.provenance, source_entry_ids=EXCLUDED.source_entry_ids, governance_revision=EXCLUDED.governance_revision, updated_at=EXCLUDED.updated_at`,
    [projectId, id, row.status, trusted(row.status), JSON.stringify({ category: row.category, title: row.title, content: row.content, confidence: row.confidence, confidenceScore: Number(row.confidence_score), source: row.source, metadata: row.metadata }), JSON.stringify(row.metadata ?? {}), governanceRevision, row.created_at, row.updated_at]);
  }
  for (const row of faqs.rows as Row[]) {
    const id = String(row.id); sourceKeys.push(`faq:${id}`);
    await client.query(`INSERT INTO ai_builder_trusted_knowledge_projection (project_id, source_item_id, source_item_kind, review_state, active, content, provenance, source_entry_ids, governance_revision, created_at, updated_at)
      VALUES ($1,$2,'faq',$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9,$10)
      ON CONFLICT (project_id, source_item_kind, source_item_id) DO UPDATE SET review_state=EXCLUDED.review_state, active=EXCLUDED.active, content=EXCLUDED.content, provenance=EXCLUDED.provenance, source_entry_ids=EXCLUDED.source_entry_ids, governance_revision=EXCLUDED.governance_revision, updated_at=EXCLUDED.updated_at`,
    [projectId, id, row.status, trusted(row.status), JSON.stringify({ question: row.question, answer: row.answer, confidence: row.confidence, confidenceScore: Number(row.confidence_score), metadata: row.metadata ?? {} }), JSON.stringify(row.metadata ?? {}), JSON.stringify(row.source_entry_ids ?? []), governanceRevision, row.created_at, row.updated_at]);
  }
  // A source item can only disappear through exceptional repair/import paths.
  // Preserve the audit row but make it ineligible rather than hiding a stale fact.
  if (sourceKeys.length) await client.query("UPDATE ai_builder_trusted_knowledge_projection SET active = FALSE, governance_revision = $2, updated_at = NOW() WHERE project_id = $1 AND (source_item_kind || ':' || source_item_id) <> ALL($3::text[])", [projectId, governanceRevision, sourceKeys]);
  else await client.query("UPDATE ai_builder_trusted_knowledge_projection SET active = FALSE, governance_revision = $2, updated_at = NOW() WHERE project_id = $1", [projectId, governanceRevision]);
}

/** Maps only active, persisted Trusted Knowledge into the existing chat contract. */
export function buildKnowledgePackFromTrustedRows(input: { projectId: string; assistantConfiguration: { name: string; purpose: string; tone: string; primaryAudience: string | null }; rows: Row[] }): KnowledgePack {
  const facts: KnowledgeFact[] = []; const faq: KnowledgeFaq[] = []; const behaviorRules: KnowledgeFact[] = []; const prohibitedClaims: KnowledgeFact[] = [];
  for (const row of input.rows) {
    const content = row.content as Record<string, unknown>;
    if (row.source_item_kind === "faq") { faq.push({ id: `knowledge_${row.source_item_id}`, question: String(content.question ?? ""), answer: String(content.answer ?? ""), confidence: content.confidence as KnowledgeFaq["confidence"], confidenceScore: Number(content.confidenceScore), sourceEntryIds: Array.isArray(row.source_entry_ids) ? row.source_entry_ids.filter((id): id is string => typeof id === "string") : [] }); continue; }
    const source = (content.source ?? {}) as Record<string, unknown>; const metadata = (content.metadata ?? {}) as Record<string, unknown>;
    const fact: KnowledgeFact = { id: `knowledge_${row.source_item_id}`, category: content.category as KnowledgeFact["category"], title: String(content.title ?? ""), content: String(content.content ?? ""), confidence: content.confidence as KnowledgeFact["confidence"], confidenceScore: Number(content.confidenceScore), sourceEntryId: String(row.source_item_id), sourceExcerpt: String(source.excerpt ?? ""), sourceType: String(source.sourceType ?? ""), sourceUrl: typeof source.sourceUrl === "string" ? source.sourceUrl : null, tags: Array.isArray(metadata.tags) ? metadata.tags.filter((tag): tag is string => typeof tag === "string") : [] };
    if (fact.category === "behavior_rule") behaviorRules.push(fact); else if (fact.category === "prohibited_claim") prohibitedClaims.push(fact); else facts.push(fact);
  }
  const sort = <T extends { id: string }>(items: T[]) => items.sort((a, b) => a.id.localeCompare(b.id));
  return { sessionId: input.projectId, assistantName: input.assistantConfiguration.name || "Business AI Assistant", assistantPurpose: input.assistantConfiguration.purpose || "Answer questions using approved business knowledge.", assistantTone: input.assistantConfiguration.tone || "Professional and helpful", primaryAudience: input.assistantConfiguration.primaryAudience, facts: sort(facts), faq: sort(faq), behaviorRules: sort(behaviorRules), prohibitedClaims: sort(prohibitedClaims), builtAt: new Date().toISOString(), version: 1 };
}
