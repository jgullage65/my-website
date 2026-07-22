import assert from "node:assert/strict";
import test from "node:test";
import { NeonBusinessMemoryReconciliationStore } from "./neon-reconciliation-store";

class FakeClient { calls: Array<{ sql: string; params: unknown[] }> = []; async query(sql: string, params: unknown[] = []) { this.calls.push({ sql, params }); return { rows: sql.includes("FOR UPDATE") ? [{ id: "memory", revision: 4 }] : [], rowCount: 1 }; } }
const time = "2026-01-01T00:00:00.000Z";
const payloads: Array<[string, string, Record<string, unknown>]> = [
  ["resolvedEntities", "insertResolvedEntity", { id:"entity",projectId:"project",type:"company",active:true }],
  ["identityKeys", "insertIdentityKey", { id:"key",projectId:"project",resolvedEntityId:"entity",sourceEntityId:"source",type:"email",normalizedValue:"a@test.dev",displayValue:"A@test.dev",strength:"strong",authoritative:true,sourceIds:["source"],active:true }],
  ["aliases", "insertAlias", { id:"alias",projectId:"project",resolvedEntityId:"entity",displayValue:"Acme",normalizedValue:"acme",sourceIds:["source"],accepted:true }],
  ["redirects", "insertRedirect", { fromResolvedEntityId:"old",toResolvedEntityId:"entity" }],
  ["sourceEntityOwnership", "assignSourceEntityOwner", { id:"owner",sourceEntityId:"source",resolvedEntityId:"entity" }],
  ["assertionOwnership", "assignAssertionOwner", { id:"assertion-owner",assertionId:"assertion",resolvedEntityId:"entity" }],
  ["relationships", "rewireRelationship", { id:"relationship",relationshipType:"supports",fromResolvedEntityId:"entity",toResolvedEntityId:"entity-2",fromAssertionId:"assertion",toAssertionId:"assertion-2",sourceEntryIds:["entry"],provenance:["canonical"],reviewState:"approved",createdAt:time,updatedAt:time }],
  ["conflicts", "insertConflict", { id:"conflict",resolvedEntityId:"entity",topicKey:"topic",normalizedValues:["one","two"],detectionRule:"rule",suggestedQuestion:"which?",resolved:false,resolution:null,active:true,materialInputHash:"hash" }],
  ["conflictAssertionLinks", "replaceConflictAssertionLinks", { id:"conflict-link",conflictId:"conflict",assertionId:"assertion" }],
  ["sources", "repairSourceLink", { id:"source-record",canonicalSourceId:"canonical-source",origin:"website",sourceEntryId:"entry",intakeBlockId:null,url:"https://example.test",label:"Example",capturedAt:time,crawlAttemptId:null }],
  ["evidence", "repairEvidenceLink", { id:"evidence",sourceId:"source-record",canonicalEvidenceId:"canonical-evidence",excerpt:"proof",url:null,capturedAt:time }],
  ["assertionSourceLinks", "repairSourceLink", { id:"assertion-source",assertionId:"assertion",sourceId:"source-record" }],
  ["assertionEvidenceLinks", "repairEvidenceLink", { id:"assertion-evidence",assertionId:"assertion",evidenceId:"evidence" }],
];

test("reconciliation persistence writes complete repair payloads and synchronizes once", async () => {
  const client = new FakeClient(), store = new NeonBusinessMemoryReconciliationStore(client as never, "project");
  await store.transaction(async tx => { await tx.loadForUpdate(); for (const [model, type, payload] of payloads) await tx.apply({ model, type: type as never, id: String(payload.id ?? payload.fromResolvedEntityId), payload }); await tx.synchronize(); });
  const sql = client.calls.map(call => call.sql).join("\n");
  for (const table of ["resolved_entities","identity_keys","entity_aliases","entity_redirects","entity_resolution","assertions SET entity_id","relationships","conflicts","conflict_assertions","sources","evidence","assertion_sources","assertion_evidence"]) assert.match(sql, new RegExp(table));
  assert.match(sql, /DO UPDATE SET/); assert.doesNotMatch(sql, /INSERT INTO [^(]+ \(id,memory_id\) VALUES/);
  assert.equal(client.calls.filter(call => call.sql.startsWith("UPDATE ai_builder_business_memory SET revision=revision\+1")).length, 1);
});

test("malformed payloads fail before persistence", async () => {
  const client = new FakeClient(), store = new NeonBusinessMemoryReconciliationStore(client as never, "project");
  await store.transaction(async tx => { await tx.loadForUpdate(); const before=client.calls.length; await assert.rejects(tx.apply({ model:"identityKeys",type:"insertIdentityKey",id:"key",payload:{ id:"key" } }), /invalid_repair_payload/); assert.equal(client.calls.length,before); });
});
