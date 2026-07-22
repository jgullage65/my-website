import assert from "node:assert/strict";
import test from "node:test";
import { parseReviewCommandRequest, ReviewCommandRequestParseError } from "./review-command-request-parser";

const base = { commandId: "command-1", projectId: "project-1", itemId: "item-1", itemKind: "faq", clientRevision: 0, expectedCurrentState: "proposed" };
const parses = (value: unknown) => parseReviewCommandRequest(value);
const invalid = (value: unknown) => assert.throws(() => parses(value), ReviewCommandRequestParseError);

test("strict parser accepts every command's legitimate request shape", () => {
  for (const kind of ["approve", "reject", "archive", "restore", "unapprove"] as const) assert.equal(parses({ ...base, kind }).kind, kind);
  assert.deepEqual(parses({ ...base, kind: "correct", correction: { itemKind: "faq", question: "Question?", answer: "Answer." } }), { ...base, kind: "correct", correction: { itemKind: "faq", question: "Question?", answer: "Answer." } });
  assert.equal(parses({ ...base, itemKind: "context_entry", kind: "correct", correction: { itemKind: "context_entry", content: "Correct content" } }).kind, "correct");
});

test("strict parser rejects malformed, server-owned, and cross-command fields", () => {
  for (const payload of [
    { ...base, kind: "unknown" }, { ...base, itemKind: "unknown", kind: "approve" }, { ...base, commandId: "" , kind: "approve"},
    { ...base, commandId: "bad id", kind: "approve" }, { ...base, kind: "approve", clientRevision: -1 }, { ...base, kind: "approve", clientRevision: 1.2 }, { ...base, kind: "approve", clientRevision: "1" },
    { ...base, kind: "approve", expectedCurrentState: "wrong" }, { ...base, itemId: null, kind: "approve" }, { ...base, kind: "approve", extra: true },
    { ...base, kind: "approve", correction: { itemKind: "faq", question: "Q", answer: "A" } }, { ...base, kind: "archive", correction: {} },
    { ...base, kind: "correct" }, { ...base, kind: "correct", correction: {} }, { ...base, kind: "correct", correction: { itemKind: "faq", question: " ", answer: "A" } },
    { ...base, kind: "correct", correction: { itemKind: "faq", question: "Q", answer: "A", source: "client" } }, { ...base, kind: "approve", actor: { clerkUserId: "attacker" } },
    { ...base, kind: "approve", createdAt: "2020-01-01" }, { ...base, kind: "approve", resultingState: "approved" },
  ]) invalid(payload);
});
