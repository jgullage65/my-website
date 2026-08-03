import assert from "node:assert/strict";
import test from "node:test";
import { WEBSITE_KNOWLEDGE_CATEGORIES } from "../../knowledge/websiteKnowledge";
import {
  CATEGORY_PRIMARY_BUCKET,
  KNOWLEDGE_BUCKETS,
  assertExhaustiveCategoryOwnership,
} from "./buckets";

test("assigns every website knowledge category to exactly one primary bucket", () => {
  assert.doesNotThrow(() => assertExhaustiveCategoryOwnership());
  assert.deepEqual(
    Object.keys(CATEGORY_PRIMARY_BUCKET).sort(),
    [...WEBSITE_KNOWLEDGE_CATEGORIES].sort(),
  );
  assert.equal(new Set(Object.values(CATEGORY_PRIMARY_BUCKET)).size, 8);
  assert.deepEqual(
    [...new Set(Object.values(CATEGORY_PRIMARY_BUCKET))].sort(),
    [...KNOWLEDGE_BUCKETS].sort(),
  );
});
