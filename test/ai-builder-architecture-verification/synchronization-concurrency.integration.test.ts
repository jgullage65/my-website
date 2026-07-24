import assert from "node:assert/strict";
import { cleanup, databaseTest, fixture, insertJob } from "./database-fixture";

databaseTest("concurrent synchronization claims produce one lease and one durable attempt", async () => {
  const s = await fixture();
  try {
    const jobId = await insertJob(s.client, s.projectId);
    const { claimDownstreamSynchronizationJob } = await import("@/app/lib/ai-engine/synchronization/downstream-synchronization");
    const results = await Promise.allSettled([claimDownstreamSynchronizationJob(jobId), claimDownstreamSynchronizationJob(jobId)]);
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(results.filter(result => result.status === "rejected" && String(result.reason).includes("downstream_synchronization_invalid_state")).length, 1);
    const durable = await s.client.query("SELECT status,attempt_count,(SELECT count(*)::int FROM ai_builder_downstream_synchronization_attempts WHERE job_id=$1) attempts FROM ai_builder_downstream_synchronization_jobs WHERE id=$1", [jobId]);
    assert.deepEqual(durable.rows[0], { status: "running", attempt_count: 1, attempts: 1 });
  } finally { await cleanup(s); }
});

databaseTest("concurrent eligible retry workers use SKIP LOCKED without duplicate claims", async () => {
  const s = await fixture();
  try {
    const jobId = await insertJob(s.client, s.projectId, { status: "retry_scheduled", nextAttemptAt: new Date(Date.now() - 60_000) });
    const { executeEligibleSynchronizationRetries } = await import("@/app/lib/ai-engine/synchronization/recovery-service");
    await Promise.all([executeEligibleSynchronizationRetries(1), executeEligibleSynchronizationRetries(1)]);
    const durable = await s.client.query("SELECT attempt_count,(SELECT count(*)::int FROM ai_builder_downstream_synchronization_attempts WHERE job_id=$1) attempts,(SELECT count(*)::int FROM ai_builder_operational_events WHERE synchronization_job_id=$1 AND event_type='retry_started') started FROM ai_builder_downstream_synchronization_jobs WHERE id=$1", [jobId]);
    assert.deepEqual(durable.rows[0], { attempt_count: 1, attempts: 1, started: 1 });
  } finally { await cleanup(s); }
});

databaseTest("concurrent runtime mismatch writes are atomically deduplicated", async () => {
  const s = await fixture();
  try {
    const { writeRuntimeAuthorityMismatchAfterRollback } = await import("@/app/lib/ai-engine/operations/operational-events");
    const occurredAt = new Date("2026-07-24T12:34:00.000Z");
    await Promise.all(Array.from({ length: 8 }, () => writeRuntimeAuthorityMismatchAfterRollback(s.projectId, "runtime_test_mismatch", null, occurredAt)));
    const count = await s.client.query("SELECT count(*)::int count FROM ai_builder_operational_events WHERE project_id=$1 AND event_type='runtime_authority_mismatch'", [s.projectId]);
    assert.equal(count.rows[0].count, 1);
  } finally { await cleanup(s); }
});
