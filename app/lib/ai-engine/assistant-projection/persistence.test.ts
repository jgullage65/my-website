import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "@neondatabase/serverless";
import { ASSISTANT_PROJECTION_SCHEMA_VERSION, ASSISTANT_PROJECTION_VERSION, type AssistantProjection } from "./contracts";
import { AssistantProjectionPersistenceError, getPersistedAssistantProjection, parsePersistedAssistantProjectionRecord, updateAssistantProjectionInvalidationState, upsertPersistedAssistantProjection, validatePersistedAssistantProjectionWrite } from "./persistence";

const databaseUrl = process.env.DATABASE_URL_TEST;
const generatedAt = "2026-07-23T12:00:00.000Z";
function projection(projectId: string, fingerprint = "fingerprint-1"): AssistantProjection {
  return { projectId, businessMemoryFingerprint: fingerprint, projectionVersion: ASSISTANT_PROJECTION_VERSION, schemaVersion: ASSISTANT_PROJECTION_SCHEMA_VERSION, identity: { status: "missing", canonicalEntityId: null, businessName: null, aliases: [], mergedEntityIds: [], redirectedEntityIds: [], contactEntityIds: [] }, assistant: { name: "Assistant", purpose: "Help", tone: "helpful", responseStyle: "concise", primaryAudience: null, escalationInstructions: [] }, services: [], pricing: [], policies: [], faqs: [], restrictions: [], relationships: [], sources: [], evidence: [], missingInformation: [] };
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
    const read = await getPersistedAssistantProjection(s.client, s.projectId); assert.deepEqual(read?.projection, first);
    const second = projection(s.projectId, "fingerprint-2"); await upsertPersistedAssistantProjection(s.client, { ...second, projection: second, generatedAt: "2026-07-23T13:00:00.000Z" });
    const rows = await s.client.query("SELECT * FROM ai_builder_assistant_projections WHERE project_id=$1", [s.projectId]); assert.equal(rows.rows.length, 1); assert.equal(rows.rows[0].business_memory_fingerprint, "fingerprint-2"); assert.equal(rows.rows[0].projection_json.generatedAt, undefined);
  } finally { await s.client.query("DELETE FROM ai_builder_projects WHERE id=$1", [s.projectId]); s.client.release(); await s.pool.end(); }
});

db("state transition preserves payload, fingerprint, and generated timestamp", async () => {
  const s = await setup(); try {
    const value = projection(s.projectId); await upsertPersistedAssistantProjection(s.client, { ...value, projection: value, generatedAt });
    const updated = await updateAssistantProjectionInvalidationState(s.client, s.projectId, "invalidated");
    assert.equal(updated?.invalidationState, "invalidated"); assert.deepEqual(updated?.projection, value); assert.equal(updated?.businessMemoryFingerprint, value.businessMemoryFingerprint); assert.equal(updated?.generatedAt, generatedAt);
  } finally { await s.client.query("DELETE FROM ai_builder_projects WHERE id=$1", [s.projectId]); s.client.release(); await s.pool.end(); }
});

db("separate projects remain isolated and missing records return null", async () => {
  const a = await setup(), b = await setup(); try {
    const value = projection(a.projectId); await upsertPersistedAssistantProjection(a.client, { ...value, projection: value });
    assert.equal(await getPersistedAssistantProjection(b.client, b.projectId), null); assert.equal((await getPersistedAssistantProjection(b.client, a.projectId))?.projectId, a.projectId);
  } finally { for (const s of [a, b]) { await s.client.query("DELETE FROM ai_builder_projects WHERE id=$1", [s.projectId]); s.client.release(); await s.pool.end(); } }
});

test("write and read boundaries reject inconsistent or malformed projection metadata", () => {
  const value = projection("project-1");
  for (const [field, changed, code] of [["projectId", "project-2", "project_id"], ["businessMemoryFingerprint", "other", "fingerprint"], ["projectionVersion", 2, "projection_version"], ["schemaVersion", 2, "schema_version"]] as const) {
    const altered = { ...value, [field]: changed } as AssistantProjection;
    assert.throws(() => validatePersistedAssistantProjectionWrite({ ...value, projection: altered }), (error: unknown) => error instanceof AssistantProjectionPersistenceError && error.code.includes(code));
  }
  assert.throws(() => parsePersistedAssistantProjectionRecord({ project_id: "project-1", business_memory_fingerprint: "fingerprint-1", projection_version: 1, schema_version: 1, generated_at: generatedAt, invalidation_state: "valid", projection_json: [], created_at: generatedAt, updated_at: generatedAt }), /assistant_projection_invalid_projection_json/);
});
