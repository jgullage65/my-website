import assert from "node:assert/strict";
import test from "node:test";
import { buildKnowledgePackFromTrustedRows, TrustedKnowledgeProjectionError, type TrustedKnowledgeProjectionRow } from "./trustedKnowledgeProjection";

function expectProjectionError(fn: () => unknown, expectedCode: "trusted_knowledge_projection_invalid_source" | "invalid_trusted_projection_source_state"): void {
  assert.throws(fn, (error) => error instanceof TrustedKnowledgeProjectionError && error.code === expectedCode);
}
function context(overrides: Partial<TrustedKnowledgeProjectionRow> & { content?: Record<string, unknown> } = {}): TrustedKnowledgeProjectionRow {
  return { source_item_id: "context-1", source_item_kind: "context_entry", review_state: "approved", governance_revision: 0, source_entry_ids: [], provenance: {}, content: { category: "service", title: "Title", content: "Content", confidence: "high", confidenceScore: .9, source: { intakeBlockId: "intake", excerpt: "Example", sourceType: "manual_intake" }, metadata: {} }, ...overrides };
}
function faq(overrides: Partial<TrustedKnowledgeProjectionRow> & { content?: Record<string, unknown> } = {}): TrustedKnowledgeProjectionRow {
  return { source_item_id: "faq-1", source_item_kind: "faq", review_state: "approved", governance_revision: 0, source_entry_ids: ["context-1"], provenance: {}, content: { question: "Question?", answer: "Answer", confidence: "high", confidenceScore: .9 }, ...overrides };
}
function pack(row: TrustedKnowledgeProjectionRow) { return buildKnowledgePackFromTrustedRows({ projectId: "project-1", assistantConfiguration: { name: "A", purpose: "P", tone: "T", primaryAudience: null }, rows: [row] }); }

test("runtime Trusted Knowledge retains review revision, FAQ support, and correction provenance", () => {
  const knowledge = pack(faq({ review_state: "corrected", governance_revision: 9, provenance: { provenanceClassification: "user_corrected", predecessorProvenanceClassification: "manual", originalProvenanceClassification: "manual", correction: { actor: { clerkUserId: "user-1", displayName: "Ada", email: "ada@example.test" }, correctedAt: "2026-07-22T00:00:00.000Z" } } }));
  assert.deepEqual(knowledge.faq[0]?.sourceEntryIds, ["context-1"]); assert.equal(knowledge.faq[0]?.reviewState, "corrected"); assert.equal(knowledge.faq[0]?.governanceRevision, 9);
  assert.deepEqual(knowledge.faq[0]?.provenance, { classification: "user_corrected", predecessorClassification: "manual", originalClassification: "manual", correctedByClerkUserId: "user-1", correctedByDisplayName: "Ada", correctedByEmail: "ada@example.test", correctedAt: "2026-07-22T00:00:00.000Z" });
});
const contextContent = (field: string, value: unknown) => context({ content: { ...(context().content as Record<string, unknown>), [field]: value } });
const faqContent = (field: string, value: unknown) => faq({ content: { ...(faq().content as Record<string, unknown>), [field]: value } });
test("rejects invalid source kind", () => expectProjectionError(() => pack(context({ source_item_kind: "unknown" })), "trusted_knowledge_projection_invalid_source"));
test("rejects inactive review state", () => expectProjectionError(() => pack(context({ review_state: "archived" })), "trusted_knowledge_projection_invalid_source"));
test("rejects invalid review state", () => expectProjectionError(() => pack(context({ review_state: "unknown" })), "invalid_trusted_projection_source_state"));
test("rejects invalid context category", () => expectProjectionError(() => pack(contextContent("category", "not_a_category")), "trusted_knowledge_projection_invalid_source"));
test("rejects empty context title", () => expectProjectionError(() => pack(contextContent("title", "")), "trusted_knowledge_projection_invalid_source"));
test("rejects empty context content", () => expectProjectionError(() => pack(contextContent("content", "   ")), "trusted_knowledge_projection_invalid_source"));
test("rejects invalid context confidence", () => expectProjectionError(() => pack(contextContent("confidence", "certain")), "trusted_knowledge_projection_invalid_source"));
test("rejects confidence score below zero", () => expectProjectionError(() => pack(contextContent("confidenceScore", -.1)), "trusted_knowledge_projection_invalid_source"));
test("rejects confidence score above one", () => expectProjectionError(() => pack(contextContent("confidenceScore", 1.1)), "trusted_knowledge_projection_invalid_source"));
test("rejects malformed context source", () => expectProjectionError(() => pack(contextContent("source", null)), "trusted_knowledge_projection_invalid_source"));
test("rejects website context without URL", () => expectProjectionError(() => pack(contextContent("source", { intakeBlockId: "website_knowledge", excerpt: "Example", sourceType: "website", sourceUrl: null })), "trusted_knowledge_projection_invalid_source"));
test("rejects invalid FAQ question", () => expectProjectionError(() => pack(faqContent("question", "")), "trusted_knowledge_projection_invalid_source"));
test("rejects invalid FAQ answer", () => expectProjectionError(() => pack(faqContent("answer", " ")), "trusted_knowledge_projection_invalid_source"));
test("rejects FAQ support IDs with an empty string", () => expectProjectionError(() => pack(faq({ source_entry_ids: ["context-1", ""] })), "trusted_knowledge_projection_invalid_source"));
test("rejects duplicate FAQ support IDs", () => expectProjectionError(() => pack(faq({ source_entry_ids: ["context-1", "context-1"] })), "trusted_knowledge_projection_invalid_source"));
test("rejects invalid governance revision", () => expectProjectionError(() => pack(context({ governance_revision: -1 })), "trusted_knowledge_projection_invalid_source"));
test("rejects invalid projection content object", () => expectProjectionError(() => pack(context({ content: null as unknown as Record<string, unknown> })), "trusted_knowledge_projection_invalid_source"));
test("unknown provenance classifications map to null", () => { const knowledge = pack(context({ provenance: { provenanceClassification: "random", predecessorProvenanceClassification: "manual_intake", originalProvenanceClassification: "" } })); assert.equal(knowledge.facts[0]?.provenance.classification, null); assert.equal(knowledge.facts[0]?.provenance.predecessorClassification, null); assert.equal(knowledge.facts[0]?.provenance.originalClassification, null); });
