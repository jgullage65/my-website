import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "@neondatabase/serverless";
import type { BusinessMemory } from "../business-memory/contracts";
import { buildAssistantProjection } from "./buildAssistantProjection";
import { evaluateAssistantProjectionFreshnessForRecord, invalidateAssistantProjectionIfStale, rebuildAssistantProjectionForProject, rebuildAssistantProjectionInTransaction } from "./lifecycle";
import { getPersistedAssistantProjection, loadPersistedBusinessMemory, markAssistantProjectionFailedIfUnchanged, updateAssistantProjectionInvalidationState, upsertPersistedAssistantProjection } from "./persistence";
import type { PersistedAssistantProjectionRecord } from "./contracts";

const time = "2025-01-01T00:00:00.000Z";
const memory = (): BusinessMemory => ({ id: "m", schemaVersion: 1, projectId: "p", assistant: { name: "A", purpose: "P", tone: "T", responseStyle: "R", primaryAudience: null, escalationInstructions: [] }, entities: [], assertions: [], relationships: [], sources: [], evidence: [], conflicts: [], missingInformation: [], createdAt: time, updatedAt: time });
const record = (overrides: Partial<PersistedAssistantProjectionRecord> = {}): PersistedAssistantProjectionRecord => { const projection = buildAssistantProjection(memory()); return { projectId: "p", businessMemoryFingerprint: projection.businessMemoryFingerprint, projectionVersion: projection.projectionVersion, schemaVersion: projection.schemaVersion, generatedAt: time, invalidationState: "valid", projection, createdAt: time, updatedAt: time, ...overrides }; };

test("assistant projection freshness explicitly identifies every stale condition", () => {
  const projection = buildAssistantProjection(memory());
  assert.deepEqual(evaluateAssistantProjectionFreshnessForRecord(null, projection), { status: "missing" });
  assert.equal(evaluateAssistantProjectionFreshnessForRecord(record(), projection).status, "current");
  for (const [change, reason] of [
    [{ businessMemoryFingerprint: "business_memory_aaaaaaaaaaaaaaaaaaaaaaaa" }, "fingerprint_mismatch"],
    [{ projectionVersion: 2 }, "projection_version_mismatch"],
    [{ schemaVersion: 2 }, "schema_version_mismatch"],
    [{ invalidationState: "invalidated" }, "invalidation_state"],
    [{ invalidationState: "failed" }, "invalidation_state"],
    [{ invalidationState: "rebuilding" }, "invalidation_state"],
  ] as const) {
    const result = evaluateAssistantProjectionFreshnessForRecord(record(change), projection);
    assert.equal(result.status, "stale"); if (result.status === "stale") assert.ok(result.reasons.includes(reason));
  }
});

test("project ID mismatch is a lifecycle integrity error", () => {
  const projection = buildAssistantProjection(memory());
  assert.throws(() => evaluateAssistantProjectionFreshnessForRecord(record({ projectId: "other" }), projection), /assistant_projection_project_id_mismatch/);
});

test("operational Business Memory timestamps do not make a projection stale", () => {
  const first = buildAssistantProjection(memory());
  const changed = memory(); changed.updatedAt = "2026-01-01T00:00:00.000Z";
  const second = buildAssistantProjection(changed);
  assert.equal(first.businessMemoryFingerprint, second.businessMemoryFingerprint);
  assert.equal(evaluateAssistantProjectionFreshnessForRecord(record(), second).status, "current");
});

const databaseUrl = process.env.DATABASE_URL_TEST;
function db(name: string, fn: () => Promise<void>) { test(name, { skip: databaseUrl ? false : "DATABASE_URL_TEST is not configured" }, fn); }

async function insertPersistedMemory(client: { query: (...args: any[]) => Promise<any> }, projectId: string, clerkUserId = "owner") {
  const memoryId = `memory-${projectId}`, now = "2026-07-23T12:00:00.000Z";
  await client.query("INSERT INTO ai_builder_projects (id,clerk_user_id,status,business_name,industry,assistant_configuration,context_counts,created_at,updated_at) VALUES ($1,$2,'review_required','Test','test',$3::jsonb,'{}'::jsonb,$4,$4)", [projectId, clerkUserId, JSON.stringify({ name: "Assistant", purpose: "Help", tone: "helpful", responseStyle: "concise", escalationInstructions: [] }), now]);
  await client.query("INSERT INTO ai_builder_business_memory (id,project_id,schema_version,revision,trusted_knowledge_revision,created_at,updated_at) VALUES ($1,$2,1,1,1,$3,$3)", [memoryId, projectId, now]);
  return { memoryId, now };
}

db("persisted loader restores conflict links and leaves unsupported missing-information links empty", async () => {
  process.env.DATABASE_URL = databaseUrl;
  const { ensureAiBuilderSchema } = await import("@/app/lib/db/ai-builder-schema"); await ensureAiBuilderSchema();
  const pool = new Pool({ connectionString: databaseUrl }); const client = await pool.connect(); const projectId = `assistant-loader-${randomUUID()}`;
  try {
    const { memoryId, now } = await insertPersistedMemory(client as any, projectId);
    await client.query("INSERT INTO ai_builder_canonical_sources (id,project_id,kind,canonical_identity,created_at) VALUES ('source-z',$1,'manual',$2,$3),('source-a',$1,'manual',$4,$3)", [projectId, `source-z-${projectId}`, now, `source-a-${projectId}`]);
    await client.query("INSERT INTO ai_builder_canonical_source_snapshots (id,source_id,snapshot_identity,snapshot_kind,payload,captured_at) VALUES ('snapshot-z','source-z',$1,'manual','[]'::jsonb,$2),('snapshot-a','source-a',$3,'manual','[]'::jsonb,$2)", [`snapshot-z-${projectId}`, now, `snapshot-a-${projectId}`]);
    await client.query("INSERT INTO ai_builder_canonical_evidence (id,source_id,source_snapshot_id,evidence_identity,content,captured_at) VALUES ('evidence-z','source-z','snapshot-z',$1,'z',$2),('evidence-a','source-a','snapshot-a',$3,'a',$2)", [`evidence-z-${projectId}`, now, `evidence-a-${projectId}`]);
    await client.query("INSERT INTO ai_builder_canonical_candidate_claims (id,claim_identity,project_id,source_snapshot_id,claim_type,category,title,normalized_content,confidence,confidence_score,status,created_at,updated_at) VALUES ('claim-z',$1,$2,'snapshot-z','fact','service','Z','Z','high',1,'approved',$3,$3),('claim-a',$4,$2,'snapshot-a','fact','service','A','A','high',1,'approved',$3,$3)", [`claim-z-${projectId}`, projectId, now, `claim-a-${projectId}`]);
    await client.query("INSERT INTO ai_builder_canonical_claim_reviews (id,review_identity,project_id,candidate_claim_id,action,reviewed_at,created_at) VALUES ('review-z',$1,$2,'claim-z','approve',$3,$3),('review-a',$4,$2,'claim-a','approve',$3,$3)", [`review-z-${projectId}`, projectId, now, `review-a-${projectId}`]);
    await client.query("INSERT INTO ai_builder_canonical_trusted_knowledge (id,trusted_knowledge_identity,project_id,candidate_claim_id,claim_review_id,legacy_kind,legacy_entry_id,revision,lifecycle,created_at) VALUES ('trusted-z',$1,$2,'claim-z','review-z','context_entry','z',1,'active',$3),('trusted-a',$4,$2,'claim-a','review-a','context_entry','a',1,'active',$3)", [`trusted-z-${projectId}`, projectId, now, `trusted-a-${projectId}`]);
    await client.query("INSERT INTO ai_builder_business_memory_entities (id,memory_id,entity_type,name,created_at,updated_at) VALUES ('entity-z',$1,'service','Z',$2,$2),('entity-a',$1,'service','A',$2,$2)", [memoryId, now]);
    await client.query("INSERT INTO ai_builder_business_memory_sources (id,memory_id,canonical_source_id,origin,captured_at) VALUES ('source-z',$1,'source-z','manual_intake',$2),('source-a',$1,'source-a','manual_intake',$2)", [memoryId, now]);
    await client.query("INSERT INTO ai_builder_business_memory_evidence (id,memory_id,source_id,canonical_evidence_id,excerpt,captured_at) VALUES ('evidence-z',$1,'source-z','evidence-z','z',$2),('evidence-a',$1,'source-a','evidence-a','a',$2)", [memoryId, now]);
    await client.query("INSERT INTO ai_builder_business_memory_assertions (id,memory_id,entity_id,trusted_knowledge_id,candidate_claim_id,value,confidence,confidence_score,review_state,authority,created_at,updated_at) VALUES ('assertion-z',$1,'entity-z','trusted-z','claim-z','Z','high',1,'approved','confirmed',$2,$2),('assertion-a',$1,'entity-a','trusted-a','claim-a','A','high',1,'approved','confirmed',$2,$2)", [memoryId, now]);
    await client.query("INSERT INTO ai_builder_business_memory_assertion_sources (assertion_id,source_id) VALUES ('assertion-z','source-z'),('assertion-z','source-a'),('assertion-a','source-a')");
    await client.query("INSERT INTO ai_builder_business_memory_assertion_evidence (assertion_id,evidence_id) VALUES ('assertion-z','evidence-z'),('assertion-z','evidence-a'),('assertion-a','evidence-a')");
    await client.query("INSERT INTO ai_builder_business_memory_conflicts (id,memory_id,resolved_entity_id,topic,conflicting_statements,suggested_question,created_at,updated_at) VALUES ('conflict',$1,'resolved','Conflict','[]'::jsonb,'Clarify',$2,$2)", [memoryId, now]);
    await client.query("INSERT INTO ai_builder_business_memory_conflict_assertions (conflict_id,assertion_id) VALUES ('conflict','assertion-z'),('conflict','assertion-a')");
    await client.query("INSERT INTO ai_builder_business_memory_missing_information (id,memory_id,topic,reason,suggested_question,created_at,updated_at) VALUES ('missing',$1,'Missing','Reason','Ask',$2,$2)", [memoryId, now]);
    const loaded = await loadPersistedBusinessMemory(client, projectId); assert.ok(loaded);
    assert.deepEqual(loaded.conflicts[0].relatedEntityIds, ["entity-a", "entity-z"]); assert.deepEqual(loaded.conflicts[0].relatedAssertionIds, ["assertion-a", "assertion-z"]); assert.deepEqual(loaded.conflicts[0].sourceIds, ["source-a", "source-z"]); assert.deepEqual(loaded.conflicts[0].evidenceIds, ["evidence-a", "evidence-z"]);
    assert.deepEqual(loaded.missingInformation[0].relatedEntityTypes, []); assert.deepEqual(loaded.missingInformation[0].relatedEntityIds, []); assert.deepEqual(loaded.missingInformation[0].relatedAssertionIds, []);
    const projection = buildAssistantProjection(loaded); assert.deepEqual(projection.restrictions.find((item) => item.id === "conflict")?.relatedAssertionIds, ["assertion-a", "assertion-z"]); assert.deepEqual(projection.missingInformation[0].relatedAssertionIds, []);
  } finally { await client.query("DELETE FROM ai_builder_projects WHERE id=$1", [projectId]); client.release(); await pool.end(); }
});

db("transaction-bound rebuild locks before generation and never rewinds a failed state", async () => {
  process.env.DATABASE_URL = databaseUrl;
  const { ensureAiBuilderSchema } = await import("@/app/lib/db/ai-builder-schema");
  await ensureAiBuilderSchema();
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  const projectId = `assistant-lifecycle-${randomUUID()}`;
  try {
    await client.query("INSERT INTO ai_builder_projects (id,status,business_name,industry,assistant_configuration,context_counts,created_at,updated_at) VALUES ($1,'review_required','Test','test','{}'::jsonb,'{}'::jsonb,NOW(),NOW())", [projectId]);
    const currentMemory = { ...memory(), projectId };
    const current = buildAssistantProjection(currentMemory);
    await upsertPersistedAssistantProjection(client, { ...current, projection: current });

    await client.query("BEGIN");
    await assert.rejects(rebuildAssistantProjectionInTransaction({ client, projectId }), /assistant_projection_business_memory_missing/);
    await client.query("COMMIT");
    assert.equal((await getPersistedAssistantProjection(client, projectId))?.businessMemoryFingerprint, current.businessMemoryFingerprint);

    await updateAssistantProjectionInvalidationState(client, projectId, "failed");
    assert.equal((await getPersistedAssistantProjection(client, projectId))?.invalidationState, "failed");

    const freshness = await invalidateAssistantProjectionIfStale({ client, projection: current });
    assert.equal(freshness.status, "stale");
    assert.equal((await getPersistedAssistantProjection(client, projectId))?.invalidationState, "failed");
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    await client.query("DELETE FROM ai_builder_projects WHERE id=$1", [projectId]);
    client.release();
    await pool.end();
  }
});

db("public rebuild is idempotent, replaces material changes, and protects a newer row from stale failure metadata", async () => {
  process.env.DATABASE_URL = databaseUrl;
  const { ensureAiBuilderSchema } = await import("@/app/lib/db/ai-builder-schema"); await ensureAiBuilderSchema();
  const pool = new Pool({ connectionString: databaseUrl }); const client = await pool.connect(); const projectId = `assistant-public-${randomUUID()}`, owner = `owner-${randomUUID()}`, emptyProjectId = `assistant-empty-${randomUUID()}`;
  try {
    await insertPersistedMemory(client, projectId, owner);
    const first = await rebuildAssistantProjectionForProject({ projectId, clerkUserId: owner }); assert.equal(first.rebuilt, true); assert.equal(first.record.invalidationState, "valid");
    assert.equal((await client.query("SELECT * FROM ai_builder_assistant_projections WHERE project_id=$1", [projectId])).rows.length, 1);
    const second = await rebuildAssistantProjectionForProject({ projectId, clerkUserId: owner }); assert.equal(second.rebuilt, false);
    assert.equal(second.record.businessMemoryFingerprint, first.record.businessMemoryFingerprint); assert.equal(second.record.generatedAt, first.record.generatedAt); assert.equal(second.record.updatedAt, first.record.updatedAt); assert.deepEqual(second.record.projection, first.record.projection);
    await client.query("UPDATE ai_builder_projects SET assistant_configuration=$2::jsonb WHERE id=$1", [projectId, JSON.stringify({ name: "Changed", purpose: "Help", tone: "helpful", responseStyle: "concise", escalationInstructions: [] })]);
    const third = await rebuildAssistantProjectionForProject({ projectId, clerkUserId: owner }); assert.equal(third.rebuilt, true); assert.notEqual(third.record.businessMemoryFingerprint, first.record.businessMemoryFingerprint); assert.notDeepEqual(third.record.projection, first.record.projection); assert.equal(third.record.invalidationState, "valid");
    await updateAssistantProjectionInvalidationState(client, projectId, "failed"); const restored = await rebuildAssistantProjectionForProject({ projectId, clerkUserId: owner }); assert.equal(restored.rebuilt, true); assert.equal(restored.record.invalidationState, "valid");
    const staleFailure = await markAssistantProjectionFailedIfUnchanged(client, { projectId, expectedFingerprint: first.record.businessMemoryFingerprint, expectedGeneratedAt: first.record.generatedAt, expectedUpdatedAt: first.record.updatedAt, allowedStates: ["valid", "rebuilding"] }); assert.equal(staleFailure, null); assert.equal((await getPersistedAssistantProjection(client, projectId))?.invalidationState, "valid");
    await client.query("INSERT INTO ai_builder_projects (id,clerk_user_id,status,business_name,industry,assistant_configuration,context_counts,created_at,updated_at) VALUES ($1,$2,'review_required','Empty','test','{}'::jsonb,'{}'::jsonb,NOW(),NOW())", [emptyProjectId, owner]);
    await assert.rejects(rebuildAssistantProjectionForProject({ projectId: emptyProjectId, clerkUserId: owner }), /assistant_projection_business_memory_missing/); assert.equal((await client.query("SELECT * FROM ai_builder_assistant_projections WHERE project_id=$1", [emptyProjectId])).rows.length, 0);
  } finally { await client.query("DELETE FROM ai_builder_projects WHERE id = ANY($1::text[])", [[projectId, emptyProjectId]]); client.release(); await pool.end(); }
});
