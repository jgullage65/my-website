import assert from "node:assert/strict";
import test from "node:test";
import type { ReviewCommand } from "./review-commands";
import {
  type AuthoritativeReviewProject,
  validateReviewCommand,
} from "./review-command-validator";

const actor = { clerkUserId: "user-1", displayName: null, email: null };

function command(overrides: Record<string, unknown> = {}): ReviewCommand {
  return {
    commandId: "command-1", projectId: "project-1", itemId: "faq-1", itemKind: "faq",
    actor, clientRevision: 7, expectedCurrentState: "proposed", kind: "approve",
    requestedTransition: { from: "proposed", to: "approved" }, createdAt: "2026-07-22T00:00:00.000Z",
    ...overrides,
  } as ReviewCommand;
}

function project(overrides: Partial<AuthoritativeReviewProject> = {}): AuthoritativeReviewProject {
  return {
    id: "project-1", ownerClerkUserId: "user-1", status: "review_required", archivedAt: null,
    governanceRevision: 7,
    items: [{ id: "faq-1", projectId: "project-1", kind: "faq", reviewState: "proposed" }],
    ...overrides,
  };
}

function codes(result: ReturnType<typeof validateReviewCommand>) {
  return result.valid ? [] : result.issues.map((issue) => issue.code);
}

test("validates every canonical allowed review transition", () => {
  const cases: Array<[ReviewCommand, AuthoritativeReviewProject]> = [
    [command(), project()],
    [command({ kind: "correct", itemKind: "faq", correction: { itemKind: "faq", question: "Question?", answer: "Answer." }, requestedTransition: { from: "proposed", to: "corrected" } }), project()],
    [command({ kind: "reject", requestedTransition: { from: "proposed", to: "archived" } }), project()],
    [command({ kind: "archive", expectedCurrentState: "approved", requestedTransition: { from: "approved", to: "archived" } }), project({ items: [{ id: "faq-1", projectId: "project-1", kind: "faq", reviewState: "approved" }] })],
    [command({ kind: "archive", expectedCurrentState: "corrected", requestedTransition: { from: "corrected", to: "archived" } }), project({ items: [{ id: "faq-1", projectId: "project-1", kind: "faq", reviewState: "corrected" }] })],
    [command({ kind: "restore", expectedCurrentState: "archived", requestedTransition: { from: "archived", to: "approved" } }), project({ items: [{ id: "faq-1", projectId: "project-1", kind: "faq", reviewState: "archived" }] })],
  ];
  for (const [reviewCommand, authoritativeProject] of cases) assert.equal(validateReviewCommand(reviewCommand, authoritativeProject).valid, true);
});

test("rejects ownership, unavailable projects, stale revisions, and duplicate IDs", () => {
  assert.deepEqual(codes(validateReviewCommand(command({ actor: { ...actor, clerkUserId: "other" } }), project())), ["project_not_owned"]);
  assert.deepEqual(codes(validateReviewCommand(command(), project({ status: "expired" }))), ["project_not_reviewable"]);
  assert.deepEqual(codes(validateReviewCommand(command(), project({ archivedAt: "2026-07-21T00:00:00.000Z" }))), ["project_archived"]);
  assert.deepEqual(codes(validateReviewCommand(command({ clientRevision: 6 }), project())), ["stale_revision"]);
  assert.deepEqual(codes(validateReviewCommand(command(), project({ hasProcessedCommandId: (id) => id === "command-1" }))), ["duplicate_command"]);
});

test("uses authoritative item state and ownership rather than command claims", () => {
  assert.deepEqual(codes(validateReviewCommand(command({ expectedCurrentState: "approved" }), project())), ["stale_review_state", "invalid_transition"]);
  assert.deepEqual(codes(validateReviewCommand(command({ itemKind: "context_entry" }), project())), ["item_kind_mismatch"]);
  assert.deepEqual(codes(validateReviewCommand(command(), project({ items: [] }))), ["item_not_found"]);
  assert.deepEqual(codes(validateReviewCommand(command(), project({ items: [{ id: "faq-1", projectId: "project-2", kind: "faq", reviewState: "proposed" }] }))), ["item_project_mismatch"]);
});

test("rejects transitions outside the state machine and malformed corrections", () => {
  assert.deepEqual(codes(validateReviewCommand(command({ kind: "approve", requestedTransition: { from: "proposed", to: "archived" } }), project())), ["invalid_transition"]);
  assert.deepEqual(codes(validateReviewCommand(command({ kind: "correct", itemKind: "faq", correction: { itemKind: "faq", question: " ", answer: "Answer" }, requestedTransition: { from: "proposed", to: "corrected" } }), project())), ["invalid_correction"]);
  const contextProject = project({ items: [{ id: "faq-1", projectId: "project-1", kind: "context_entry", reviewState: "proposed" }] });
  assert.deepEqual(codes(validateReviewCommand(command({ kind: "correct", itemKind: "context_entry", correction: { itemKind: "context_entry", content: "Content", category: "not-a-category" }, requestedTransition: { from: "proposed", to: "corrected" } }), contextProject)), ["invalid_correction"]);
});
