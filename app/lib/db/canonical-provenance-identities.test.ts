import assert from "node:assert/strict";
import test from "node:test";

import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
import type { PersistedWebsiteKnowledge } from "@/app/lib/ai-engine/knowledge/websiteKnowledge";
import { manualCompatibilityMetadata, manualEvidenceIdentity, manualSnapshotPayload, sourceIdentity, sourceSnapshotIdentity, websiteCompatibilityMetadata, websiteEvidenceIdentity, websiteSnapshotPayload } from "./canonical-provenance-identities";

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
