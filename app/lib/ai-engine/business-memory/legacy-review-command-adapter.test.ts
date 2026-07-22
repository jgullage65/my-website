import assert from "node:assert/strict";
import test from "node:test";
import { commandsFromLegacyReviewSession, UnsupportedLegacyReviewMutationError } from "./legacy-review-command-adapter";
import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";

const session = (status: "proposed" | "approved" | "corrected" | "archived", revision = 4): AiBuilderSession => ({
  id: "project-1", status: "ready", governanceRevision: revision, createdAt: "2026-07-22T00:00:00.000Z", updatedAt: "2026-07-22T00:00:00.000Z", expiresAt: null,
  assistantConfiguration: { name: "Test", purpose: "Test", tone: "professional", responseStyle: "concise", primaryAudience: null, escalationInstructions: [] }, contextCounts: { total: 1, approved: 0, proposed: 1, archived: 0, byCategory: {} }, intakeBlocks: [], faqEntries: [], conflicts: [], missingInformation: [], buildProgress: [],
  contextEntries: [{ id: "context-1", sessionId: "project-1", category: "service", title: "Service", content: "Original", confidence: "high", confidenceScore: .9, status, source: { sourceType: "manual_intake", intakeBlockId: "intake-1", excerpt: "Original" }, metadata: { generated: true, userEdited: false, conflictingEntryIds: [], tags: [], provenanceClassification: "ai_generated" }, createdAt: "2026-07-22T00:00:00.000Z", updatedAt: "2026-07-22T00:00:00.000Z" }],
});
const actor = { clerkUserId: "user-1", displayName: null, email: null };

const sessionWithFaq = (): AiBuilderSession => {
  const value = session("proposed");
  value.contextEntries = [];
  value.faqEntries = [{
    id: "faq-1", sessionId: value.id, question: "What do you offer?", answer: "Design.",
    confidence: "high", confidenceScore: .9, sourceEntryIds: ["context-1"], status: "proposed",
    metadata: { generated: true, userEdited: false, conflictingEntryIds: [], tags: [] },
    createdAt: "2026-07-22T00:00:00.000Z", updatedAt: "2026-07-22T00:00:00.000Z",
  }];
  return value;
};

test("legacy compatibility adapter only constructs deterministic review commands", () => {
  const before = session("proposed");
  const after = session("approved");
  const first = commandsFromLegacyReviewSession(before, after, actor);
  const retry = commandsFromLegacyReviewSession(before, after, actor);
  assert.equal(first.length, 1);
  assert.equal(first[0]?.kind, "approve");
  assert.equal(first[0]?.commandId, retry[0]?.commandId);
  assert.equal(before.contextEntries[0]?.status, "proposed");
  assert.equal(after.contextEntries[0]?.status, "approved");
});

test("legacy compatibility adapter emits every canonical state-machine transition", () => {
  const cases: Array<[Parameters<typeof session>[0], Parameters<typeof session>[0], string]> = [
    ["proposed", "approved", "approve"],
    ["proposed", "corrected", "correct"],
    ["proposed", "archived", "reject"],
    ["approved", "archived", "archive"],
    ["corrected", "archived", "archive"],
    ["archived", "approved", "restore"],
    ["approved", "proposed", "unapprove"],
  ];

  for (const [previousState, nextState, kind] of cases) {
    const commands = commandsFromLegacyReviewSession(session(previousState), session(nextState), actor);
    assert.equal(commands.length, 1, `${previousState} → ${nextState}`);
    assert.equal(commands[0]?.kind, kind);
  }
});

test("legacy compatibility adapter rejects unsupported mutations instead of silently succeeding", () => {
  for (const [previousState, nextState, edited] of [
    ["approved", "corrected", false],
    ["archived", "corrected", false],
    ["corrected", "corrected", true],
  ] as const) {
    const before = session(previousState);
    const after = session(nextState);
    if (edited) after.contextEntries[0]!.content = "Edited without a canonical transition";
    assert.throws(() => commandsFromLegacyReviewSession(before, after, actor), UnsupportedLegacyReviewMutationError, `${previousState} → ${nextState}`);
  }
});

test("legacy compatibility adapter rejects inserted and omitted review items", () => {
  const before = session("proposed");
  const inserted = session("proposed");
  inserted.contextEntries.push({ ...inserted.contextEntries[0]!, id: "context-2" });
  assert.throws(() => commandsFromLegacyReviewSession(before, inserted, actor), UnsupportedLegacyReviewMutationError);
  const omitted = session("proposed");
  omitted.contextEntries = [];
  assert.throws(() => commandsFromLegacyReviewSession(before, omitted, actor), UnsupportedLegacyReviewMutationError);
});

test("legacy compatibility adapter rejects every non-command Context Entry field mutation", () => {
  const mutations: Array<[string, (entry: AiBuilderSession["contextEntries"][number]) => void]> = [
    ["sessionId", (entry) => { entry.sessionId = "different-project"; }],
    ["confidence", (entry) => { entry.confidence = "low"; }],
    ["confidenceScore", (entry) => { entry.confidenceScore = .1; }],
    ["source", (entry) => { entry.source = { ...entry.source, excerpt: "Changed" }; }],
    ["metadata", (entry) => { entry.metadata = { ...entry.metadata, tags: ["changed"] }; }],
    ["createdAt", (entry) => { entry.createdAt = "2026-07-23T00:00:00.000Z"; }],
    ["updatedAt", (entry) => { entry.updatedAt = "2026-07-23T00:00:00.000Z"; }],
    ["unknown persisted field", (entry) => { Object.assign(entry, { persistedExtension: true }); }],
  ];
  for (const [field, mutate] of mutations) {
    const before = session("proposed");
    const after = structuredClone(before);
    mutate(after.contextEntries[0]!);
    assert.throws(() => commandsFromLegacyReviewSession(before, after, actor), UnsupportedLegacyReviewMutationError, field);
  }
});

test("legacy compatibility adapter rejects every non-command FAQ field mutation", () => {
  const mutations: Array<[string, (entry: AiBuilderSession["faqEntries"][number]) => void]> = [
    ["sessionId", (entry) => { entry.sessionId = "different-project"; }],
    ["confidence", (entry) => { entry.confidence = "low"; }],
    ["confidenceScore", (entry) => { entry.confidenceScore = .1; }],
    ["sourceEntryIds", (entry) => { entry.sourceEntryIds = ["different-source"]; }],
    ["metadata", (entry) => { entry.metadata = { ...entry.metadata, tags: ["changed"] }; }],
    ["createdAt", (entry) => { entry.createdAt = "2026-07-23T00:00:00.000Z"; }],
    ["updatedAt", (entry) => { entry.updatedAt = "2026-07-23T00:00:00.000Z"; }],
    ["unknown persisted field", (entry) => { Object.assign(entry, { persistedExtension: true }); }],
  ];
  for (const [field, mutate] of mutations) {
    const before = sessionWithFaq();
    const after = structuredClone(before);
    mutate(after.faqEntries[0]!);
    assert.throws(() => commandsFromLegacyReviewSession(before, after, actor), UnsupportedLegacyReviewMutationError, field);
  }
});
