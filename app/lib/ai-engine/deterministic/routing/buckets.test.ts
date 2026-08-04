import assert from "node:assert/strict";
import test from "node:test";
import { WEBSITE_KNOWLEDGE_CATEGORIES } from "../../knowledge/websiteKnowledge";
import {
  CATEGORY_PRIMARY_BUCKET,
  KNOWLEDGE_BUCKETS,
  assertExhaustiveCategoryOwnership,
  primaryBucketForCategory,
} from "./buckets";

test("assigns every website knowledge category to exactly one primary bucket", () => {
  assert.doesNotThrow(() => assertExhaustiveCategoryOwnership());
  assert.deepEqual(
    Object.keys(CATEGORY_PRIMARY_BUCKET).sort(),
    [...WEBSITE_KNOWLEDGE_CATEGORIES].sort(),
  );
  assert.equal(
    Object.keys(CATEGORY_PRIMARY_BUCKET).length,
    WEBSITE_KNOWLEDGE_CATEGORIES.length,
  );
  assert.equal(new Set(Object.values(CATEGORY_PRIMARY_BUCKET)).size, 8);
  assert.deepEqual(
    [...new Set(Object.values(CATEGORY_PRIMARY_BUCKET))].sort(),
    [...KNOWLEDGE_BUCKETS].sort(),
  );
});

test("returns one canonical owner for every supported category", () => {
  for (const category of WEBSITE_KNOWLEDGE_CATEGORIES) {
    const bucket = primaryBucketForCategory(category);
    assert.ok(KNOWLEDGE_BUCKETS.includes(bucket));
    assert.equal(CATEGORY_PRIMARY_BUCKET[category], bucket);
  }
});

test("rejects an unknown runtime category instead of silently routing it", () => {
  assert.throws(
    () => primaryBucketForCategory("future_unknown_category" as never),
    /Unknown knowledge category/,
  );
});

test("keeps canonical bucket order unique and stable", () => {
  assert.equal(new Set(KNOWLEDGE_BUCKETS).size, KNOWLEDGE_BUCKETS.length);
  assert.deepEqual(KNOWLEDGE_BUCKETS, [
    "business_identity",
    "offers_capabilities",
    "customers_market",
    "commercial_rules",
    "trust_qualification",
    "operations_experience",
    "ecosystem",
    "proof_positioning",
  ]);
});
