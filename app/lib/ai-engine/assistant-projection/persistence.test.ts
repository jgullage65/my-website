import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "@neondatabase/serverless";
import { ASSISTANT_PROJECTION_SCHEMA_VERSION, ASSISTANT_PROJECTION_VERSION, type AssistantProjection } from "./contracts";
import { AssistantProjectionPersistenceError, getPersistedAssistantProjection, parsePersistedAssistantProjectionRecord, updateAssistantProjectionInvalidationState, upsertPersistedAssistantProjection, validatePersistedAssistantProjectionWrite } from "./persistence";

const databaseUrl = process.env.DATABASE_URL_TEST;
const generatedAt = "2026-07-23T12:00:00.000Z";
const fingerprint = "business_memory_0123456789abcdef01234567";
function projection(projectId: string, businessMemoryFingerprint = fingerprint): AssistantProjection {
  return { projectId, businessMemoryFingerprint, projectionVersion: ASSISTANT_PROJECTION_VERSION, schemaVersion: ASSISTANT_PROJECTION_SCHEMA_VERSION, identity: { status: "missing", canonicalEntityId: null, businessName: null, aliases: [], mergedEntityIds: [], redirectedEntityIds: [], contactEntityIds: [] }, assistant: { name: "Assistant", purpose: "Help", tone: "helpful", responseStyle: "concise", primaryAudience: null, escalationInstructions: [] }, services: [], products: [], pricing: [], policies: [], faqs: [], restrictions: [], relationships: [], sources: [], evidence: [], missingInformation: [] };
}
function row(value = projection("project-1")): Record<string, unknown> {
  return { project_id: value.projectId, business_memory_fingerprint: value.businessMemoryFingerprint, projection_version: value.projectionVersion, schema_version: value.schemaVersion, generated_at: generatedAt, invalidation_state: "valid", projection_json: value, created_at: generatedAt, updated_at: generatedAt };
}
async function setup() {
  process.env.DATABASE_URL = databaseUrl;
  const { ensureAiBuilderSchema } = await import("@/app/lib/db/ai-builder-schema");
  await ensureAiBuilderSchema();
  const pool = new Pool({ connectionString: databaseUrl }); const client = await pool.connect(); const projectId = `assistant-projection-${randomUUID()}`;
  await client.query("INSERT INTO ai_builder_projects (id,status,business_name,industry,assistant_configuration,context_counts,created_at,updated_at) VALUES ($1,'review_required','Test','test','{}'::jsonb,'{}'::jsonb,NOW(),NOW())", [projectId]);
  return { pool, client, projectId };
}
function db(name: string, fn: () => Promise<void>) { test(name, { skip: databaseUrl ? false : "DATABASE_URL_TEST is not configured" }, fn); }

db("inserts, reads, and replaces one current projection per project", async () => {
  const s = await setup(); try {
    const first = projection(s.projectId); const inserted = await upsertPersistedAssistantProjection(s.client, { ...first, projection: first, generatedAt });
    assert.equal(inserted.invalidationState, "valid"); assert.equal(inserted.generatedAt, generatedAt); assert.deepEqual(inserted.projection, first);
    const second = projection(s.projectId, "business_memory_abcdef0123456789abcdef01"); await upsertPersistedAssistantProjection(s.client, { ...second, projection: second, generatedAt: "2026-07-23T13:00:00.000Z" });
    const rows = await s.client.query("SELECT * FROM ai_builder_assistant_projections WHERE project_id=$1", [s.projectId]); assert.equal(rows.rows.length, 1); assert.equal(rows.rows[0].business_memory_fingerprint, second.businessMemoryFingerprint); assert.equal(rows.rows[0].projection_json.generatedAt, undefined);
  } finally { await s.client.query("DELETE FROM ai_builder_projects WHERE id=$1", [s.projectId]); s.client.release(); await s.pool.end(); }
});

db("state updates preserve generated timestamp and upserts always restore valid", async () => {
  const s = await setup(); try {
    const value = projection(s.projectId); await upsertPersistedAssistantProjection(s.client, { ...value, projection: value, generatedAt });
    const updated = await updateAssistantProjectionInvalidationState(s.client, s.projectId, "invalidated");
    assert.equal(updated?.invalidationState, "invalidated"); assert.deepEqual(updated?.projection, value); assert.equal(updated?.generatedAt, generatedAt);
    const upserted = await upsertPersistedAssistantProjection(s.client, { ...value, projection: value, generatedAt }); assert.equal(upserted.invalidationState, "valid");
    assert.equal(await updateAssistantProjectionInvalidationState(s.client, "missing-project", "failed"), null);
  } finally { await s.client.query("DELETE FROM ai_builder_projects WHERE id=$1", [s.projectId]); s.client.release(); await s.pool.end(); }
});

db("omitted generatedAt uses a valid timestamp outside projection JSON", async () => {
  const s = await setup(); try {
    const value = projection(s.projectId); const inserted = await upsertPersistedAssistantProjection(s.client, { ...value, projection: value });
    assert.ok(!Number.isNaN(Date.parse(inserted.generatedAt))); assert.equal("generatedAt" in inserted.projection, false);
  } finally { await s.client.query("DELETE FROM ai_builder_projects WHERE id=$1", [s.projectId]); s.client.release(); await s.pool.end(); }
});

db("separate project rows do not overwrite one another and missing records return null", async () => {
  const a = await setup(), b = await setup(); try {
    const first = projection(a.projectId), second = projection(b.projectId, "business_memory_abcdef0123456789abcdef01");
    await upsertPersistedAssistantProjection(a.client, { ...first, projection: first }); await upsertPersistedAssistantProjection(b.client, { ...second, projection: second });
    assert.equal((await getPersistedAssistantProjection(a.client, a.projectId))?.businessMemoryFingerprint, first.businessMemoryFingerprint); assert.equal((await getPersistedAssistantProjection(b.client, b.projectId))?.businessMemoryFingerprint, second.businessMemoryFingerprint); assert.equal(await getPersistedAssistantProjection(a.client, "missing-project"), null);
  } finally { for (const s of [a, b]) { await s.client.query("DELETE FROM ai_builder_projects WHERE id=$1", [s.projectId]); s.client.release(); await s.pool.end(); } }
});

test("write validation accepts generator-format fingerprints and rejects malformed metadata and payloads", () => {
  const value = projection("project-1"); validatePersistedAssistantProjectionWrite({ ...value, projection: value, generatedAt });
  assert.throws(() => validatePersistedAssistantProjectionWrite({ ...value, businessMemoryFingerprint: "fingerprint-1", projection: value }), /assistant_projection_invalid_fingerprint/);
  for (const [changed, code] of [[{ businessMemoryFingerprint: "fingerprint-1" }, "invalid_payload"], [{ services: {} }, "invalid_payload"], [{ identity: null }, "invalid_payload"], [{ identity: { status: "unknown" } }, "invalid_payload"], [{ assistant: [] }, "invalid_payload"], [{ projectId: "project-2" }, "project_id_mismatch"], [{ businessMemoryFingerprint: "business_memory_abcdef0123456789abcdef01" }, "fingerprint_mismatch"], [{ projectionVersion: 4 }, "invalid_payload"], [{ schemaVersion: 4 }, "invalid_payload"]] as const) {
    assert.throws(() => validatePersistedAssistantProjectionWrite({ ...value, projection: { ...value, ...changed } as AssistantProjection }), (error: unknown) => error instanceof AssistantProjectionPersistenceError && error.code.includes(code));
  }
  assert.throws(() => validatePersistedAssistantProjectionWrite({ ...value, projection: value, generatedAt: "bad" }), /assistant_projection_invalid_generated_at/);
});

test("runtime validation rejects persisted non-authoritative knowledge rather than filtering it", () => {
  const value = projection("project-1");
  const invalid = { ...value, services: [{ id: "proposed", entityId: "entity", assertionId: "assertion", entityType: "service", title: "Proposed", value: "Never serve", aliases: [], tags: [], confidence: { level: "high", score: .9 }, authority: "observed", reviewState: "proposed", evidenceIds: [], sourceIds: [] }] } as unknown as AssistantProjection;
  assert.throws(() => validatePersistedAssistantProjectionWrite({ ...value, projection: invalid }), /assistant_projection_runtime_non_authoritative_knowledge/);
});

test("persisted rows reject malformed payloads, metadata, state, and timestamps", () => {
  const value = projection("project-1");
  for (const [changed, code] of [[{ business_memory_fingerprint: "fingerprint-1" }, "row_fingerprint"], [{ projection_json: { ...value, businessMemoryFingerprint: "fingerprint-1" } }, "invalid_projection_json"], [{ projection_json: { ...value, projectId: "project-2" } }, "row_project_id_mismatch"], [{ projection_json: { ...value, businessMemoryFingerprint: "business_memory_abcdef0123456789abcdef01" } }, "row_fingerprint_mismatch"], [{ projection_json: { ...value, projectionVersion: 4 } }, "invalid_projection_json"], [{ projection_json: { ...value, schemaVersion: 4 } }, "invalid_projection_json"], [{ invalidation_state: "unknown" }, "row_invalidation_state"], [{ generated_at: "bad" }, "row_generated_at"], [{ created_at: "bad" }, "row_created_at"], [{ updated_at: "bad" }, "row_updated_at"], [{ projection_json: { ...value, services: "not-array" } }, "invalid_projection_json"], [{ projection_json: { ...value, identity: null } }, "invalid_projection_json"], [{ projection_json: { ...value, identity: { status: "unknown" } } }, "invalid_projection_json"], [{ projection_json: { ...value, assistant: [] } }, "invalid_projection_json"], [{ projection_json: { ...value, missingInformation: undefined } }, "invalid_projection_json"]] as const) {
    assert.throws(() => parsePersistedAssistantProjectionRecord({ ...row(value), ...changed }), (error: unknown) => error instanceof AssistantProjectionPersistenceError && error.code.includes(code));
  }
  const withoutServices = { ...value } as Partial<AssistantProjection>; delete withoutServices.services;
  assert.throws(() => parsePersistedAssistantProjectionRecord({ ...row(value), projection_json: withoutServices }), /assistant_projection_invalid_projection_json/);
});
