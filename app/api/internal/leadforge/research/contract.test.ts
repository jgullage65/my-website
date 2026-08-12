import assert from "node:assert/strict";
import test from "node:test";
import { normalizeExternalReference, toLeadForgeEvent } from "./contract.ts";

test("normalizes an optional external reference", () => {
  assert.equal(normalizeExternalReference(" lead-123 "), "lead-123");
  assert.equal(normalizeExternalReference(undefined), undefined);
  assert.throws(() => normalizeExternalReference("x".repeat(201)));
});

test("maps the production intelligence result without discarding structured knowledge or source records", () => {
  const knowledge = { facts: [{ category: "contact_information", value: "+1 555 0100" }], coverage: {}, unresolvedQuestions: [] };
  const sourceDocuments = [{ id: "doc-1", sourceType: "html", status: "retained" }];
  const sourceBlocks = [{ id: "block-1", sourceDocumentId: "doc-1", normalizedText: "Call +1 555 0100" }];
  const result = toLeadForgeEvent({
    type: "result",
    import: {
      businessName: "Acme",
      industry: "Services",
      requestedUrl: "https://acme.test",
      resolvedUrl: "https://www.acme.test",
      productsServices: "Consulting",
      idealCustomers: "Teams",
      additionalKnowledge: "Call us",
    },
    knowledge,
    sourceDocuments,
    sourceBlocks,
    diagnostics: { pagesRetained: 2 },
    usage: { model: "test" },
  }, "lead-123");
  assert.equal(result.success, true);
  assert.equal(result.externalReference, "lead-123");
  assert.deepEqual((result.businessKnowledgePack as { knowledge: unknown }).knowledge, knowledge);
  assert.deepEqual((result.sources as { documents: unknown }).documents, sourceDocuments);
  assert.deepEqual((result.sources as { blocks: unknown }).blocks, sourceBlocks);
});
