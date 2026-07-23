import assert from "node:assert/strict";
import test from "node:test";
import type { AssistantProjection } from "./contracts";
import { compareAssistantProjectionParity } from "./parity";

const projection: AssistantProjection = {
  projectId: "project", businessMemoryFingerprint: "business_memory_abcdef0123456789abcdef01", projectionVersion: 1, schemaVersion: 1,
  identity: { status: "missing", canonicalEntityId: null, businessName: null, aliases: [], mergedEntityIds: [], redirectedEntityIds: [], contactEntityIds: [] },
  assistant: { name: "Ava", purpose: "Help", tone: "warm", responseStyle: "brief", primaryAudience: null, escalationInstructions: [] },
  services: [{ id: "canonical-service", entityId: "service", assertionId: "canonical-service", entityType: "service", title: "Planning", value: "Canonical planning", aliases: [], tags: [], confidence: { level: "high", score: .9 }, authority: "confirmed", reviewState: "corrected", evidenceIds: [], sourceIds: ["website"] }, { id: "extra", entityId: "extra", assertionId: "extra", entityType: "service", title: "Extra", value: "Extra knowledge", aliases: [], tags: [], confidence: { level: "high", score: .9 }, authority: "confirmed", reviewState: "approved", evidenceIds: [], sourceIds: [] }],
  pricing: [], policies: [], restrictions: [], relationships: [], evidence: [], missingInformation: [],
  faqs: [{ id: "faq", entityId: "faq", assertionId: "faq", entityType: "faq", title: "What?", value: "Canonical answer", question: "What?", answer: "Canonical answer", aliases: [], tags: [], confidence: { level: "high", score: .9 }, authority: "confirmed", reviewState: "approved", evidenceIds: [], sourceIds: ["website"] }, { id: "extra-faq", entityId: "extra-faq", assertionId: "extra-faq", entityType: "faq", title: "Extra?", value: "Extra", question: "Extra?", answer: "Extra", aliases: [], tags: [], confidence: { level: "high", score: .9 }, authority: "confirmed", reviewState: "approved", evidenceIds: [], sourceIds: [] }],
  sources: [{ id: "website", origin: "website", url: null, label: null, capturedAt: "2026-01-01T00:00:00.000Z", crawlAttemptId: null }],
};

const fact = (title: string, content: string, state: "approved" | "corrected" = "approved") => ({ id: title, category: "service" as const, title, content, confidence: "high" as const, confidenceScore: .9, sourceEntryId: "website", sourceExcerpt: "", sourceType: "website", sourceUrl: null, tags: [], provenance: { classification: "manual" as const, predecessorClassification: null, originalClassification: null, correctedByClerkUserId: null, correctedByDisplayName: null, correctedByEmail: null, correctedAt: null }, reviewState: state, governanceRevision: 1 });

test("reports deterministic knowledge, FAQ, provenance, review, archive, and formatting differences", () => {
  const legacy = { sessionId: "project", assistantName: "Ava", assistantPurpose: "Help", assistantTone: "warm", primaryAudience: null, builtAt: "", version: 1, behaviorRules: [], prohibitedClaims: [], facts: [fact("Planning", "Legacy planning"), fact("Missing", "Missing knowledge"), { ...fact("Archived", "Archived knowledge"), reviewState: "archived" as unknown as "approved" }], faq: [{ id: "faq", question: "What?", answer: "Legacy answer", confidence: "high" as const, confidenceScore: .9, sourceEntryIds: ["website"], provenance: { ...fact("x", "x").provenance }, reviewState: "approved" as const, governanceRevision: 1 }, { id: "format", question: "Format?", answer: "hello\nworld", confidence: "high" as const, confidenceScore: .9, sourceEntryIds: [], provenance: { ...fact("x", "x").provenance }, reviewState: "approved" as const, governanceRevision: 1 }] };
  projection.faqs.push({ ...projection.faqs[0], id: "format", title: "Format?", question: "Format?", value: "hello world", answer: "hello world", sourceIds: [] });
  const report = compareAssistantProjectionParity({ projectId: "project", legacy, canonicalProjection: projection, comparedAt: "2026-01-01T00:00:00.000Z" });
  assert.equal(report.status, "MAJOR_DIFFERENCE");
  assert.equal(report.categories.missingKnowledge.length, 3); assert.equal(report.categories.extraKnowledge.length, 1);
  assert.equal(report.categories.reviewStateDifferences.length, 1); assert.ok(report.categories.provenanceDifferences.length >= 1);
  assert.equal(report.categories.faq.extra.length, 1); assert.equal(report.categories.faq.contentMismatches.length, 1);
  assert.equal(report.categories.archivedLeakage.length, 1); assert.equal(report.categories.formattingDifferences.length, 1);
});
