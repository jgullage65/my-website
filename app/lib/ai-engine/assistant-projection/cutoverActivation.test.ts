import assert from "node:assert/strict";
import test from "node:test";
import { activateAssistantProjectionCanonicalRuntime, setAssistantProjectionCutoverPoolForTests, setAssistantProjectionCutoverTelemetryForTests } from "./cutoverActivation";

const projection = { projectId: "project-1", businessMemoryFingerprint: "business_memory_abcdef0123456789abcdef01", projectionVersion: 1, schemaVersion: 1, identity: { status: "missing", canonicalEntityId: null, businessName: null, aliases: [], mergedEntityIds: [], redirectedEntityIds: [], contactEntityIds: [] }, assistant: { name: "Ava", purpose: "Help", tone: "warm", responseStyle: "brief", primaryAudience: null, escalationInstructions: [] }, services: [], products: [], pricing: [], policies: [], faqs: [], restrictions: [], relationships: [], sources: [], evidence: [], missingInformation: [] };
function harness(status = "MATCH", fingerprint = projection.businessMemoryFingerprint) {
  const calls: string[] = []; let released = 0;
  const client = { release: () => { released++; }, query: async (sql: string) => { calls.push(sql); if (sql.includes("FROM ai_builder_projects") && sql.includes("FOR UPDATE")) return { rows: [{ id: "project-1" }] }; if (sql.includes("FROM ai_builder_assistant_projections")) return { rows: [{ project_id: "project-1", business_memory_fingerprint: projection.businessMemoryFingerprint, projection_version: 1, schema_version: 1, generated_at: "2026-01-01T00:00:00.000Z", invalidation_state: "valid", projection_json: projection, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }] }; if (sql.includes("parity_reports")) return { rows: [{ status, assistant_projection_version: 1, assistant_projection_schema_version: 1, artifact_fingerprint: fingerprint, compared_at: "2026-01-01T00:00:00.000Z" }] }; return { rows: [] }; } };
  return { calls, client, released: () => released };
}

test("offline cutover atomically activates only an exact MATCH and releases its transaction client", async () => {
  const h = harness(); setAssistantProjectionCutoverPoolForTests({ connect: async () => h.client } as never);
  try { await activateAssistantProjectionCanonicalRuntime("project-1"); assert.ok(h.calls.some((sql) => sql.includes("SET runtime_authority='canonical'"))); assert.ok(h.calls.includes("COMMIT")); assert.equal(h.released(), 1); }
  finally { setAssistantProjectionCutoverPoolForTests(null); }
});

test("failed offline validation rolls back without changing authority and releases client", async () => {
  const h = harness("MINOR_DIFFERENCE"); setAssistantProjectionCutoverPoolForTests({ connect: async () => h.client } as never);
  try { await assert.rejects(activateAssistantProjectionCanonicalRuntime("project-1"), /parity_status_unacceptable/); assert.ok(h.calls.includes("ROLLBACK")); assert.ok(!h.calls.some((sql) => sql.includes("SET runtime_authority='canonical'"))); assert.equal(h.released(), 1); }
  finally { setAssistantProjectionCutoverPoolForTests(null); }
});

test("committed cutover is not rejected when best-effort success telemetry fails",async()=>{
  const h=harness(),events:string[]=[];setAssistantProjectionCutoverPoolForTests({connect:async()=>h.client} as never);setAssistantProjectionCutoverTelemetryForTests(async input=>{events.push(input.eventType);throw new Error("telemetry failed");});
  try{await activateAssistantProjectionCanonicalRuntime("project-1");assert.ok(h.calls.includes("COMMIT"));assert.ok(!h.calls.includes("ROLLBACK"));assert.deepEqual(events,["runtime_cutover_succeeded"]);}
  finally{setAssistantProjectionCutoverPoolForTests(null);setAssistantProjectionCutoverTelemetryForTests(null);}
});
