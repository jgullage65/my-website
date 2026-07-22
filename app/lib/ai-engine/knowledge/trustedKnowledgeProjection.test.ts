import assert from "node:assert/strict";
import test from "node:test";
import { buildKnowledgePackFromTrustedRows } from "./trustedKnowledgeProjection";

test("runtime Trusted Knowledge retains review revision, FAQ support, and correction provenance", () => {
  const knowledge = buildKnowledgePackFromTrustedRows({ projectId: "project-1", assistantConfiguration: { name: "A", purpose: "P", tone: "T", primaryAudience: null }, rows: [
    { source_item_id: "faq-1", source_item_kind: "faq", review_state: "corrected", governance_revision: 9, source_entry_ids: ["context-1"], content: { question: "Corrected?", answer: "Yes", confidence: "high", confidenceScore: 0.9 }, provenance: { provenanceClassification: "user_corrected", predecessorProvenanceClassification: "manual_intake", originalProvenanceClassification: "manual_intake", correction: { actor: { clerkUserId: "user-1", displayName: "Ada", email: "ada@example.test" }, correctedAt: "2026-07-22T00:00:00.000Z" } } },
  ] });
  assert.deepEqual(knowledge.faq[0]?.sourceEntryIds, ["context-1"]);
  assert.equal(knowledge.faq[0]?.reviewState, "corrected"); assert.equal(knowledge.faq[0]?.governanceRevision, 9);
  assert.deepEqual(knowledge.faq[0]?.provenance, { classification: "user_corrected", predecessorClassification: "manual_intake", originalClassification: "manual_intake", correctedByClerkUserId: "user-1", correctedByDisplayName: "Ada", correctedByEmail: "ada@example.test", correctedAt: "2026-07-22T00:00:00.000Z" });
});
