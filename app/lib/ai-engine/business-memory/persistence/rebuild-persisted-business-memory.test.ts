import assert from "node:assert/strict";
import test from "node:test";
import { extractBusinessMemoryProvenance, materialFingerprint, materialState, stableAssertionId, stableEntityId, rebuildPersistedBusinessMemoryFromTrustedKnowledge } from "./rebuild-persisted-business-memory";

const project = "project-1";
const trusted = (overrides: Record<string, unknown> = {}) => ({ trusted_id: "trusted-1", legacy_kind: "context_entry", legacy_entry_id: "entry-1", lifecycle: "approved", trusted_created_at: "2026-01-01T00:00:00.000Z", claim_id: "claim-1", claim_type: "context_entry", category: "service", title: "Planning", normalized_content: "Planning workshops", confidence: "high", confidence_score: .9, claim_metadata: { sourceType: "manual_intake" }, review_action: "approve", ...overrides });
const evidence = (overrides: Record<string, unknown> = {}) => ({ candidate_claim_id: "claim-1", claim_metadata: { sourceType: "manual_intake" }, evidence_id: "evidence-1", content: "Planning workshops", evidence_url: null, captured_at: "2026-01-01T00:00:00.000Z", evidence_metadata: { legacyIntakeBlockId: "block-1", label: "Services" }, canonical_source_id: "source-1", source_kind: "manual", source_url: null, source_metadata: {}, snapshot_metadata: {}, snapshot_payload: [{ id: "block-1", label: "Services", content: "Planning workshops", unrelated: "ignored" }], ...overrides });
class FakeClient {
  calls: Array<{ sql: string; params: unknown[] }> = [];
  private existing?: Record<string, unknown>;
  private failAt?: number;
  constructor(existing?: Record<string, unknown>, failAt?: number) { this.existing = existing; this.failAt = failAt; }
  async query(sql: string, params: unknown[] = []) { this.calls.push({ sql, params }); if (this.failAt === this.calls.length) throw new Error("simulated persistence failure"); if (sql.includes("FROM ai_builder_canonical_trusted_knowledge")) return { rows: [trusted()] }; if (sql.includes("FROM ai_builder_canonical_candidate_claim_evidence")) return { rows: [evidence()] }; if (sql.includes("FROM ai_builder_business_memory WHERE")) return { rows: this.existing ? [this.existing] : [] }; return { rows: [] }; }
}

test("stable identity uses logical item boundaries and corrections retain IDs", () => {
  const first = trusted(), same = trusted({ trusted_id: "trusted-2", claim_id: "claim-2", normalized_content: "Corrected" }), other = trusted({ legacy_entry_id: "entry-2" });
  assert.notEqual(stableEntityId(project, first), stableEntityId(project, other)); assert.notEqual(stableAssertionId(project, first), stableAssertionId(project, other));
  assert.equal(stableEntityId(project, first), stableEntityId(project, same)); assert.equal(stableAssertionId(project, first), stableAssertionId(project, same));
});
test("authoritative provenance maps supported origins and never guesses manual intake", () => {
  assert.equal(extractBusinessMemoryProvenance(evidence({ source_kind: "website", source_url: "https://example.test", claim_metadata: {} })).origin, "website");
  assert.equal(extractBusinessMemoryProvenance(evidence()).origin, "manual_intake");
  assert.equal(extractBusinessMemoryProvenance(evidence({ claim_metadata: { provenanceClassification: "user_corrected" } })).origin, "user_edit");
  assert.equal(extractBusinessMemoryProvenance(evidence({ claim_metadata: { provenanceClassification: "ai_generated" } })).origin, "generated_qa");
  assert.throws(() => extractBusinessMemoryProvenance(evidence({ source_kind: "unknown", claim_metadata: {} })), /business_memory_unknown_required_origin/);
});
test("snapshot payload provenance uses canonical manual payload and ignores unrelated values", () => {
  const p = extractBusinessMemoryProvenance(evidence({ evidence_metadata: { legacyIntakeBlockId: "block-1" } })); assert.equal(p.intakeBlockId, "block-1"); assert.equal(p.label, "Services"); assert.deepEqual(Object.keys(p).sort(), ["capturedAt", "crawlAttemptId", "intakeBlockId", "label", "origin", "sourceEntryId", "url"]);
});
test("material fingerprint normalizes order and includes persisted changes", () => {
  const rows = [trusted(), trusted({ legacy_entry_id: "entry-2", claim_id: "claim-2" })], ev = new Map([["claim-1", [evidence()]], ["claim-2", [evidence({ candidate_claim_id: "claim-2", evidence_id: "evidence-2", evidence_metadata: { legacyIntakeBlockId: "block-1", ignored: 1 } })]]]);
  const a = materialState(project, rows, ev), b = materialState(project, rows.slice().reverse(), new Map(Array.from(ev).reverse())); assert.equal(materialFingerprint(a), materialFingerprint(b));
  assert.notEqual(materialFingerprint(a), materialFingerprint(materialState(project, [trusted({ normalized_content: "Changed" }), rows[1]], ev)));
  const provenanceChanged = new Map<string, any[]>([["claim-1", [evidence({ source_url: "https://changed.test" })]], ["claim-2", ev.get("claim-2")!]]);
  assert.notEqual(materialFingerprint(a), materialFingerprint(materialState(project, rows, provenanceChanged)));
  const faq = trusted({ claim_type: "faq", legacy_kind: "faq", legacy_entry_id: "faq-1", claim_metadata: { sourceType: "manual_intake", legacySourceEntryIds: ["entry-1"] } });
  const differentRelationship = trusted({ claim_type: "faq", legacy_kind: "faq", legacy_entry_id: "faq-1", claim_metadata: { sourceType: "manual_intake", legacySourceEntryIds: ["entry-2"] } });
  assert.notEqual(materialFingerprint(materialState(project, [faq], new Map([["claim-1", [evidence()]]]))), materialFingerprint(materialState(project, [differentRelationship], new Map([["claim-1", [evidence()]]]))));
});
test("semantic no-op synchronizes trusted knowledge revision without changing business revision", async () => {
  const state = materialState(project, [trusted()], new Map([["claim-1", [evidence()]]])), fake = new FakeClient({ revision: 1, trusted_knowledge_revision: 1, state_fingerprint: materialFingerprint(state) }); await rebuildPersistedBusinessMemoryFromTrustedKnowledge(fake as any, project, 2);
  assert.ok(fake.calls.some((call) => call.sql.startsWith("UPDATE ai_builder_business_memory SET trusted_knowledge_revision"))); assert.equal(fake.calls.filter((call) => call.sql.includes("INSERT INTO ai_builder_business_memory (")).length, 0);
  assert.ok(!fake.calls.some((call) => call.sql.includes("ai_builder_assistant_projections")));
});
test("empty projection cleanup uses delete-all branches and preserves durable tables", async () => {
  const fake = new FakeClient(); (fake as any).query = async function(sql: string, params: unknown[] = []) { this.calls.push({ sql, params }); if (sql.includes("canonical_trusted_knowledge")) return { rows: [] }; if (sql.includes("candidate_claim_evidence")) return { rows: [] }; if (sql.includes("business_memory WHERE")) return { rows: [] }; return { rows: [] }; }; await rebuildPersistedBusinessMemoryFromTrustedKnowledge(fake as any, project, 1);
  const deletes = fake.calls.filter((call) => call.sql.startsWith("DELETE")).map((call) => call.sql); assert.ok(deletes.some((sql) => sql === "DELETE FROM ai_builder_business_memory_assertions WHERE memory_id=$1")); assert.ok(deletes.some((sql) => sql === "DELETE FROM ai_builder_business_memory_entities WHERE memory_id=$1")); assert.ok(deletes.some((sql) => sql === "DELETE FROM ai_builder_business_memory_evidence WHERE memory_id=$1")); assert.ok(deletes.some((sql) => sql === "DELETE FROM ai_builder_business_memory_sources WHERE memory_id=$1")); assert.ok(!fake.calls.some((call) => /business_memory_(conflicts|missing_information)/.test(call.sql))); assert.ok(fake.calls.some((call) => call.sql.includes("ai_builder_assistant_projections") && call.params[0] === project));
});
test("malformed provenance and persistence failures stop before later projection writes", async () => {
  assert.throws(() => extractBusinessMemoryProvenance(evidence({ captured_at: "bad" })), /captured_at/);
  const fake = new FakeClient(undefined, 4); await assert.rejects(rebuildPersistedBusinessMemoryFromTrustedKnowledge(fake as any, project, 1), /simulated/); assert.equal(fake.calls.length, 4);
});
