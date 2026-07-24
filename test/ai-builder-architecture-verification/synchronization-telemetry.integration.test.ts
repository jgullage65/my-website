import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "@neondatabase/serverless";
import { cleanup, databaseTest, databaseUrl, fixture, insertJob, TEST_CLERK_USER_ID } from "./database-fixture";

async function eventCount(client: { query: Function }, projectId: string, types: string[]) {
  return Number((await client.query("SELECT count(*)::int count FROM ai_builder_operational_events WHERE project_id=$1 AND event_type=ANY($2::text[])", [projectId, types])).rows[0].count);
}

databaseTest("retry_started is invisible before claim commit and rolled-back claims emit no lifecycle telemetry", async () => {
  const s = await fixture(); const observerPool = new Pool({ connectionString: databaseUrl }); const observer = await observerPool.connect();
  try {
    const committedJob = await insertJob(s.client, s.projectId);
    const rolledBackJob = await insertJob(s.client, s.projectId);
    const { claimDownstreamSynchronizationJob, markClaimCommittedAndEmitRetryStarted } = await import("@/app/lib/ai-engine/synchronization/downstream-synchronization");

    await s.client.query("BEGIN");
    const claim = await claimDownstreamSynchronizationJob(committedJob, {}, s.client);
    assert.equal(await eventCount(observer, s.projectId, ["retry_started"]), 0);
    assert.equal((await observer.query("SELECT count(*)::int count FROM ai_builder_downstream_synchronization_attempts WHERE job_id=$1", [committedJob])).rows[0].count, 0);
    await s.client.query("COMMIT");
    await markClaimCommittedAndEmitRetryStarted(claim);
    assert.equal(await eventCount(observer, s.projectId, ["retry_started"]), 1);

    await s.client.query("BEGIN");
    await claimDownstreamSynchronizationJob(rolledBackJob, {}, s.client);
    await s.client.query("ROLLBACK");
    assert.equal((await observer.query("SELECT count(*)::int count FROM ai_builder_downstream_synchronization_attempts WHERE job_id=$1", [rolledBackJob])).rows[0].count, 0);
    assert.equal(await eventCount(observer, s.projectId, ["retry_started", "retry_succeeded", "retry_failed", "retry_scheduled", "dead_letter_entered"]), 1);
  } finally { observer.release(); await observerPool.end(); await cleanup(s); }
});

databaseTest("failure and scheduling telemetry is written only after the failure transaction commits", async () => {
  const s = await fixture();
  try {
    const jobId = await insertJob(s.client, s.projectId);
    const { executeDownstreamSynchronizationJob } = await import("@/app/lib/ai-engine/synchronization/downstream-synchronization");
    await assert.rejects(() => executeDownstreamSynchronizationJob(jobId), /business_memory|synchronization/);
    const row = (await s.client.query("SELECT j.status,j.updated_at,e.event_type,e.persisted_at FROM ai_builder_downstream_synchronization_jobs j JOIN ai_builder_operational_events e ON e.synchronization_job_id=j.id WHERE j.id=$1 AND e.event_type IN ('retry_failed','retry_scheduled') ORDER BY e.event_type", [jobId])).rows;
    assert.deepEqual(row.map(value => value.event_type), ["retry_failed", "retry_scheduled"]);
    assert.ok(row.every(value => new Date(value.persisted_at).getTime() >= new Date(value.updated_at).getTime()));
  } finally { await cleanup(s); }
});

databaseTest("retry_succeeded is emitted after the success transaction commits", async () => {
  const s = await fixture();
  try {
    const intakeId = `intake-${randomUUID()}`, contextId = `context-${randomUUID()}`;
    await s.client.query("INSERT INTO ai_builder_intake_blocks (id,project_id,label,content,created_at,updated_at) VALUES ($1,$2,'Services','Planning is available.',NOW(),NOW())", [intakeId, s.projectId]);
    await s.client.query("INSERT INTO ai_builder_context_entries (id,project_id,category,title,content,confidence,confidence_score,status,source,metadata,created_at,updated_at) VALUES ($1,$2,'service','Planning','Planning is available.','high',0.9,'approved',$3::jsonb,$4::jsonb,NOW(),NOW())", [contextId, s.projectId, JSON.stringify({ sourceType: "manual_intake", intakeBlockId: intakeId }), JSON.stringify({ generated: false, provenanceClassification: "manual" })]);
    const { executeProjectBackfill } = await import("@/app/lib/ai-engine/business-memory/services/project-backfill-executor");
    await executeProjectBackfill({ projectId: s.projectId, clerkUserId: TEST_CLERK_USER_ID, migrationRunId: `run-${randomUUID()}`, actorType: "system", actorId: null });
    const jobId = await insertJob(s.client, s.projectId);
    const { executeDownstreamSynchronizationJob } = await import("@/app/lib/ai-engine/synchronization/downstream-synchronization");
    await executeDownstreamSynchronizationJob(jobId);
    const row = (await s.client.query("SELECT j.status,j.completed_at,e.persisted_at FROM ai_builder_downstream_synchronization_jobs j JOIN ai_builder_operational_events e ON e.synchronization_job_id=j.id AND e.event_type='retry_succeeded' WHERE j.id=$1", [jobId])).rows[0];
    assert.equal(row.status, "succeeded");
    assert.ok(new Date(row.persisted_at).getTime() >= new Date(row.completed_at).getTime());
  } finally { await cleanup(s); }
});

databaseTest("stale recovery and dead-letter reopen telemetry is post-commit and best effort", async () => {
  const s = await fixture();
  try {
    const staleJob = await insertJob(s.client, s.projectId, { status: "running", currentStep: "business_memory", attemptCount: 1, claimExpiresAt: new Date(Date.now() - 60_000) });
    const deadJob = await insertJob(s.client, s.projectId, { status: "dead_letter", currentStep: "business_memory", attemptCount: 5, maxAttempts: 5 });
    const { recoverStaleRunningSynchronizationJobs, manuallyRetryDownstreamSynchronization } = await import("@/app/lib/ai-engine/synchronization/recovery-service");
    assert.equal(await recoverStaleRunningSynchronizationJobs(10), 1);
    const stale = (await s.client.query("SELECT j.status,j.updated_at,e.persisted_at FROM ai_builder_downstream_synchronization_jobs j JOIN ai_builder_operational_events e ON e.synchronization_job_id=j.id AND e.event_type='stale_running_recovered' WHERE j.id=$1", [staleJob])).rows[0];
    assert.equal(stale.status, "retry_scheduled");
    assert.ok(new Date(stale.persisted_at).getTime() >= new Date(stale.updated_at).getTime());

    const commandId = `command-${randomUUID()}`;
    await assert.rejects(() => manuallyRetryDownstreamSynchronization({ projectId: s.projectId, jobId: deadJob, commandId, clerkUserId: TEST_CLERK_USER_ID, reason: "verification" }));
    const reopened = (await s.client.query("SELECT c.command_id,e.persisted_at,a.finished_at FROM ai_builder_downstream_synchronization_commands c JOIN ai_builder_operational_events e ON e.command_id=c.command_id AND e.event_type='dead_letter_reopened' JOIN ai_builder_downstream_synchronization_attempts a ON a.id=e.synchronization_attempt_id WHERE c.command_id=$1", [commandId])).rows[0];
    assert.equal(reopened.command_id, commandId);
    assert.ok(new Date(reopened.persisted_at).getTime() >= new Date(reopened.finished_at).getTime());
  } finally { await cleanup(s); }
});

databaseTest("telemetry persistence failure never rolls back a committed dead-letter reopen", async () => {
  const s = await fixture();
  const suffix = randomUUID().replaceAll("-", ""); const functionName = `reject_verification_event_${suffix}`, triggerName = `reject_verification_event_${suffix}`;
  try {
    const jobId = await insertJob(s.client, s.projectId, { status: "dead_letter", currentStep: "business_memory", attemptCount: 5, maxAttempts: 5 });
    await s.client.query(`CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.project_id=TG_ARGV[0] THEN RAISE EXCEPTION 'verification telemetry failure'; END IF; RETURN NEW; END $$`);
    await s.client.query(`CREATE TRIGGER ${triggerName} BEFORE INSERT ON ai_builder_operational_events FOR EACH ROW EXECUTE FUNCTION ${functionName}('${s.projectId}')`);
    const commandId = `command-${randomUUID()}`;
    const { manuallyRetryDownstreamSynchronization } = await import("@/app/lib/ai-engine/synchronization/recovery-service");
    await assert.rejects(() => manuallyRetryDownstreamSynchronization({ projectId: s.projectId, jobId, commandId, clerkUserId: TEST_CLERK_USER_ID }));
    const durable = (await s.client.query("SELECT c.command_id,j.attempt_count FROM ai_builder_downstream_synchronization_commands c JOIN ai_builder_downstream_synchronization_jobs j ON j.id=c.job_id WHERE c.command_id=$1", [commandId])).rows[0];
    assert.equal(durable.command_id, commandId);
    assert.equal(Number(durable.attempt_count), 6);
    assert.equal(await eventCount(s.client, s.projectId, ["dead_letter_reopened", "retry_started", "retry_failed"]), 0);
  } finally {
    await s.client.query(`DROP TRIGGER IF EXISTS ${triggerName} ON ai_builder_operational_events`);
    await s.client.query(`DROP FUNCTION IF EXISTS ${functionName}()`);
    await cleanup(s);
  }
});
