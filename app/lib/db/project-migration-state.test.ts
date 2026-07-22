import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "@neondatabase/serverless";
import { PROJECT_MIGRATION_TRANSITIONS, isValidProjectMigrationTransition, parseProjectMigrationState } from "../ai-engine/business-memory/migration/project-migration-state";
import { NeonProjectMigrationStore } from "../ai-engine/business-memory/persistence/neon-project-migration-store";

test("project migration state parser accepts only persisted states", () => {
  assert.equal(parseProjectMigrationState("legacy_only"), "legacy_only");
  assert.throws(() => parseProjectMigrationState("unknown"), /AI_BUILDER_INVALID_PERSISTED_MIGRATION_STATE/);
});
test("project migration transition map is explicit", () => {
  assert.equal(PROJECT_MIGRATION_TRANSITIONS.legacy_only, "canonical_shadow");
  assert.equal(PROJECT_MIGRATION_TRANSITIONS.legacy_retired, null);
});
test("project migration rejects skipped, backward, and terminal transitions", () => {
  assert.equal(isValidProjectMigrationTransition("legacy_only", "business_memory_backfilled"), false);
  assert.equal(isValidProjectMigrationTransition("canonical_shadow", "legacy_only"), false);
  assert.equal(isValidProjectMigrationTransition("legacy_retired", "canonical_runtime"), false);
});
test("project migration rejects invalid persisted numeric and timestamp fields", async () => {
  const row: Record<string, unknown> = { id: "project", clerk_user_id: "user", migration_state: "legacy_only", migration_state_version: 1, migration_revision: 0, migration_started_at: null, migration_last_transition_at: null, migration_completed_at: null, migration_last_successful_step: null, migration_last_attempted_step: null, migration_last_error_code: null, migration_last_error_message: null, migration_last_error_at: null, migration_attempt_count: 0, migration_run_id: null };
  const get = async (invalid: Record<string, unknown>) => {
    const store = new NeonProjectMigrationStore({ query: async () => ({ rows: [{ ...row, ...invalid }] }) } as any);
    await store.getProjectMigrationState({ projectId: "project", clerkUserId: "user" });
  };
  await assert.rejects(() => get({ migration_revision: -1 }), (error: any) => error.code === "AI_BUILDER_INVALID_PERSISTED_MIGRATION_RECORD");
  await assert.rejects(() => get({ migration_last_error_at: "not-a-date" }), (error: any) => error.code === "AI_BUILDER_INVALID_PERSISTED_MIGRATION_RECORD");
});

const databaseUrl = process.env.DATABASE_URL_TEST;
function db(name: string, fn: () => Promise<void>) { test(name, { skip: databaseUrl ? false : "DATABASE_URL_TEST is not configured" }, fn); }
async function setup() {
  process.env.DATABASE_URL = databaseUrl;
  const { ensureAiBuilderSchema } = await import("./ai-builder-schema");
  const service = await import("../ai-engine/business-memory/services/project-migration-service");
  await ensureAiBuilderSchema();
  const pool = new Pool({ connectionString: databaseUrl }); const client = await pool.connect();
  const projectId = `migration-${randomUUID()}`, clerkUserId = `user-${randomUUID()}`;
  await client.query("INSERT INTO ai_builder_projects (id,status,business_name,industry,assistant_configuration,context_counts,clerk_user_id,created_at,updated_at) VALUES ($1,'review_required','Test','test','{}'::jsonb,'{}'::jsonb,$2,NOW(),NOW())", [projectId, clerkUserId]);
  const transition = (expectedRevision: number, nextState: any) => service.transitionProjectMigrationState({ projectId, clerkUserId, expectedRevision, nextState, migrationRunId: "run-1", actorType: "system", actorId: null, reason: "test", successfulStep: `step-${nextState}` });
  return { pool, client, projectId, clerkUserId, service, transition };
}
async function cleanup(s: Awaited<ReturnType<typeof setup>>) { await s.client.query("DELETE FROM ai_builder_projects WHERE id=$1", [s.projectId]); s.client.release(); await s.pool.end(); }

db("migration defaults, transitions, history, retry, ownership, and failures are durable", async () => {
  const s = await setup(); try {
    const initial = await s.service.getProjectMigrationState({ projectId: s.projectId, clerkUserId: s.clerkUserId });
    assert.deepEqual([initial.migrationState, initial.migrationStateVersion, initial.migrationRevision], ["legacy_only", 1, 0]);
    const first = await s.transition(0, "canonical_shadow");
    assert.equal(first.migrationRevision, 1); assert.ok(first.migrationStartedAt);
    let history = await s.client.query("SELECT previous_state,next_state FROM ai_builder_project_migration_history WHERE project_id=$1", [s.projectId]);
    assert.deepEqual(history.rows, [{ previous_state: "legacy_only", next_state: "canonical_shadow" }]);
    const retry = await s.transition(1, "canonical_shadow"); assert.equal(retry.migrationRevision, 1);
    assert.equal((await s.client.query("SELECT count(*)::int AS count FROM ai_builder_project_migration_history WHERE project_id=$1", [s.projectId])).rows[0].count, 1);
    await assert.rejects(() => s.service.transitionProjectMigrationState({ projectId: s.projectId, clerkUserId: s.clerkUserId, expectedRevision: 1, nextState: "canonical_shadow", migrationRunId: "different-run", actorType: "system", actorId: null, reason: "test", successfulStep: "step-canonical_shadow" }), (error: any) => error.code === "AI_BUILDER_MIGRATION_REPLAY_MISMATCH");
    await assert.rejects(() => s.service.transitionProjectMigrationState({ projectId: s.projectId, clerkUserId: s.clerkUserId, expectedRevision: 1, nextState: "canonical_shadow", migrationRunId: "run-1", actorType: "system", actorId: null, reason: "test", successfulStep: "different-step" }), (error: any) => error.code === "AI_BUILDER_MIGRATION_REPLAY_MISMATCH");
    await assert.rejects(() => s.transition(1, "assistant_projection_ready"), (error: any) => error.code === "AI_BUILDER_INVALID_MIGRATION_TRANSITION");
    assert.equal((await s.service.getProjectMigrationState({ projectId: s.projectId, clerkUserId: s.clerkUserId })).migrationRevision, 1);
    await assert.rejects(() => s.transition(0, "business_memory_backfilled"), (error: any) => error.code === "AI_BUILDER_MIGRATION_REVISION_CONFLICT");
    await assert.rejects(() => s.service.getProjectMigrationState({ projectId: s.projectId, clerkUserId: "different-user" }), (error: any) => error.code === "AI_BUILDER_PROJECT_NOT_FOUND");
    const failed = await s.service.recordProjectMigrationFailure({ projectId: s.projectId, clerkUserId: s.clerkUserId, expectedRevision: 1, migrationRunId: "run-2", attemptedStep: "backfill", errorCode: "failed", errorMessage: "bad\u0000 error\n    at secret stack" });
    assert.deepEqual([failed.migrationState, failed.migrationRevision, failed.migrationAttemptCount, failed.migrationLastErrorMessage], ["canonical_shadow", 2, 1, "bad error"]);
    assert.equal((await s.client.query("SELECT count(*)::int AS count FROM ai_builder_project_migration_history WHERE project_id=$1", [s.projectId])).rows[0].count, 1);
    await assert.rejects(() => s.transition(1, "business_memory_backfilled"), (error: any) => error.code === "AI_BUILDER_MIGRATION_REVISION_CONFLICT");
    const second = await s.transition(2, "business_memory_backfilled"); assert.equal(second.migrationLastErrorCode, null); assert.equal(second.migrationStartedAt, first.migrationStartedAt);
  } finally { await cleanup(s); }
});

db("simultaneous transitions serialize by revision and retirement is terminal", async () => {
  const s = await setup(); try {
    const [a, b] = await Promise.allSettled([s.transition(0, "canonical_shadow"), s.transition(0, "canonical_shadow")]);
    assert.equal([a, b].filter((result) => result.status === "fulfilled").length, 1);
    assert.equal([a, b].filter((result) => result.status === "rejected" && (result.reason as any).code === "AI_BUILDER_MIGRATION_REVISION_CONFLICT").length, 1);
    for (const next of ["business_memory_backfilled", "business_memory_verified", "assistant_projection_ready", "canonical_runtime", "legacy_retired"] as const) {
      const current = await s.service.getProjectMigrationState({ projectId: s.projectId, clerkUserId: s.clerkUserId }); await s.transition(current.migrationRevision, next);
    }
    const retired = await s.service.getProjectMigrationState({ projectId: s.projectId, clerkUserId: s.clerkUserId }); assert.ok(retired.migrationCompletedAt);
    await assert.rejects(() => s.transition(retired.migrationRevision, "canonical_runtime"), (error: any) => error.code === "AI_BUILDER_INVALID_MIGRATION_TRANSITION");
  } finally { await cleanup(s); }
});
