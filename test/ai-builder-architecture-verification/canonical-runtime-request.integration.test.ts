import assert from "node:assert/strict";
import { cleanup, databaseTest, fixture, insertProjectionAndParity } from "./database-fixture";

type StubResponse = { status: number; body: { ok: boolean; error: { code: string; message: string } } };

databaseTest("real chat requests reject the complete invalid canonical authority matrix and emit mismatch telemetry after rollback", async () => {
  const s = await fixture();
  try {
    const { POST } = await import("@/app/api/ai-builder/chat/route");
    const request = () => new Request("http://localhost/api/ai-builder/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "planning", knowledge: { sessionId: s.projectId } }) });
    const invoke = async () => await POST(request()) as unknown as StubResponse;
    const reset = async () => {
      await s.client.query("DELETE FROM ai_builder_operational_events WHERE project_id=$1", [s.projectId]);
      await s.client.query("DELETE FROM ai_builder_assistant_projection_parity_reports WHERE project_id=$1", [s.projectId]);
      await s.client.query("DELETE FROM ai_builder_assistant_projections WHERE project_id=$1", [s.projectId]);
      await s.client.query("UPDATE ai_builder_projects SET runtime_authority='canonical',migration_state='canonical_runtime' WHERE id=$1", [s.projectId]);
      await insertProjectionAndParity(s.client, s.projectId);
    };
    const reject = async (expected: RegExp) => {
      const before = Number((await s.client.query("SELECT count(*)::int count FROM ai_builder_operational_events WHERE project_id=$1 AND event_type='runtime_authority_mismatch'", [s.projectId])).rows[0].count);
      const response = await invoke();
      assert.equal(response.status, 503);
      assert.match(response.body.error.code, expected);
      assert.equal(response.body.error.message, "The assistant runtime is temporarily unavailable. Please try again later.");
      const after = Number((await s.client.query("SELECT count(*)::int count FROM ai_builder_operational_events WHERE project_id=$1 AND event_type='runtime_authority_mismatch'", [s.projectId])).rows[0].count);
      assert.equal(after, before + 1);
    };

    await reset(); await s.client.query("DELETE FROM ai_builder_assistant_projections WHERE project_id=$1", [s.projectId]); await reject(/unavailable_missing/);
    for (const state of ["invalidated", "rebuilding"] as const) { await reset(); await s.client.query("UPDATE ai_builder_assistant_projections SET invalidation_state=$2 WHERE project_id=$1", [s.projectId, state]); await reject(new RegExp(`unavailable_${state}`)); }
    await reset(); await s.client.query("UPDATE ai_builder_assistant_projections SET projection_version=99,projection_json=jsonb_set(projection_json,'{projectionVersion}','99'::jsonb) WHERE project_id=$1", [s.projectId]); await reject(/validation_failure/);
    await reset(); await s.client.query("UPDATE ai_builder_assistant_projections SET schema_version=99,projection_json=jsonb_set(projection_json,'{schemaVersion}','99'::jsonb) WHERE project_id=$1", [s.projectId]); await reject(/validation_failure/);
    await reset(); await s.client.query("UPDATE ai_builder_assistant_projections SET projection_json=jsonb_set(projection_json,'{services}','{}'::jsonb) WHERE project_id=$1", [s.projectId]); await reject(/validation_failure/);
    await reset(); await s.client.query("UPDATE ai_builder_assistant_projections SET projection_json=jsonb_set(projection_json,'{businessMemoryFingerprint}',to_jsonb('business_memory_aaaaaaaaaaaaaaaaaaaaaaaa'::text)) WHERE project_id=$1", [s.projectId]); await reject(/validation_failure/);
    await reset(); await s.client.query("UPDATE ai_builder_assistant_projection_parity_reports SET status='MAJOR_DIFFERENCE' WHERE project_id=$1", [s.projectId]); await reject(/parity_status_unacceptable/);
    await reset(); await s.client.query("UPDATE ai_builder_assistant_projection_parity_reports SET compared_at=(SELECT generated_at-INTERVAL '1 second' FROM ai_builder_assistant_projections WHERE project_id=$1) WHERE project_id=$1", [s.projectId]); await reject(/parity_evidence_stale/);
    await reset(); await s.client.query("UPDATE ai_builder_assistant_projection_parity_reports SET artifact_fingerprint='business_memory_bbbbbbbbbbbbbbbbbbbbbbbb' WHERE project_id=$1", [s.projectId]); await reject(/parity_evidence_fingerprint_mismatch/);
    await reset(); await s.client.query("UPDATE ai_builder_assistant_projections SET projection_json=jsonb_set(projection_json,'{services,0,reviewState}',to_jsonb('archived'::text)) WHERE project_id=$1", [s.projectId]); await reject(/validation_failure/);
    await reset(); await s.client.query("UPDATE ai_builder_projects SET runtime_authority='legacy' WHERE id=$1", [s.projectId]); const migration = await invoke(); assert.equal(migration.status, 503); assert.equal(migration.body.error.code, "assistant_projection_migration_required");
    await reset(); await s.client.query("UPDATE ai_builder_assistant_projection_parity_reports SET active_runtime_authority='legacy' WHERE project_id=$1", [s.projectId]); await reject(/parity_authority_mismatch/);

    const events = await s.client.query("SELECT count(*)::int count FROM ai_builder_operational_events WHERE project_id=$1 AND event_type='runtime_authority_mismatch'", [s.projectId]);
    assert.equal(Number(events.rows[0].count), 1);
  } finally { await cleanup(s); }
});
