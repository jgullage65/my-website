import assert from "node:assert/strict";
import { cleanup, databaseTest, fixture, insertJob } from "./database-fixture";

databaseTest("persisted drift signature A is resolved when signature B replaces it", async () => {
  const s = await fixture();
  try {
    const { inspectProjectDrift } = await import("@/app/lib/ai-engine/operations/drift-inspection");
    const { unresolvedDriftEvents } = await import("@/app/lib/ai-engine/operations/operational-events");
    const first = await inspectProjectDrift(s.client, s.projectId);
    assert.equal(first.drifted, true);
    const signatureA = (await s.client.query("SELECT metadata->>'signature' signature FROM ai_builder_operational_events WHERE project_id=$1 AND event_type='drift_unresolved' ORDER BY occurred_at DESC,id DESC LIMIT 1", [s.projectId])).rows[0].signature;
    await insertJob(s.client, s.projectId, { status: "failed" });
    const second = await inspectProjectDrift(s.client, s.projectId);
    assert.equal(second.drifted, true);
    const rows = (await s.client.query("SELECT event_type,metadata FROM ai_builder_operational_events WHERE project_id=$1 AND event_type IN ('drift_resolved','drift_unresolved') ORDER BY occurred_at,id", [s.projectId])).rows;
    const signatureB = rows.filter(row => row.event_type === "drift_unresolved").at(-1).metadata.signature;
    assert.notEqual(signatureA, signatureB);
    assert.ok(rows.some(row => row.event_type === "drift_resolved" && row.metadata.signature === signatureA && row.metadata.replacementSignature === signatureB));
    assert.deepEqual((await unresolvedDriftEvents(s.client, s.projectId)).map((row: any) => row.metadata.signature), [signatureB]);
  } finally { await cleanup(s); }
});

databaseTest("operational dashboard status remains authoritative from domain tables without or despite telemetry", async () => {
  const s = await fixture();
  try {
    await insertJob(s.client, s.projectId, { status: "dead_letter", attemptCount: 5, maxAttempts: 5 });
    const { getOperationalStatus } = await import("@/app/lib/ai-engine/operations/operational-status");
    const withoutTelemetry = await getOperationalStatus(s.client, s.projectId);
    assert.equal(withoutTelemetry.synchronizationJobCounts.dead_letter, 1);
    assert.equal(withoutTelemetry.latestRetryOrDeadLetter, null);

    const { writeOperationalEvent } = await import("@/app/lib/ai-engine/operations/operational-events");
    await writeOperationalEvent(s.client, { projectId: s.projectId, eventType: "retry_succeeded", category: "retry_recovery", severity: "info", outcome: "succeeded", sourceComponent: "misleading-verification-event" });
    const misleadingTelemetry = await getOperationalStatus(s.client, s.projectId);
    assert.equal(misleadingTelemetry.latestRetryOrDeadLetter.event_type, "retry_succeeded");
    assert.equal(misleadingTelemetry.synchronizationJobCounts.dead_letter, 1);
    assert.equal(misleadingTelemetry.runtimeAuthority, "legacy");
    assert.equal(misleadingTelemetry.migration.state, "legacy_only");
  } finally { await cleanup(s); }
});
