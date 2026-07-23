import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "@neondatabase/serverless";
import type { BusinessMemory } from "../business-memory/contracts";
import { buildAssistantProjection } from "./buildAssistantProjection";
import { evaluateAssistantProjectionFreshnessForRecord, invalidateAssistantProjectionIfStale, rebuildAssistantProjectionInTransaction } from "./lifecycle";
import { getPersistedAssistantProjection, updateAssistantProjectionInvalidationState, upsertPersistedAssistantProjection } from "./persistence";
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
