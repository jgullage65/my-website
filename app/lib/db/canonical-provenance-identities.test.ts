import assert from "node:assert/strict";
import test from "node:test";

import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
import type { PersistedWebsiteKnowledge } from "@/app/lib/ai-engine/knowledge/websiteKnowledge";
import { candidateClaimIdentity, claimReviewIdentity, manualCompatibilityMetadata, manualEvidenceIdentity, manualSnapshotPayload, sourceIdentity, sourceSnapshotIdentity, trustedKnowledgeIdentity, websiteCompatibilityMetadata, websiteEvidenceIdentity, websiteSnapshotPayload } from "./canonical-provenance-identities";
import { interpretLegacyReviewDeltas } from "./canonical-provenance-shadow";

const block = (content = "We provide planning workshops.") => ({ id: "legacy-block-1", label: "Services", content, createdAt: "2026-07-20T10:00:00.000Z", updatedAt: "2026-07-20T10:00:00.000Z" });
const blocks = (content?: string) => [block(content)] as AiBuilderSession["intakeBlocks"];
const website = (): PersistedWebsiteKnowledge => ({ schema_version: 1, document_version: 1, current_crawl_attempt_id: "legacy-crawl-1", imported_at: "2026-07-20T10:00:00.000Z", requested_url: "https://example.test", resolved_url: "https://example.test", pages: [], warnings: [], knowledge: { facts: [{ category: "service", title: "Planning", value: "Planning workshops are available.", confidence: "high", evidence: [{ url: "https://example.test/services", excerpt: "Planning workshops are available." }] }], coverage: { businessIdentity: 0, offers: 0, customers: 0, pricing: 0, policies: 0, processes: 0, faq: 0, contact: 0, overall: 0 }, unresolvedQuestions: [] } });

test("source, snapshot, and evidence identities are deterministic for a repeated intake", () => {
  const payload = manualSnapshotPayload(blocks());
  const snapshot = sourceSnapshotIdentity("legacy-project-1", "manual", payload);
  assert.equal(sourceIdentity("legacy-project-1", "manual"), sourceIdentity("legacy-project-1", "manual"));
  assert.equal(snapshot, sourceSnapshotIdentity("legacy-project-1", "manual", manualSnapshotPayload(blocks())));
  assert.equal(manualEvidenceIdentity(snapshot, block()), manualEvidenceIdentity(snapshot, block()));
});

test("changed observations receive new immutable snapshot and evidence identities", () => {
  const firstSnapshot = sourceSnapshotIdentity("legacy-project-1", "manual", manualSnapshotPayload(blocks()));
  const secondSnapshot = sourceSnapshotIdentity("legacy-project-1", "manual", manualSnapshotPayload(blocks("Planning workshops and audits are available.")));
  assert.notEqual(firstSnapshot, secondSnapshot);
  assert.notEqual(manualEvidenceIdentity(firstSnapshot, block()), manualEvidenceIdentity(secondSnapshot, block("Planning workshops and audits are available.")));
  assert.equal(sourceIdentity("legacy-project-1", "manual"), sourceIdentity("legacy-project-1", "manual"));
});

test("website identities are order-independent and preserve crawl-compatible inputs", () => {
  const first = website();
  const reordered = { ...first, pages: first.pages.slice().reverse(), knowledge: { ...first.knowledge, facts: first.knowledge.facts.slice().reverse() } };
  const snapshot = sourceSnapshotIdentity("legacy-project-1", "website", websiteSnapshotPayload(first));
  assert.equal(snapshot, sourceSnapshotIdentity("legacy-project-1", "website", websiteSnapshotPayload(reordered)));
  assert.equal(websiteEvidenceIdentity(snapshot, first.knowledge.facts[0], first.knowledge.facts[0].evidence[0]), websiteEvidenceIdentity(snapshot, reordered.knowledge.facts[0], reordered.knowledge.facts[0].evidence[0]));
});

test("compatibility metadata explicitly retains legacy references", () => {
  assert.deepEqual(manualCompatibilityMetadata("legacy-project-1", "legacy-block-1"), { legacyProjectId: "legacy-project-1", legacyIntakeBlockId: "legacy-block-1" });
  assert.deepEqual(websiteCompatibilityMetadata("legacy-project-1", website()), { legacyProjectId: "legacy-project-1", legacyCrawlAttemptId: "legacy-crawl-1", legacyWebsiteKnowledgeDocumentVersion: 1 });
});


test("candidate claim identities are deterministic and tied to their provenance snapshot", () => {
  const snapshot = sourceSnapshotIdentity("legacy-project-1", "manual", manualSnapshotPayload(blocks()));
  assert.equal(
    candidateClaimIdentity(snapshot, "context_entry", "legacy-entry-1", "Planning workshops are available."),
    candidateClaimIdentity(snapshot, "context_entry", "legacy-entry-1", "Planning workshops are available."),
  );
  assert.notEqual(
    candidateClaimIdentity(snapshot, "context_entry", "legacy-entry-1", "Planning workshops are available."),
    candidateClaimIdentity(snapshot, "context_entry", "legacy-entry-1", "Planning workshops and audits are available."),
  );
});

test("review and trusted knowledge identities are deterministic and retain the governed claim", () => {
  const candidate = "canonical:candidate_claim:manual:abc";
  const reviewedAt = "2026-07-20T12:00:00.000Z";
  const review = claimReviewIdentity("legacy-project-1", "context_entry", "legacy-entry-1", candidate, "correction", reviewedAt);
  assert.equal(review, claimReviewIdentity("legacy-project-1", "context_entry", "legacy-entry-1", candidate, "correction", reviewedAt));
  assert.notEqual(review, claimReviewIdentity("legacy-project-1", "context_entry", "legacy-entry-1", candidate, "approve", reviewedAt));
  assert.equal(
    trustedKnowledgeIdentity("legacy-project-1", "context_entry", "legacy-entry-1", review),
    trustedKnowledgeIdentity("legacy-project-1", "context_entry", "legacy-entry-1", review),
  );
});

test("review delta interpreter emits only real context and FAQ governance transitions", () => {
  const entry = (kind: "context_entry" | "faq", status: string, content: string) => ({ id: `${kind}-1`, kind, status, content, updatedAt: "2026-07-20T12:00:00.000Z" });
  assert.deepEqual(interpretLegacyReviewDeltas([entry("context_entry", "approved", "A")], [entry("context_entry", "approved", "A")]), []);
  assert.equal(interpretLegacyReviewDeltas([entry("context_entry", "proposed", "A")], [entry("context_entry", "approved", "A")])[0]?.action, "approve");
  assert.equal(interpretLegacyReviewDeltas([entry("faq", "proposed", "A")], [entry("faq", "archived", "A")])[0]?.action, "reject");
  assert.equal(interpretLegacyReviewDeltas([entry("context_entry", "approved", "A")], [entry("context_entry", "archived", "A")])[0]?.action, "archive");
  assert.equal(interpretLegacyReviewDeltas([entry("faq", "archived", "A")], [entry("faq", "approved", "A")])[0]?.action, "restore");
  assert.equal(interpretLegacyReviewDeltas([entry("context_entry", "corrected", "A")], [entry("context_entry", "corrected", "B")])[0]?.action, "correction");
});

test("website evidence identities resolve the same records after evidence reordering", () => {
  const first = website();
  const fact = first.knowledge.facts[0];
  const additionalEvidence = { url: "https://example.test/about", excerpt: "Our planning team leads every workshop." };
  const withTwoEvidenceItems = { ...first, knowledge: { ...first.knowledge, facts: [{ ...fact, evidence: [fact.evidence[0], additionalEvidence] }] } };
  const reordered = { ...withTwoEvidenceItems, knowledge: { ...withTwoEvidenceItems.knowledge, facts: [{ ...withTwoEvidenceItems.knowledge.facts[0], evidence: [additionalEvidence, fact.evidence[0]] }] } };
  const snapshot = sourceSnapshotIdentity("legacy-project-1", "website", websiteSnapshotPayload(withTwoEvidenceItems));
  const storedEvidence = new Map(withTwoEvidenceItems.knowledge.facts[0].evidence.map((evidence) => [websiteEvidenceIdentity(snapshot, withTwoEvidenceItems.knowledge.facts[0], evidence), `storage:${evidence.url}`]));

  assert.equal(snapshot, sourceSnapshotIdentity("legacy-project-1", "website", websiteSnapshotPayload(reordered)));
  assert.deepEqual(
    reordered.knowledge.facts[0].evidence.map((evidence) => storedEvidence.get(websiteEvidenceIdentity(snapshot, reordered.knowledge.facts[0], evidence))).sort(),
    ["storage:https://example.test/about", "storage:https://example.test/services"],
  );
});
