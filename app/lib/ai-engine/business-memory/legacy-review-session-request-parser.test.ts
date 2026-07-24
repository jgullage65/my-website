import assert from "node:assert/strict";
import test from "node:test";
import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
import { LEGACY_REVIEW_SESSION_LIMITS, LegacyReviewSessionRequestParseError, parseLegacyReviewSessionRequest } from "./legacy-review-session-request-parser";
import { commandsFromLegacyReviewSession, UnsupportedLegacyReviewMutationError } from "./legacy-review-command-adapter";

const at = "2026-07-22T00:00:00.000Z";
function session(): AiBuilderSession {
  return {
    id: "project-1", status: "ready", governanceRevision: 4, createdAt: at, updatedAt: at, expiresAt: null,
    intakeBlocks: [{ id: "intake-1", label: "Business", content: "We design.", createdAt: at, updatedAt: at }],
    assistantConfiguration: { name: "Helper", purpose: "Help", tone: "professional", responseStyle: "concise", primaryAudience: null, escalationInstructions: [] },
    contextEntries: [{ id: "context-1", sessionId: "project-1", category: "service", title: "Design", content: "We design.", confidence: "high", confidenceScore: .9, status: "proposed", source: { intakeBlockId: "intake-1", excerpt: "We design.", sourceType: "manual_intake", sourceUrl: null }, metadata: { generated: false, userEdited: false, conflictingEntryIds: [], tags: [], provenanceClassification: "manual" }, createdAt: at, updatedAt: at }],
    faqEntries: [{ id: "faq-1", sessionId: "project-1", question: "What do you do?", answer: "Design.", confidence: "medium", confidenceScore: .7, sourceEntryIds: ["context-1"], status: "proposed", metadata: { generated: true, userEdited: false, conflictingEntryIds: [], tags: [], upstreamSourceEntryIds: ["context-1"], mixedSourceProvenance: false }, createdAt: at, updatedAt: at }],
    conflicts: [{ id: "conflict-1", topic: "Hours", firstStatement: "Nine", secondStatement: "Ten", sourceExcerpts: ["Nine", "Ten"], suggestedQuestion: "When?", resolved: false, resolution: null }],
    missingInformation: [{ id: "missing-1", topic: "Price", reason: "Unknown", suggestedQuestion: "How much?", resolved: false }],
    contextCounts: { total: 1, approved: 0, proposed: 1, archived: 0, byCategory: { service: 1 } },
    buildProgress: [{ stage: "complete", message: "Done", completed: true, count: 1, createdAt: at }],
  };
}
const parse = (value: unknown) => parseLegacyReviewSessionRequest(value, "project-1");
const rejects = (value: unknown) => assert.throws(() => parse(value), (error: unknown) => error instanceof LegacyReviewSessionRequestParseError && error.code === "invalid_legacy_review_session");
const changed = (mutate: (value: Record<string, any>) => void) => { const value = { session: structuredClone(session()) } as Record<string, any>; mutate(value); return value; };

test("accepts unchanged and every supported legacy review snapshot", () => {
  assert.deepEqual(parse({ session: session() }).session, session());
  const actor = { clerkUserId: "user-1", displayName: null, email: null };
  for (const [beforeStatus, afterStatus, kind] of [["proposed", "approved", "approve"], ["proposed", "corrected", "correct"], ["approved", "archived", "archive"], ["archived", "approved", "restore"]] as const) {
    const before = session(); before.contextEntries[0]!.status = beforeStatus;
    const submitted = structuredClone(before); submitted.contextEntries[0]!.status = afterStatus;
    if (kind === "correct") { submitted.contextEntries[0]!.title = "Corrected"; submitted.contextEntries[0]!.content = "Corrected design."; }
    const validated = parse({ session: submitted }).session;
    assert.equal(commandsFromLegacyReviewSession(before, validated, actor)[0]?.kind, kind);
  }
});

test("rejects invalid roots, sessions, identifiers, revisions, and review collections", () => {
  for (const value of [null, [], "body", 3, {}, { session: null }, { session: session(), businessName: "No" }]) rejects(value);
  for (const value of [
    changed((v) => { v.session.id = 3; }), changed((v) => { v.session.id = "other"; }), changed((v) => { v.session.governanceRevision = -1; }), changed((v) => { v.session.governanceRevision = 1.2; }),
    changed((v) => { delete v.session.contextEntries; }), changed((v) => { delete v.session.faqEntries; }), changed((v) => { v.session.contextEntries = [null]; }), changed((v) => { v.session.contextEntries = [3]; }), changed((v) => { v.session.faqEntries = [null]; }), changed((v) => { v.session.faqEntries = ["faq"]; }),
    changed((v) => { v.session.contextEntries.push(structuredClone(v.session.contextEntries[0])); }), changed((v) => { v.session.faqEntries.push(structuredClone(v.session.faqEntries[0])); }),
    changed((v) => { v.session.contextEntries[0].sessionId = "other"; }), changed((v) => { v.session.faqEntries[0].sessionId = "other"; }),
  ]) rejects(value);
});

test("rejects malformed canonical review values, objects, text, and timestamps", () => {
  for (const value of [
    changed((v) => { v.session.status = "unknown"; }), changed((v) => { v.session.contextEntries[0].status = "unknown"; }), changed((v) => { v.session.faqEntries[0].status = "unknown"; }), changed((v) => { v.session.contextEntries[0].category = "unknown"; }),
    changed((v) => { v.session.contextEntries[0].confidence = "certain"; }), changed((v) => { v.session.faqEntries[0].confidence = "certain"; }), changed((v) => { v.session.contextEntries[0].source.sourceType = "crawl"; }),
    changed((v) => { v.session.contextEntries[0].title = 2; }), changed((v) => { v.session.contextEntries[0].content = null; }), changed((v) => { v.session.faqEntries[0].question = []; }), changed((v) => { v.session.faqEntries[0].answer = false; }),
    changed((v) => { v.session.contextEntries[0].metadata = []; }), changed((v) => { v.session.contextEntries[0].metadata.generated = "yes"; }), changed((v) => { v.session.faqEntries[0].metadata.tags = [2]; }), changed((v) => { v.session.contextEntries[0].source = null; }), changed((v) => { v.session.contextEntries[0].source.sourceUrl = 2; }),
    changed((v) => { v.session.createdAt = "not-a-date"; }), changed((v) => { v.session.contextEntries[0].updatedAt = "not-a-date"; }), changed((v) => { v.session.faqEntries[0].createdAt = 2; }),
    changed((v) => { v.session.contextEntries[0].confidenceScore = Infinity; }), changed((v) => { v.session.faqEntries[0].confidenceScore = "0.7"; }),
  ]) rejects(value);
});

test("validates every remaining session collection and exact nested contracts", () => {
  for (const value of [
    changed((v) => { v.session.contextCounts = []; }), changed((v) => { delete v.session.contextCounts.total; }), changed((v) => { v.session.contextCounts.byCategory.service = -1; }), changed((v) => { v.session.contextCounts.byCategory.unknown = 1; }),
    changed((v) => { v.session.assistantConfiguration = null; }), changed((v) => { v.session.assistantConfiguration.primaryAudience = 3; }), changed((v) => { v.session.assistantConfiguration.escalationInstructions = [false]; }),
    changed((v) => { v.session.intakeBlocks[0].createdAt = "bad"; }), changed((v) => { v.session.conflicts[0].resolved = "no"; }), changed((v) => { v.session.missingInformation[0].reason = null; }), changed((v) => { v.session.buildProgress[0].stage = "unknown"; }), changed((v) => { v.session.buildProgress[0].count = -1; }),
    changed((v) => { v.session.extra = true; }), changed((v) => { v.session.contextEntries[0].extra = true; }), changed((v) => { v.session.faqEntries[0].extra = true; }),
  ]) rejects(value);
});

test("enforces centralized string, item, and nested-array transport limits", () => {
  rejects(changed((v) => { v.session.contextEntries[0].content = "x".repeat(LEGACY_REVIEW_SESSION_LIMITS.longTextLength + 1); }));
  rejects(changed((v) => { v.session.contextEntries = new Array(LEGACY_REVIEW_SESSION_LIMITS.collectionItems + 1).fill(null); }));
  rejects(changed((v) => { v.session.faqEntries[0].sourceEntryIds = new Array(LEGACY_REVIEW_SESSION_LIMITS.nestedStringItems + 1).fill("context-1"); }));
});

test("structurally valid unsupported mutations still reach the legacy adapter", () => {
  const before = session(); before.contextEntries[0]!.status = "approved";
  const submitted = structuredClone(before); submitted.contextEntries[0]!.content = "Unsupported edit";
  const validated = parse({ session: submitted }).session;
  assert.throws(() => commandsFromLegacyReviewSession(before, validated, { clerkUserId: "user-1", displayName: null, email: null }), UnsupportedLegacyReviewMutationError);
});
