import "server-only";

import { createHash } from "node:crypto";
import type { PoolClient } from "@neondatabase/serverless";
import { BUSINESS_MEMORY_SCHEMA_VERSION, type KnowledgeSourceOrigin } from "../contracts";

type Row = Record<string, any>;
type QueryClient = Pick<PoolClient, "query">;
const originValues = new Set<KnowledgeSourceOrigin>(["manual_intake", "website", "generated_qa", "generated", "user_edit", "imported_data", "system"]);

/** Canonical JSON is used only for deterministic identifiers and material state. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value as object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Row)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
const digest = (value: unknown) => createHash("sha256").update(canonicalJson(value)).digest("hex");
/** Shared identity contract for deterministic FAQ support rows. */
export const stableRelationshipId = (relationship: unknown) => `business_relationship:${digest(relationship)}`;
/** Identity boundary is precisely the immutable Trusted Knowledge legacy key. */
type LogicalRow = { legacy_kind: string; legacy_entry_id: string };
export function logicalKey(projectId: string, row: LogicalRow) { return { projectId, legacyKind: row.legacy_kind, legacyEntryId: row.legacy_entry_id }; }
export function stableEntityId(projectId: string, row: LogicalRow) { return `business_entity:${digest(logicalKey(projectId, row))}`; }
export function stableAssertionId(projectId: string, row: LogicalRow) { return `business_assertion:${digest(logicalKey(projectId, row))}`; }
const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value : null;
const timestamp = (value: unknown): string | null => typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;
const metadata = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const optional = (value: unknown, name: string) => value === undefined || value === null ? null : text(value) ?? (() => { throw new Error(`business_memory_invalid_provenance:${name}`); })();

/**
 * Extracts only the compatibility shapes written by canonical-provenance-shadow:
 * manual snapshot payload is [{ id, label, content }], website payload is the
 * persisted WebsiteKnowledge document.  Payload fields not projected below are
 * deliberately excluded from Business Memory and its material fingerprint.
 */
export function extractBusinessMemoryProvenance(row: Row): { origin: KnowledgeSourceOrigin; sourceEntryId: string | null; intakeBlockId: string | null; url: string | null; label: string | null; capturedAt: string; crawlAttemptId: string | null } {
  const claim = metadata(row.claim_metadata), evidence = metadata(row.evidence_metadata), source = metadata(row.source_metadata), snapshot = metadata(row.snapshot_metadata);
  const payload = row.snapshot_payload;
  const explicitSourceType = text(claim.sourceType) ?? text(evidence.sourceType) ?? text(source.sourceType);
  let origin: KnowledgeSourceOrigin | null = null;
  if (claim.provenanceClassification === "user_corrected") origin = "user_edit";
  else if (row.source_kind === "website") origin = "website";
  else if (explicitSourceType && originValues.has(explicitSourceType as KnowledgeSourceOrigin)) origin = explicitSourceType as KnowledgeSourceOrigin;
  else if (claim.provenanceClassification === "ai_generated") origin = "generated_qa";
  // Manual is valid only where the canonical candidate explicitly records it.
  if (origin === "manual_intake" && row.source_kind !== "manual") throw new Error("business_memory_invalid_provenance:manual_source_kind");
  if (!origin) throw new Error("business_memory_unknown_required_origin");
  const payloadBlock = Array.isArray(payload) ? payload.find((item) => metadata(item).id === evidence.legacyIntakeBlockId) : undefined;
  const block = metadata(payloadBlock);
  const intakeBlockId = optional(evidence.legacyIntakeBlockId ?? snapshot.legacyIntakeBlockId ?? block.id, "intake_block_id");
  const label = optional(evidence.label ?? snapshot.label ?? block.label, "label");
  return { origin, sourceEntryId: optional(source.legacySourceEntryId ?? snapshot.legacySourceEntryId ?? evidence.legacySourceEntryId, "source_entry_id"), intakeBlockId, url: text(row.source_url) ?? text(row.evidence_url), label, capturedAt: timestamp(row.captured_at) ?? (() => { throw new Error("business_memory_invalid_provenance:captured_at"); })(), crawlAttemptId: optional(source.legacyCrawlAttemptId ?? snapshot.legacyCrawlAttemptId, "crawl_attempt_id") };
}

/** Material-state contract: these, and only these persisted projection values, affect revision. */
export function materialState(projectId: string, trustedRows: Row[], evidenceByClaim: Map<string, Row[]>) {
  const assertions = trustedRows.map((row) => ({ logicalKey: logicalKey(projectId, row as LogicalRow), trustedKnowledgeId: row.trusted_id, candidateClaimId: row.claim_id, lifecycle: row.lifecycle, reviewAction: row.review_action, claimType: row.claim_type, category: row.category, title: row.title, content: row.normalized_content, confidence: row.confidence, confidenceScore: row.confidence_score, provenance: (evidenceByClaim.get(row.claim_id) ?? []).map((item) => extractBusinessMemoryProvenance(item)).sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b))) })).sort((a, b) => canonicalJson(a.logicalKey).localeCompare(canonicalJson(b.logicalKey)));
  const evidence = Array.from(evidenceByClaim.values()).flat().map((item) => { const provenance = extractBusinessMemoryProvenance(item); return { canonicalEvidenceId: item.evidence_id, canonicalSourceId: item.canonical_source_id, excerpt: item.content, evidenceUrl: text(item.evidence_url), sourceUrl: text(item.source_url), capturedAt: provenance.capturedAt, provenance }; }).sort((a, b) => a.canonicalEvidenceId.localeCompare(b.canonicalEvidenceId));
  const relationships = trustedRows.filter((row) => row.claim_type === "faq").flatMap((row) => Array.isArray(metadata(row.claim_metadata).legacySourceEntryIds) ? metadata(row.claim_metadata).legacySourceEntryIds.filter((id: unknown): id is string => typeof id === "string").map((id: string) => ({ from: logicalKey(projectId, { legacy_kind: "context_entry", legacy_entry_id: id }), to: logicalKey(projectId, row as LogicalRow), relationshipType: "supports", sourceEntryIds: [id] })) : []).sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b)));
  return { assertions, evidence, relationships };
}
export const materialFingerprint = (state: ReturnType<typeof materialState>) => digest(state);
const cleanup = async (client: QueryClient, table: string, memoryId: string, ids: string[], column = "id") => {
  if (ids.length) await client.query(`DELETE FROM ${table} WHERE memory_id=$1 AND NOT (${column} = ANY($2::text[]))`, [memoryId, ids]);
  else await client.query(`DELETE FROM ${table} WHERE memory_id=$1`, [memoryId]);
};
const cleanupAssertionLinks = async (client: QueryClient, table: string, memoryId: string, assertionIds: string[]) => {
  if (assertionIds.length) await client.query(`DELETE FROM ${table} WHERE assertion_id IN (SELECT id FROM ai_builder_business_memory_assertions WHERE memory_id=$1) AND NOT (assertion_id = ANY($2::text[]))`, [memoryId, assertionIds]);
  else await client.query(`DELETE FROM ${table} WHERE assertion_id IN (SELECT id FROM ai_builder_business_memory_assertions WHERE memory_id=$1)`, [memoryId]);
};

/** Server-only deterministic projection writer. Conflicts and missing-information are independently durable and intentionally untouched. */
export async function rebuildPersistedBusinessMemoryFromTrustedKnowledge(client: QueryClient, projectId: string, trustedKnowledgeRevision: number): Promise<void> {
  const rootId = `business_memory:${projectId}`;
  const trusted = await client.query(`SELECT DISTINCT ON (trusted.legacy_kind, trusted.legacy_entry_id) trusted.id AS trusted_id, trusted.legacy_entry_id, trusted.legacy_kind, trusted.lifecycle, trusted.created_at AS trusted_created_at, claim.id AS claim_id, claim.claim_type, claim.category, claim.title, claim.normalized_content, claim.confidence, claim.confidence_score, claim.metadata AS claim_metadata, review.action AS review_action FROM ai_builder_canonical_trusted_knowledge trusted JOIN ai_builder_canonical_candidate_claims claim ON claim.id=trusted.candidate_claim_id JOIN ai_builder_canonical_claim_reviews review ON review.id=trusted.claim_review_id WHERE trusted.project_id=$1 ORDER BY trusted.legacy_kind, trusted.legacy_entry_id, trusted.revision DESC`, [projectId]);
  const evidence = await client.query(`SELECT link.candidate_claim_id, evidence.id AS evidence_id, evidence.content, evidence.url AS evidence_url, evidence.captured_at, evidence.metadata AS evidence_metadata, source.id AS canonical_source_id, source.kind AS source_kind, source.url AS source_url, source.metadata AS source_metadata, snapshot.metadata AS snapshot_metadata, snapshot.payload AS snapshot_payload FROM ai_builder_canonical_candidate_claim_evidence link JOIN ai_builder_canonical_evidence evidence ON evidence.id=link.evidence_id JOIN ai_builder_canonical_sources source ON source.id=evidence.source_id JOIN ai_builder_canonical_source_snapshots snapshot ON snapshot.id=evidence.source_snapshot_id WHERE source.project_id=$1 ORDER BY link.candidate_claim_id, evidence.id`, [projectId]);
  const byClaim = new Map<string, Row[]>(); for (const item of evidence.rows as Row[]) byClaim.set(item.candidate_claim_id, [...(byClaim.get(item.candidate_claim_id) ?? []), item]);
  for (const row of trusted.rows as Row[]) for (const item of byClaim.get(row.claim_id) ?? []) item.claim_metadata = row.claim_metadata;
  const state = materialState(projectId, trusted.rows as Row[], byClaim), stateFingerprint = materialFingerprint(state);
  const existing = (await client.query("SELECT revision, state_fingerprint, trusted_knowledge_revision FROM ai_builder_business_memory WHERE project_id=$1 FOR UPDATE", [projectId])).rows[0] as Row | undefined;
  if (existing?.state_fingerprint === stateFingerprint) {
    if (Number(existing.trusted_knowledge_revision) !== trustedKnowledgeRevision) await client.query("UPDATE ai_builder_business_memory SET trusted_knowledge_revision=$2, updated_at=$3::timestamptz WHERE project_id=$1", [projectId, trustedKnowledgeRevision, new Date().toISOString()]);
    await client.query("UPDATE ai_builder_projects SET business_memory_revision=$2 WHERE id=$1", [projectId, Number(existing.revision)]); return;
  }
  const now = new Date().toISOString();
  await client.query(`INSERT INTO ai_builder_business_memory (id,project_id,schema_version,revision,trusted_knowledge_revision,state_fingerprint,created_at,updated_at) VALUES ($1,$2,$3,1,$4,$5,$6::timestamptz,$6::timestamptz) ON CONFLICT (project_id) DO UPDATE SET schema_version=EXCLUDED.schema_version,revision=ai_builder_business_memory.revision+1,trusted_knowledge_revision=EXCLUDED.trusted_knowledge_revision,state_fingerprint=EXCLUDED.state_fingerprint,updated_at=EXCLUDED.updated_at`, [rootId, projectId, BUSINESS_MEMORY_SCHEMA_VERSION, trustedKnowledgeRevision, stateFingerprint, now]);
  const entities: string[] = [], assertions: string[] = [], sources = new Set<string>(), evidences = new Set<string>(); const assertionByKey = new Map<string, string>();
  for (const row of trusted.rows as Row[]) {
    const eid = stableEntityId(projectId, row as LogicalRow), aid = stableAssertionId(projectId, row as LogicalRow); entities.push(eid); assertions.push(aid); assertionByKey.set(canonicalJson(logicalKey(projectId, row as LogicalRow)), aid);
    const reviewState = row.lifecycle === "archived" ? "archived" : row.review_action === "correction" ? "corrected" : "approved";
    await client.query(`INSERT INTO ai_builder_business_memory_entities (id,memory_id,entity_type,name,aliases,tags,created_at,updated_at) VALUES ($1,$2,$3,$4,'[]'::jsonb,'[]'::jsonb,$5::timestamptz,$5::timestamptz) ON CONFLICT (id) DO UPDATE SET entity_type=EXCLUDED.entity_type,name=EXCLUDED.name,updated_at=EXCLUDED.updated_at`, [eid, rootId, row.claim_type === "faq" ? "faq" : String(row.category || "other"), row.title, row.trusted_created_at]);
    await client.query(`INSERT INTO ai_builder_business_memory_assertions (id,memory_id,entity_id,trusted_knowledge_id,candidate_claim_id,value,confidence,confidence_score,review_state,authority,tags,legacy_entry_id,trusted_lifecycle,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'[]'::jsonb,$11,$12,$13::timestamptz,$13::timestamptz) ON CONFLICT (id) DO UPDATE SET entity_id=EXCLUDED.entity_id,trusted_knowledge_id=EXCLUDED.trusted_knowledge_id,candidate_claim_id=EXCLUDED.candidate_claim_id,value=EXCLUDED.value,confidence=EXCLUDED.confidence,confidence_score=EXCLUDED.confidence_score,review_state=EXCLUDED.review_state,authority=EXCLUDED.authority,legacy_entry_id=EXCLUDED.legacy_entry_id,trusted_lifecycle=EXCLUDED.trusted_lifecycle,updated_at=EXCLUDED.updated_at`, [aid, rootId, eid, row.trusted_id, row.claim_id, row.normalized_content, row.confidence, row.confidence_score, reviewState, row.review_action === "correction" ? "corrected" : row.claim_metadata?.provenanceClassification === "website" ? "observed" : "confirmed", row.legacy_entry_id, row.review_action === "restore" ? "restored" : row.lifecycle, row.trusted_created_at]);
    for (const item of byClaim.get(row.claim_id) ?? []) { const p = extractBusinessMemoryProvenance(item), sid = `business_memory_source:${item.canonical_source_id}`, evid = `business_memory_evidence:${item.evidence_id}`; sources.add(sid); evidences.add(evid); await client.query(`INSERT INTO ai_builder_business_memory_sources (id,memory_id,canonical_source_id,origin,source_entry_id,intake_block_id,url,label,captured_at,crawl_attempt_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10) ON CONFLICT (id) DO UPDATE SET origin=EXCLUDED.origin,source_entry_id=EXCLUDED.source_entry_id,intake_block_id=EXCLUDED.intake_block_id,url=EXCLUDED.url,label=EXCLUDED.label,captured_at=EXCLUDED.captured_at,crawl_attempt_id=EXCLUDED.crawl_attempt_id`, [sid, rootId, item.canonical_source_id, p.origin, p.sourceEntryId, p.intakeBlockId, p.url, p.label, p.capturedAt, p.crawlAttemptId]); await client.query(`INSERT INTO ai_builder_business_memory_evidence (id,memory_id,source_id,canonical_evidence_id,excerpt,url,captured_at) VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz) ON CONFLICT (id) DO UPDATE SET excerpt=EXCLUDED.excerpt,url=EXCLUDED.url,captured_at=EXCLUDED.captured_at`, [evid, rootId, sid, item.evidence_id, item.content, item.evidence_url, item.captured_at]); await client.query("INSERT INTO ai_builder_business_memory_assertion_sources (assertion_id,source_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [aid, sid]); await client.query("INSERT INTO ai_builder_business_memory_assertion_evidence (assertion_id,evidence_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [aid, evid]); }
  }
  const relationships: string[] = []; for (const relationship of state.relationships) { const from = assertionByKey.get(canonicalJson(relationship.from)), to = assertionByKey.get(canonicalJson(relationship.to)); if (!from || !to) continue; const id = stableRelationshipId(relationship); relationships.push(id); await client.query(`INSERT INTO ai_builder_business_memory_relationships (id,memory_id,relationship_type,from_entity_id,to_entity_id,from_assertion_id,to_assertion_id,source_entry_ids,review_state,created_at,updated_at) SELECT $1,$2,'supports',a.entity_id,b.entity_id,$3,$4,$5::jsonb,b.review_state,b.created_at,b.updated_at FROM ai_builder_business_memory_assertions a JOIN ai_builder_business_memory_assertions b ON b.id=$4 WHERE a.id=$3`, [id, rootId, from, to, JSON.stringify(relationship.sourceEntryIds)]); }
  await cleanup(client, "ai_builder_business_memory_relationships", rootId, relationships);
  await cleanupAssertionLinks(client, "ai_builder_business_memory_assertion_sources", rootId, assertions); await cleanupAssertionLinks(client, "ai_builder_business_memory_assertion_evidence", rootId, assertions);
  await cleanup(client, "ai_builder_business_memory_assertions", rootId, assertions); await cleanup(client, "ai_builder_business_memory_entities", rootId, entities); await cleanup(client, "ai_builder_business_memory_evidence", rootId, Array.from(evidences)); await cleanup(client, "ai_builder_business_memory_sources", rootId, Array.from(sources));
  await client.query("UPDATE ai_builder_projects SET business_memory_revision=(SELECT revision FROM ai_builder_business_memory WHERE project_id=$1) WHERE id=$1", [projectId]);
}
