import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL_TEST;
function db(name: string, fn: () => Promise<void>) { test(name, { skip: databaseUrl ? false : "DATABASE_URL_TEST is not configured" }, fn); }

type Fixture = Awaited<ReturnType<typeof setup>>;
const input = (s: Fixture, run: string, hooks?: any) => ({ projectId: s.projectId, clerkUserId: s.clerkUserId, migrationRunId: run, actorType: "system" as const, actorId: null, hooks });

async function setup() {
  process.env.DATABASE_URL = databaseUrl;
  const { ensureAiBuilderSchema } = await import("./ai-builder-schema");
  await ensureAiBuilderSchema();
  const pool = new Pool({ connectionString: databaseUrl }); const client = await pool.connect();
  const projectId = `backfill-${randomUUID()}`, clerkUserId = `owner-${randomUUID()}`;
  const now = new Date().toISOString(), intakeId = `intake-${randomUUID()}`, contextId = `context-${randomUUID()}`;
  await client.query("INSERT INTO ai_builder_projects (id,status,business_name,industry,assistant_configuration,context_counts,governance_revision,trusted_knowledge_revision,clerk_user_id,created_at,updated_at) VALUES ($1,'review_required','Backfill Test','test','{}'::jsonb,'{}'::jsonb,0,0,$2,$3,$3)", [projectId, clerkUserId, now]);
  await client.query("INSERT INTO ai_builder_intake_blocks (id,project_id,label,content,created_at,updated_at) VALUES ($1,$2,'Services','We repair boilers.',$3,$3)", [intakeId, projectId, now]);
  await client.query("INSERT INTO ai_builder_context_entries (id,project_id,category,title,content,confidence,confidence_score,status,source,metadata,created_at,updated_at) VALUES ($1,$2,'services','Boiler repair','We repair boilers.','high',0.9,'approved',$3::jsonb,$4::jsonb,$5,$5)", [contextId, projectId, JSON.stringify({ sourceType: "manual_intake", intakeBlockId: intakeId }), JSON.stringify({ generated: false, provenanceClassification: "manual_intake" }), now]);
  return { pool, client, projectId, clerkUserId };
}
async function cleanup(s: Fixture) { await s.client.query("DELETE FROM ai_builder_projects WHERE id=$1", [s.projectId]); s.client.release(); await s.pool.end(); }
async function executor() { return import("../ai-engine/business-memory/services/project-backfill-executor"); }
async function state(s: Fixture) { return (await s.client.query("SELECT migration_state,migration_revision,migration_last_error_code FROM ai_builder_projects WHERE id=$1", [s.projectId])).rows[0]; }
async function counts(s: Fixture) { return (await s.client.query("SELECT (SELECT count(*)::int FROM ai_builder_canonical_sources WHERE project_id=$1) canonical, (SELECT count(*)::int FROM ai_builder_business_memory WHERE project_id=$1) memory, (SELECT count(*)::int FROM ai_builder_business_memory_assertions a JOIN ai_builder_business_memory m ON m.id=a.memory_id WHERE m.project_id=$1) assertions, (SELECT count(*)::int FROM ai_builder_project_migration_history WHERE project_id=$1) history", [s.projectId])).rows[0]; }
async function transition(s: Fixture, nextState: any, run = `state-${randomUUID()}`) { const service = await import("../ai-engine/business-memory/services/project-migration-service"); const current = await service.getProjectMigrationState({ projectId: s.projectId, clerkUserId: s.clerkUserId }); return service.transitionProjectMigrationState({ projectId: s.projectId, clerkUserId: s.clerkUserId, expectedRevision: current.migrationRevision, nextState, migrationRunId: run, actorType: "system", actorId: null, reason: "test setup", successfulStep: `setup_${nextState}` }); }

db("7E legacy_only repairs canonical, rebuilds Business Memory, and records both checkpoints", async () => {
  const s = await setup(); try {
    const result = await (await executor()).executeProjectBackfill(input(s, "legacy-full"));
    assert.deepEqual([result.startingState, result.endingState, result.completedSteps, result.finalMigrationRevision], ["legacy_only", "business_memory_backfilled", ["canonical_shadow_verified", "business_memory_backfill_verified"], 2]);
    assert.deepEqual(await state(s), { migration_state: "business_memory_backfilled", migration_revision: 2, migration_last_error_code: null });
    assert.deepEqual(await counts(s), { canonical: 1, memory: 1, assertions: 1, history: 2 });
  } finally { await cleanup(s); }
});

db("7E canonical_shadow resume verifies canonical and completes Business Memory once", async () => {
  const s = await setup(); try {
    const run = await executor();
    await transition(s, "canonical_shadow", "canonical-checkpoint");
    const before = await counts(s); assert.deepEqual([before.canonical, before.history], [0, 1]);
    const result = await run.executeProjectBackfill(input(s, "resume-canonical"));
    assert.deepEqual([result.startingState, result.skippedSteps, result.completedSteps, result.finalMigrationRevision], ["canonical_shadow", ["canonical_shadow_verified"], ["business_memory_backfill_verified"], 2]);
    assert.deepEqual(await counts(s), { canonical: 1, memory: 1, assertions: 1, history: 2 });
  } finally { await cleanup(s); }
});

db("7E completed and later states are successful no-ops without mutations", async () => {
  const s = await setup(); try {
    const run = await executor(); await run.executeProjectBackfill(input(s, "complete"));
    const before = await counts(s), beforeState = await state(s);
    for (const next of ["business_memory_backfilled", "business_memory_verified"] as const) {
      if (next === "business_memory_verified") await transition(s, next);
      const result = await run.executeProjectBackfill(input(s, `noop-${next}`));
      assert.deepEqual(result.skippedSteps, ["7e_already_complete"]);
    }
    assert.equal((await counts(s)).canonical, before.canonical); assert.equal((await counts(s)).memory, before.memory);
    assert.equal((await state(s)).migration_revision, beforeState.migration_revision + 1);
  } finally { await cleanup(s); }
});

db("7E enforces ownership before canonical, memory, state, or history mutation", async () => {
  const s = await setup(); try {
    const run = await executor(); const before = await counts(s);
    await assert.rejects(() => run.executeProjectBackfill({ ...input(s, "wrong-owner"), clerkUserId: "wrong-owner" }), /AI_BUILDER_PROJECT_NOT_FOUND|canonical_project_not_found_or_not_owned/);
    assert.deepEqual(await counts(s), before); assert.deepEqual(await state(s), { migration_state: "legacy_only", migration_revision: 0, migration_last_error_code: null });
  } finally { await cleanup(s); }
});

db("7E records canonical failure and does not enter canonical_shadow", async () => {
  const s = await setup(); try {
    const run = await executor();
    await assert.rejects(() => run.executeProjectBackfill(input(s, "canonical-failure", { afterCanonicalPersistence: () => { throw new Error("canonical_not_ready"); } })), /canonical_not_ready/);
    const after = await state(s); assert.deepEqual([after.migration_state, after.migration_revision, after.migration_last_error_code], ["legacy_only", 1, "AI_BUILDER_BACKFILL_FAILED"]);
    assert.equal((await counts(s)).history, 0);
  } finally { await cleanup(s); }
});

db("7E records Business Memory failure and does not enter business_memory_backfilled", async () => {
  const s = await setup(); try {
    const run = await executor();
    await assert.rejects(() => run.executeProjectBackfill(input(s, "memory-failure", { beforeBusinessMemoryRebuild: () => { throw new Error("memory_rebuild_failed"); } })), /memory_rebuild_failed/);
    const after = await state(s); assert.deepEqual([after.migration_state, after.migration_revision, after.migration_last_error_code], ["canonical_shadow", 2, "AI_BUILDER_BACKFILL_FAILED"]);
    assert.deepEqual(await counts(s), { canonical: 1, memory: 0, assertions: 0, history: 1 });
  } finally { await cleanup(s); }
});

db("7E rerun preserves canonical and Business Memory rows and revision", async () => {
  const s = await setup(); try {
    const run = await executor(); await run.executeProjectBackfill(input(s, "first"));
    const before = await counts(s); const revision = (await s.client.query("SELECT revision FROM ai_builder_business_memory WHERE project_id=$1", [s.projectId])).rows[0].revision;
    const result = await run.executeProjectBackfill(input(s, "second"));
    assert.deepEqual(result.skippedSteps, ["7e_already_complete"]); assert.deepEqual(await counts(s), before);
    assert.equal((await s.client.query("SELECT revision FROM ai_builder_business_memory WHERE project_id=$1", [s.projectId])).rows[0].revision, revision);
  } finally { await cleanup(s); }
});

db("7E recovers after canonical persistence without duplicate records", async () => {
  const s = await setup(); try {
    const run = await executor(); await assert.rejects(() => run.executeProjectBackfill(input(s, "crash-canonical", { afterCanonicalPersistence: () => { throw new Error("crash"); } })), /crash/);
    assert.equal((await counts(s)).canonical, 1); await run.executeProjectBackfill(input(s, "recover-canonical"));
    assert.deepEqual(await counts(s), { canonical: 1, memory: 1, assertions: 1, history: 2 });
  } finally { await cleanup(s); }
});

db("7E recovers after Business Memory persistence without duplicate rows or revision increment", async () => {
  const s = await setup(); try {
    const run = await executor(); await assert.rejects(() => run.executeProjectBackfill(input(s, "crash-memory", { afterBusinessMemoryPersistence: () => { throw new Error("crash"); } })), /crash/);
    const before = await counts(s); const revision = (await s.client.query("SELECT revision FROM ai_builder_business_memory WHERE project_id=$1", [s.projectId])).rows[0].revision;
    await run.executeProjectBackfill(input(s, "recover-memory"));
    assert.deepEqual(await counts(s), { ...before, history: 2 });
    assert.equal((await s.client.query("SELECT revision FROM ai_builder_business_memory WHERE project_id=$1", [s.projectId])).rows[0].revision, revision);
  } finally { await cleanup(s); }
});

db("7E concurrent attempts serialize migration transitions and projections", async () => {
  const s = await setup(); try {
    const run = await executor(); const results = await Promise.allSettled([run.executeProjectBackfill(input(s, "concurrent-a")), run.executeProjectBackfill(input(s, "concurrent-b"))]);
    assert.ok(results.some((result) => result.status === "fulfilled"));
    assert.ok(results.some((result) => result.status === "rejected") || results.some((result: any) => result.value.skippedSteps?.includes("7e_already_complete")));
    assert.deepEqual(await counts(s), { canonical: 1, memory: 1, assertions: 1, history: 2 });
  } finally { await cleanup(s); }
});
