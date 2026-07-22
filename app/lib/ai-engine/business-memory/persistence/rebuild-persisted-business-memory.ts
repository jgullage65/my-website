import "server-only";

import type { PoolClient } from "@neondatabase/serverless";
import { BUSINESS_MEMORY_SCHEMA_VERSION } from "../contracts";

/**
 * The only Business Memory writer.  Its input is the append-only Trusted
 * Knowledge graph, never a session, browser payload, or runtime projection.
 * The caller owns the surrounding transaction.
 */
export async function rebuildPersistedBusinessMemoryFromTrustedKnowledge(
  client: Pick<PoolClient, "query">,
  projectId: string,
  trustedKnowledgeRevision: number,
): Promise<void> {
  const rootId = `business_memory:${projectId}`;
  const now = new Date().toISOString();
  // The root is installed before child replacement.  Since this function runs
  // in the Review Command transaction, any failed child write restores the
  // previously valid root and normalized records on rollback.
  await client.query(`INSERT INTO ai_builder_business_memory (id,project_id,schema_version,revision,trusted_knowledge_revision,created_at,updated_at)
    VALUES ($1,$2,$3,1,$4,$5::timestamptz,$5::timestamptz)
    ON CONFLICT (project_id) DO UPDATE SET revision=ai_builder_business_memory.revision+1, trusted_knowledge_revision=EXCLUDED.trusted_knowledge_revision, updated_at=EXCLUDED.updated_at`, [rootId, projectId, BUSINESS_MEMORY_SCHEMA_VERSION, trustedKnowledgeRevision, now]);

  // These records are a replaceable deterministic projection.  FK cascades
  // remove link rows as well; the parent root is retained throughout.
  await client.query("DELETE FROM ai_builder_business_memory_entities WHERE memory_id=$1", [rootId]);
  await client.query("DELETE FROM ai_builder_business_memory_evidence WHERE memory_id=$1", [rootId]);
  await client.query("DELETE FROM ai_builder_business_memory_sources WHERE memory_id=$1", [rootId]);

  const trusted = await client.query(`SELECT DISTINCT ON (trusted.legacy_kind, trusted.legacy_entry_id)
      trusted.id AS trusted_id, trusted.legacy_entry_id, trusted.legacy_kind, trusted.revision AS trusted_revision, trusted.lifecycle,
      trusted.created_at AS trusted_created_at, claim.id AS claim_id, claim.claim_type, claim.category, claim.title,
      claim.normalized_content, claim.confidence, claim.confidence_score, claim.metadata AS claim_metadata,
      review.action AS review_action
    FROM ai_builder_canonical_trusted_knowledge trusted
    JOIN ai_builder_canonical_candidate_claims claim ON claim.id=trusted.candidate_claim_id
    JOIN ai_builder_canonical_claim_reviews review ON review.id=trusted.claim_review_id
    WHERE trusted.project_id=$1
    ORDER BY trusted.legacy_kind, trusted.legacy_entry_id, trusted.revision DESC`, [projectId]);

  const assertionIds = new Map<string, string>();
  for (const row of trusted.rows) {
    const entityType = row.claim_type === "faq" ? "faq" : String(row.category || "other");
    const entityId = `business_entity:${projectId}:${entityType}:${Buffer.from(String(row.title).trim().toLocaleLowerCase()).toString("base64url")}`;
    const assertionId = `business_assertion:${row.trusted_id}`;
    assertionIds.set(`${row.legacy_kind}:${row.legacy_entry_id}`, assertionId);
    const reviewState = row.lifecycle === "archived" ? "archived" : row.review_action === "correction" ? "corrected" : "approved";
    const authority = row.review_action === "correction" ? "corrected" : String(row.claim_metadata?.provenanceClassification) === "website_observed" ? "observed" : "confirmed";
    await client.query(`INSERT INTO ai_builder_business_memory_entities (id,memory_id,entity_type,name,aliases,tags,created_at,updated_at)
      VALUES ($1,$2,$3,$4,'[]'::jsonb,'[]'::jsonb,$5::timestamptz,$5::timestamptz)
      ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,updated_at=EXCLUDED.updated_at`, [entityId, rootId, entityType, row.title, row.trusted_created_at]);
    await client.query(`INSERT INTO ai_builder_business_memory_assertions (id,memory_id,entity_id,trusted_knowledge_id,candidate_claim_id,value,confidence,confidence_score,review_state,authority,tags,legacy_entry_id,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'[]'::jsonb,$11,$12::timestamptz,$12::timestamptz)`, [assertionId, rootId, entityId, row.trusted_id, row.claim_id, row.normalized_content, row.confidence, row.confidence_score, reviewState, authority, row.legacy_entry_id, row.trusted_created_at]);

    const evidence = await client.query(`SELECT evidence.id,evidence.source_id,evidence.content,evidence.url,evidence.captured_at,source.kind,source.url AS source_url,source.metadata
      FROM ai_builder_canonical_candidate_claim_evidence link
      JOIN ai_builder_canonical_evidence evidence ON evidence.id=link.evidence_id
      JOIN ai_builder_canonical_sources source ON source.id=evidence.source_id
      WHERE link.candidate_claim_id=$1 ORDER BY evidence.id`, [row.claim_id]);
    for (const item of evidence.rows) {
      const sourceId = `business_memory_source:${item.source_id}`;
      const evidenceId = `business_memory_evidence:${item.id}`;
      const origin = item.kind === "website" ? "website" : "manual_intake";
      await client.query(`INSERT INTO ai_builder_business_memory_sources (id,memory_id,canonical_source_id,origin,source_entry_id,intake_block_id,url,label,captured_at,crawl_attempt_id)
        VALUES ($1,$2,$3,$4,NULL,NULL,$5,NULL,$6::timestamptz,NULL) ON CONFLICT (id) DO NOTHING`, [sourceId, rootId, item.source_id, origin, item.source_url ?? item.url, item.captured_at]);
      await client.query(`INSERT INTO ai_builder_business_memory_evidence (id,memory_id,source_id,canonical_evidence_id,excerpt,url,captured_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz) ON CONFLICT (id) DO NOTHING`, [evidenceId, rootId, sourceId, item.id, item.content, item.url, item.captured_at]);
      await client.query("INSERT INTO ai_builder_business_memory_assertion_sources (assertion_id,source_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [assertionId, sourceId]);
      await client.query("INSERT INTO ai_builder_business_memory_assertion_evidence (assertion_id,evidence_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [assertionId, evidenceId]);
    }
  }

  // FAQ support is itself canonical claim metadata; it creates a relationship
  // only when both endpoints exist in the current Trusted Knowledge state.
  for (const row of trusted.rows.filter((item) => item.claim_type === "faq")) {
    const support = Array.isArray(row.claim_metadata?.legacySourceEntryIds) ? row.claim_metadata.legacySourceEntryIds : [];
    for (const sourceEntryId of support) {
      const from = assertionIds.get(`context_entry:${sourceEntryId}`); const to = assertionIds.get(`${row.legacy_kind}:${row.legacy_entry_id}`);
      if (!from || !to) continue;
      await client.query(`INSERT INTO ai_builder_business_memory_relationships (id,memory_id,relationship_type,from_entity_id,to_entity_id,from_assertion_id,to_assertion_id,source_entry_ids,review_state,created_at,updated_at)
        SELECT $1,$2,'supports',a.entity_id,b.entity_id,$3,$4,$5::jsonb,b.review_state,b.created_at,b.updated_at FROM ai_builder_business_memory_assertions a JOIN ai_builder_business_memory_assertions b ON b.id=$4 WHERE a.id=$3`, [`business_relationship:supports:${from}:${to}`, rootId, from, to, JSON.stringify([sourceEntryId])]);
    }
  }
  await client.query("UPDATE ai_builder_projects SET business_memory_revision=(SELECT revision FROM ai_builder_business_memory WHERE project_id=$1) WHERE id=$1", [projectId]);
}
