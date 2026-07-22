import assert from "node:assert/strict";
import test from "node:test";
import { projectionFresh } from "./trustedKnowledgeFreshness";
const check = (governanceRevision: number, trustedKnowledgeRevision: number, activeCanonicalCount: number, activeProjectionCount: number, mixedActiveRevisions = false) => projectionFresh({ governanceRevision, trustedKnowledgeRevision, activeCanonicalCount, activeProjectionCount, mixedActiveRevisions });
test("projection freshness accepts revision zero and requires exact active counts", () => {
  assert.equal(check(0, 0, 0, 0), true); assert.equal(check(0, 0, 2, 2), true); assert.equal(check(0, 0, 2, 0), false); assert.equal(check(4, 3, 1, 1), false); assert.equal(check(0, 0, 1, 2), false); assert.equal(check(0, 0, 1, 1, true), false);
});
