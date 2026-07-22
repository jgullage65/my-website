import assert from "node:assert/strict";
import test from "node:test";
import { reviewProjectStatus } from "./review-read-model";

test("readiness depends on approved Business Knowledge, not the aggregated approved counter", () => {
  const cases = [
    { name: "only FAQ approved", businessKnowledge: 0, faq: 1, approved: 1, expected: "review_required" },
    { name: "only Business Knowledge approved", businessKnowledge: 1, faq: 0, approved: 1, expected: "ready" },
    { name: "both approved", businessKnowledge: 1, faq: 1, approved: 2, expected: "ready" },
    { name: "neither approved", businessKnowledge: 0, faq: 0, approved: 0, expected: "review_required" },
  ] as const;

  for (const item of cases) {
    assert.equal(reviewProjectStatus(item.businessKnowledge), item.expected, item.name);
    assert.equal(item.businessKnowledge + item.faq, item.approved, `${item.name} aggregated counter`);
  }
});
