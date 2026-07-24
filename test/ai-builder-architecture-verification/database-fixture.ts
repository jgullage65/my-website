import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool, type PoolClient } from "@neondatabase/serverless";
import { ASSISTANT_PROJECTION_SCHEMA_VERSION, ASSISTANT_PROJECTION_VERSION, type AssistantProjection } from "@/app/lib/ai-engine/assistant-projection/contracts";

export const databaseUrl = process.env.DATABASE_URL_TEST;
export const TEST_CLERK_USER_ID = "architecture-verification-user";

export function databaseTest(name: string, fn: () => Promise<void>) {
  test(name, { skip: databaseUrl ? false : "DATABASE_URL_TEST is not configured" }, fn);
}

export async function fixture() {
  process.env.DATABASE_URL = databaseUrl;
  const { ensureAiBuilderSchema } = await import("@/app/lib/db/ai-builder-schema");
  await ensureAiBuilderSchema();
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  const projectId = `architecture-verification-${randomUUID()}`;
  await client.query(
    "INSERT INTO ai_builder_projects (id,status,business_name,industry,assistant_configuration,context_counts,clerk_user_id,created_at,updated_at) VALUES ($1,'review_required','Verification','test','{}'::jsonb,'{}'::jsonb,$2,NOW(),NOW())",
    [projectId, TEST_CLERK_USER_ID],
  );
  return { pool, client, projectId };
}

export async function cleanup(value: Awaited<ReturnType<typeof fixture>>) {
  await value.client.query("DELETE FROM ai_builder_projects WHERE id=$1", [value.projectId]);
  value.client.release();
  await value.pool.end();
}

export async function insertJob(client: PoolClient, projectId: string, overrides: Record<string, unknown> = {}) {
  const id = `sync-${randomUUID()}`;
  const row = {
    status: "pending", requestedRevision: 0, currentStep: "pending", attemptCount: 0,
    maxAttempts: 5, nextAttemptAt: null, claimExpiresAt: null, ...overrides,
  };
  await client.query(
    "INSERT INTO ai_builder_downstream_synchronization_jobs (id,project_id,mode,status,requested_trusted_knowledge_revision,current_step,attempt_count,max_attempts,next_attempt_at,claim_expires_at) VALUES ($1,$2,'incremental',$3,$4,$5,$6,$7,$8,$9)",
    [id, projectId, row.status, row.requestedRevision, row.currentStep, row.attemptCount, row.maxAttempts, row.nextAttemptAt, row.claimExpiresAt],
  );
  return id;
}

export function projection(projectId: string, fingerprint = "business_memory_0123456789abcdef01234567"): AssistantProjection {
  return {
    projectId, businessMemoryFingerprint: fingerprint,
    projectionVersion: ASSISTANT_PROJECTION_VERSION, schemaVersion: ASSISTANT_PROJECTION_SCHEMA_VERSION,
    identity: { status: "missing", canonicalEntityId: null, businessName: null, aliases: [], mergedEntityIds: [], redirectedEntityIds: [], contactEntityIds: [] },
    assistant: { name: "Assistant", purpose: "Help", tone: "helpful", responseStyle: "concise", primaryAudience: null, escalationInstructions: [] },
    services: [{ id: "service", entityId: "service", assertionId: "assertion", entityType: "service", title: "Planning", value: "Planning is available.", aliases: [], tags: [], confidence: { level: "high", score: .9 }, authority: "confirmed", reviewState: "approved", evidenceIds: [], sourceIds: [] }],
    products: [], pricing: [], policies: [], faqs: [], restrictions: [], relationships: [], sources: [], evidence: [], missingInformation: [],
  };
}

export async function insertProjectionAndParity(client: PoolClient, projectId: string, value = projection(projectId)) {
  await client.query("UPDATE ai_builder_projects SET runtime_authority='canonical',migration_state='canonical_runtime' WHERE id=$1", [projectId]);
  await client.query("INSERT INTO ai_builder_assistant_projections (project_id,business_memory_fingerprint,projection_version,schema_version,generated_at,invalidation_state,projection_json,created_at,updated_at) VALUES ($1,$2,$3,$4,NOW()-INTERVAL '1 minute','valid',$5::jsonb,NOW()-INTERVAL '1 minute',NOW()-INTERVAL '1 minute')", [projectId, value.businessMemoryFingerprint, value.projectionVersion, value.schemaVersion, JSON.stringify(value)]);
  await client.query("INSERT INTO ai_builder_assistant_projection_parity_reports (project_id,compared_at,legacy_runtime_version,assistant_projection_version,assistant_projection_schema_version,artifact_fingerprint,status,mismatch_summary,category_breakdown,failure_details,active_runtime_authority,updated_at) VALUES ($1,NOW(),1,$2,$3,$4,'MATCH','{}'::jsonb,'{}'::jsonb,NULL,'canonical',NOW())", [projectId, value.projectionVersion, value.schemaVersion, value.businessMemoryFingerprint]);
  return value;
}
