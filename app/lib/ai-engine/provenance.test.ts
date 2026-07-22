import assert from "node:assert/strict";
import test from "node:test";
import { classifyContextStructuralProvenance, correctedProvenanceMetadata } from "./provenance";

test("a repeated correction derives predecessor from immutable source structure", () => {
  const source = { sourceType: "website" as const, intakeBlockId: "website_knowledge", sourceUrl: "https://example.test", excerpt: "Source text" };
  const predecessor = classifyContextStructuralProvenance({ source, metadata: { generated: false, userEdited: true, provenanceClassification: "user_corrected" } });
  const corrected = correctedProvenanceMetadata({ provenanceClassification: "user_corrected", predecessorProvenanceClassification: "user_corrected", originalProvenanceClassification: "user_corrected" }, predecessor);
  assert.equal(corrected.provenanceClassification, "user_corrected");
  assert.equal(corrected.predecessorProvenanceClassification, "website");
  assert.equal(corrected.originalProvenanceClassification, "website");
});

test("a valid first original provenance survives subsequent corrections", () => {
  const corrected = correctedProvenanceMetadata({ provenanceClassification: "user_corrected", predecessorProvenanceClassification: "manual", originalProvenanceClassification: "manual" }, "website");
  assert.equal(corrected.predecessorProvenanceClassification, "website");
  assert.equal(corrected.originalProvenanceClassification, "manual");
});
