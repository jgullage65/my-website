import "server-only";

import { createHash } from "node:crypto";
import type { PoolClient } from "@neondatabase/serverless";
import { BUSINESS_MEMORY_SCHEMA_VERSION } from "../contracts";

type Row = Record<string, any>;
const origins = new Set(["manual_intake", "website", "generated_qa", "generated", "user_edit", "imported_data", "system"]);
const stable = (value: unknown) => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);
const fingerprint = (value: unknown) => createHash("sha256").update(stable(value)).digest("hex");
const entityId = (projectId: string, row: Row) => `business_entity:${projectId}:${row.legacy_kind}:${row.legacy_entry_id}`;
const assertionId = (row: Row) => `business_assertion:${row.trusted_id}`;
const sourceOrigin = (row: Row) => {
  const origin = row.claim_metadata?.sourceType ?? row.evidence_metadata?.sourceType ?? row.source_metadata?.sourceType;
  if (typeof origin === "string" && origins.has(origin)) return origin;
  if (row.claim_metadata?.provenanceClassification === "user_corrected") return "user_edit";
  return row.source_kind === "website" ? "website" : "manual_intake";
};

/**
 * Server-only deterministic projection writer. Entity identity is the stable
 * Trusted Knowledge logical key (`legacy_kind:legacy_entry_id`), never title.
 * All rows except conflicts/missing-information are projection state. Those two
 * tables are intentionally untouched: current legacy records have no canonical
 * governance lineage or timestamps, so projecting them would invent authority.
 * The caller owns the one surrounding review-command transaction.
 */
export async function rebuildPersistedBusinessMemoryFromTrustedKnowledge(client: Pick<PoolClient, "query">, projectId: string, trustedKnowledgeRevision: number): Promise<void> {
  const rootId = `business_memory:${projectId}`;
  const trusted = await client.query(`SELECT DISTINCT ON (trusted.legacy_kind, trusted.legacy_entry_id)
      trusted.id AS trusted_id, trusted.legacy_entry_id, trusted.legacy_kind, trusted.revision AS trusted_revision, trusted.lifecycle,
      trusted.created_at AS trusted_created_at, claim.id AS claim_id, claim.claim_type, claim.category, claim.title, claim.normalized_content,
      claim.confidence, claim.confidence_score, claim.metadata AS claim_metadata, review.action AS review_action
    FROM ai_builder_canonical_trusted_knowledge trusted
    JOIN ai_builder_canonical_candidate_claims claim ON claim.id=trusted.candidate_claim_id
    JOIN ai_builder_canonical_claim_reviews review ON review.id=trusted.claim_review_id
    WHERE trusted.project_id=$1 ORDER BY trusted.legacy_kind, trusted.legacy_entry_id, trusted.revision DESC`, [projectId]);
  const evidence = await client.query(`SELECT link.candidate_claim_id, evidence.id AS evidence_id, evidence.content, evidence.url AS evidence_url,
      evidence.captured_at, evidence.metadata AS evidence_metadata, source.id AS canonical_source_id, source.kind AS source_kind,
      source.url AS source_url, source.metadata AS source_metadata, snapshot.metadata AS snapshot_metadata, snapshot.payload AS snapshot_payload
    FROM ai_builder_canonical_candidate_claim_evidence link
    JOIN ai_builder_canonical_evidence evidence ON evidence.id=link.evidence_id
    JOIN ai_builder_canonical_sources source ON source.id=evidence.source_id
    JOIN ai_builder_canonical_source_snapshots snapshot ON snapshot.id=evidence.source_snapshot_id
    WHERE source.project_id=$1 ORDER BY link.candidate_claim_id, evidence.id`, [projectId]);
  const evidenceByClaim = new Map<string, Row[]>();
  for (const item of evidence.rows as Row[]) evidenceByClaim.set(item.candidate_claim_id, [...(evidenceByClaim.get(item.candidate_claim_id) ?? []), item]);
  const state = (trusted.rows as Row[]).map((row) => ({ trusted: row, evidence: evidenceByClaim.get(row.claim_id) ?? [] }));
  const stateFingerprint = fingerprint(state);
  const existing = (await client.query("SELECT revision, state_fingerprint FROM ai_builder_business_memory WHERE project_id=$1 FOR UPDATE", [projectId])).rows[0] as Row | undefined;
  if (existing?.state_fingerprint === stateFingerprint) {
    await client.query("UPDATE ai_builder_projects SET business_memory_revision=$2 WHERE id=$1", [projectId, Number(existing.revision)]);
    return;
  }
  const now = new Date().toISOString();
  await client.query(`INSERT INTO ai_builder_business_memory (id,project_id,schema_version,revision,trusted_knowledge_revision,state_fingerprint,created_at,updated_at)
    VALUES ($1,$2,$3,1,$4,$5,$6::timestamptz,$6::timestamptz)
    ON CONFLICT (project_id) DO UPDATE SET schema_version=EXCLUDED.schema_version, revision=ai_builder_business_memory.revision+1,
      trusted_knowledge_revision=EXCLUDED.trusted_knowledge_revision, state_fingerprint=EXCLUDED.state_fingerprint, updated_at=EXCLUDED.updated_at`, [rootId, projectId, BUSINESS_MEMORY_SCHEMA_VERSION, trustedKnowledgeRevision, stateFingerprint, now]);

  const currentEntities: string[] = [], currentAssertions: string[] = [], currentSources = new Set<string>(), currentEvidence = new Set<string>();
  const assertions = new Map<string, string>();
  for (const row of trusted.rows as Row[]) {
    const eid = entityId(projectId, row), aid = assertionId(row); currentEntities.push(eid); currentAssertions.push(aid); assertions.set(`${row.legacy_kind}:${row.legacy_entry_id}`, aid);
    const entityType = row.claim_type === "faq" ? "faq" : String(row.category || "other");
    const reviewState = row.lifecycle === "archived" ? "archived" : row.review_action === "correction" ? "corrected" : "approved";
    const authority = row.review_action === "correction" ? "corrected" : row.claim_metadata?.provenanceClassification === "website_observed" ? "observed" : "confirmed";
    await client.query(`INSERT INTO ai_builder_business_memory_entities (id,memory_id,entity_type,name,aliases,tags,created_at,updated_at) VALUES ($1,$2,$3,$4,'[]'::jsonb,'[]'::jsonb,$5::timestamptz,$5::timestamptz)
      ON CONFLICT (id) DO UPDATE SET entity_type=EXCLUDED.entity_type,name=EXCLUDED.name,updated_at=CASE WHEN (ai_builder_business_memory_entities.entity_type,ai_builder_business_memory_entities.name) IS DISTINCT FROM (EXCLUDED.entity_type,EXCLUDED.name) THEN EXCLUDED.updated_at ELSE ai_builder_business_memory_entities.updated_at END`, [eid, rootId, entityType, row.title, row.trusted_created_at]);
    await client.query(`INSERT INTO ai_builder_business_memory_assertions (id,memory_id,entity_id,trusted_knowledge_id,candidate_claim_id,value,confidence,confidence_score,review_state,authority,tags,legacy_entry_id,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'[]'::jsonb,$11,$12::timestamptz,$12::timestamptz)
      ON CONFLICT (id) DO UPDATE SET entity_id=EXCLUDED.entity_id,trusted_knowledge_id=EXCLUDED.trusted_knowledge_id,candidate_claim_id=EXCLUDED.candidate_claim_id,value=EXCLUDED.value,confidence=EXCLUDED.confidence,confidence_score=EXCLUDED.confidence_score,review_state=EXCLUDED.review_state,authority=EXCLUDED.authority,legacy_entry_id=EXCLUDED.legacy_entry_id,updated_at=CASE WHEN (ai_builder_business_memory_assertions.entity_id,ai_builder_business_memory_assertions.trusted_knowledge_id,ai_builder_business_memory_assertions.candidate_claim_id,ai_builder_business_memory_assertions.value,ai_builder_business_memory_assertions.confidence,ai_builder_business_memory_assertions.confidence_score,ai_builder_business_memory_assertions.review_state,ai_builder_business_memory_assertions.authority,ai_builder_business_memory_assertions.legacy_entry_id) IS DISTINCT FROM (EXCLUDED.entity_id,EXCLUDED.trusted_knowledge_id,EXCLUDED.candidate_claim_id,EXCLUDED.value,EXCLUDED.confidence,EXCLUDED.confidence_score,EXCLUDED.review_state,EXCLUDED.authority,EXCLUDED.legacy_entry_id) THEN EXCLUDED.updated_at ELSE ai_builder_business_memory_assertions.updated_at END`, [aid, rootId, eid, row.trusted_id, row.claim_id, row.normalized_content, row.confidence, row.confidence_score, reviewState, authority, row.legacy_entry_id, row.trusted_created_at]);
    for (const item of evidenceByClaim.get(row.claim_id) ?? []) {
      const sid = `business_memory_source:${item.canonical_source_id}`, evid = `business_memory_evidence:${item.evidence_id}`; currentSources.add(sid); currentEvidence.add(evid);
      const metadata = item.evidence_metadata ?? {}; const snapshot = item.snapshot_metadata ?? {}; const source = item.source_metadata ?? {};
      const intakeBlockId = metadata.legacyIntakeBlockId ?? snapshot.legacyIntakeBlockId ?? null;
      const label = metadata.label ?? snapshot.label ?? null;
      const crawlAttemptId = source.legacyCrawlAttemptId ?? snapshot.legacyCrawlAttemptId ?? null;
      // Canonical sources may be shared by many claims. A legacy entry ID on
      // such a source would be misleading; it belongs on the assertion unless
      // a future canonical source/snapshot supplies a source-level value.
      const sourceEntryId = source.legacySourceEntryId ?? snapshot.legacySourceEntryId ?? metadata.legacySourceEntryId ?? null;
      await client.query(`INSERT INTO ai_builder_business_memory_sources (id,memory_id,canonical_source_id,origin,source_entry_id,intake_block_id,url,label,captured_at,crawl_attempt_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10)
        ON CONFLICT (id) DO UPDATE SET origin=EXCLUDED.origin,source_entry_id=EXCLUDED.source_entry_id,intake_block_id=EXCLUDED.intake_block_id,url=EXCLUDED.url,label=EXCLUDED.label,captured_at=EXCLUDED.captured_at,crawl_attempt_id=EXCLUDED.crawl_attempt_id`, [sid, rootId, item.canonical_source_id, sourceOrigin({ ...item, claim_metadata: row.claim_metadata }), sourceEntryId, intakeBlockId, item.source_url ?? item.evidence_url ?? null, label, item.captured_at, crawlAttemptId]);
      await client.query(`INSERT INTO ai_builder_business_memory_evidence (id,memory_id,source_id,canonical_evidence_id,excerpt,url,captured_at) VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz) ON CONFLICT (id) DO UPDATE SET excerpt=EXCLUDED.excerpt,url=EXCLUDED.url,captured_at=EXCLUDED.captured_at`, [evid, rootId, sid, item.evidence_id, item.content, item.evidence_url, item.captured_at]);
      await client.query("INSERT INTO ai_builder_business_memory_assertion_sources (assertion_id,source_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [aid, sid]);
      await client.query("INSERT INTO ai_builder_business_memory_assertion_evidence (assertion_id,evidence_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [aid, evid]);
    }
  }
  await client.query("DELETE FROM ai_builder_business_memory_relationships WHERE memory_id=$1", [rootId]);
  for (const row of (trusted.rows as Row[]).filter((item) => item.claim_type === "faq")) for (const sourceEntryId of Array.isArray(row.claim_metadata?.legacySourceEntryIds) ? row.claim_metadata.legacySourceEntryIds : []) {
    const from = assertions.get(`context_entry:${sourceEntryId}`), to = assertions.get(`${row.legacy_kind}:${row.legacy_entry_id}`); if (!from || !to) continue;
    await client.query(`INSERT INTO ai_builder_business_memory_relationships (id,memory_id,relationship_type,from_entity_id,to_entity_id,from_assertion_id,to_assertion_id,source_entry_ids,review_state,created_at,updated_at) SELECT $1,$2,'supports',a.entity_id,b.entity_id,$3,$4,$5::jsonb,b.review_state,b.created_at,b.updated_at FROM ai_builder_business_memory_assertions a JOIN ai_builder_business_memory_assertions b ON b.id=$4 WHERE a.id=$3`, [`business_relationship:supports:${from}:${to}`, rootId, from, to, JSON.stringify([sourceEntryId])]);
  }
  // Delete only absent deterministic projection records, after their links.
  await client.query("DELETE FROM ai_builder_business_memory_assertions WHERE memory_id=$1 AND NOT (id = ANY($2::text[]))", [rootId, currentAssertions]);
  await client.query("DELETE FROM ai_builder_business_memory_entities WHERE memory_id=$1 AND NOT (id = ANY($2::text[]))", [rootId, currentEntities]);
  await client.query("DELETE FROM ai_builder_business_memory_evidence WHERE memory_id=$1 AND NOT (id = ANY($2::text[]))", [rootId, Array.from(currentEvidence)]);
  await client.query("DELETE FROM ai_builder_business_memory_sources WHERE memory_id=$1 AND NOT (id = ANY($2::text[]))", [rootId, Array.from(currentSources)]);
  await client.query("UPDATE ai_builder_projects SET business_memory_revision=(SELECT revision FROM ai_builder_business_memory WHERE project_id=$1) WHERE id=$1", [projectId]);
}
