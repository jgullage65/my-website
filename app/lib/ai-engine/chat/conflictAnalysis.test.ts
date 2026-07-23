import assert from "node:assert/strict";
import test from "node:test";
import { analyzeCanonicalConflicts } from "./conflictAnalysis";
import { retrieveStructuredCanonicalKnowledge } from "./structuredCanonicalRetrieval";
import { buildStructuredSystemPrompt } from "./buildStructuredSystemPrompt";
import type { AssistantProjection } from "../assistant-projection/contracts";

const claim = (id: string, value: string, overrides: Record<string, unknown> = {}) => ({ id, entityId: "price", assertionId: `assertion-${id}`, entityType: "pricing_concept" as const, title: "Website pricing", value, aliases: [], tags: [], confidence: { level: "high" as const, score: .9 }, authority: "confirmed" as const, reviewState: "approved" as const, evidenceIds: ["evidence"], sourceIds: ["source"], predecessorAssertionId: null, ...overrides });
const projection = (pricing = [claim("one", "$100")]): AssistantProjection => ({ projectId: "p", businessMemoryFingerprint: "business_memory_abcdef0123456789abcdef01", projectionVersion: 3, schemaVersion: 3, identity: { status: "missing", canonicalEntityId: null, businessName: null, aliases: [], mergedEntityIds: [], redirectedEntityIds: [], contactEntityIds: [] }, assistant: { name: "Ava", purpose: "Help", tone: "warm", responseStyle: "brief", primaryAudience: null, escalationInstructions: [] }, services: [], products: [], pricing: pricing as AssistantProjection["pricing"], policies: [], faqs: [], restrictions: [], relationships: [], sources: [{ id: "source", origin: "manual_intake", url: null, label: "Reviewed intake", capturedAt: "2026-01-01T00:00:00Z", crawlAttemptId: null }], evidence: [{ id: "evidence", canonicalSourceId: "source", sourceUrl: null, excerpt: "Price", capturedAt: "2026-01-01T00:00:00Z" }], missingInformation: [] });

test("corrected assertions suppress predecessors normally but retain them for history", () => {
 const previous = claim("old", "$100"); const corrected = claim("new", "$120", { authority: "corrected", reviewState: "corrected", predecessorAssertionId: "assertion-old" }); const p = projection([previous, corrected]);
 const normal = analyzeCanonicalConflicts(p, retrieveStructuredCanonicalKnowledge(p, "website price"), "website price");
 assert.deepEqual(normal.answerItems.map(item => item.assertionId), ["assertion-new"]); assert.deepEqual(normal.predecessorsSuppressed, ["assertion-old"]);
 const historical = analyzeCanonicalConflicts(p, retrieveStructuredCanonicalKnowledge(p, "previous website price"), "what was the previous website price");
 assert.ok(historical.answerItems.some(item => item.assertionId === "assertion-old"));
});

test("authority resolves lower-authority assertions, while equally authoritative contradictions remain unresolved", () => {
 const winner = claim("confirmed", "$100"); const loser = claim("observed", "$200", { authority: "observed" }); const p = projection([winner, loser]);
 const resolved = analyzeCanonicalConflicts(p, retrieveStructuredCanonicalKnowledge(p, "website price"), "website price");
 assert.equal(resolved.authoritativeResolutions.length, 1); assert.deepEqual(resolved.answerItems.map(item => item.assertionId), ["assertion-confirmed"]);
 const unresolvedProjection = projection([claim("a", "$100"), claim("b", "$200")]); const unresolved = analyzeCanonicalConflicts(unresolvedProjection, retrieveStructuredCanonicalKnowledge(unresolvedProjection, "website price"), "website price");
 assert.equal(unresolved.unresolvedConflictGroups.length, 1); assert.equal(unresolved.answerItems.length, 0);
});

test("identical facts do not conflict, groups are topic-scoped, and citations retain canonical lineage", () => {
 const a = claim("a", "$100", { predecessorAssertionId: "assertion-before" }); const same = claim("b", "$100"); const policy = { ...claim("policy", "No refunds"), entityId: "policy", assertionId: "assertion-policy", entityType: "policy" as const, title: "Refund policy" }; const p = projection([a, same]); p.policies = [policy];
 const retrieved = retrieveStructuredCanonicalKnowledge(p, "website price refund policy"); const result = analyzeCanonicalConflicts(p, retrieved, "website price refund policy");
 assert.equal(result.unresolvedConflictGroups.length, 0); assert.ok(result.conflictGroups.every(group => group.category === "pricing"));
 const chain = result.citationChains[0]; assert.equal(chain.projectionItemId, "a"); assert.equal(chain.assertionId, "assertion-a"); assert.equal(chain.predecessorAssertionId, "assertion-before"); assert.equal(chain.sources[0]?.origin, "manual_intake"); assert.equal(chain.evidence[0]?.excerpt, "Price"); assert.equal(chain.projectionVersion, 3);
 assert.match(buildStructuredSystemPrompt(p, retrieved, { depth: "brief", intent: "general", reason: "brief" }, result), /Provenance summary/);
});

test("same logical topic across entities conflicts, while unrelated topics stay separate", () => {
 const first = claim("one", "$100", { entityId: "price-one" }); const second = claim("two", "$200", { entityId: "price-two" });
 const p = projection([first, second]); const result = analyzeCanonicalConflicts(p, retrieveStructuredCanonicalKnowledge(p, "website price"), "website price");
 assert.equal(result.unresolvedConflictGroups.length, 1); assert.equal(result.unresolvedItems.length, 2);
 const unrelated = projection([first, { ...claim("hours", "9 to 5"), title: "Business hours", entityId: "hours" }]);
 assert.equal(analyzeCanonicalConflicts(unrelated, retrieveStructuredCanonicalKnowledge(unrelated, "website price business hours"), "website price business hours").conflictGroups.length, 0);
});

test("restrictions have correction, history, and unresolved-conflict handling", () => {
 const p = projection(); p.restrictions = [
  { id: "old-rule", type: "prohibited_claim", instruction: "Do not promise rankings.", relatedEntityIds: [], relatedAssertionIds: ["old-rule"], evidenceIds: ["evidence"], sourceIds: ["source"], reviewState: "approved", authority: "confirmed", predecessorAssertionId: null },
  { id: "new-rule", type: "prohibited_claim", instruction: "Rankings may be discussed.", relatedEntityIds: [], relatedAssertionIds: ["new-rule"], evidenceIds: ["evidence"], sourceIds: ["source"], reviewState: "corrected", authority: "corrected", predecessorAssertionId: "old-rule" },
 ];
 const normal = analyzeCanonicalConflicts(p, retrieveStructuredCanonicalKnowledge(p, "promise rankings"), "promise rankings"); assert.ok(normal.answerItems.some(x => x.assertionId === "new-rule")); assert.ok(!normal.answerItems.some(x => x.assertionId === "old-rule"));
 const history = analyzeCanonicalConflicts(p, retrieveStructuredCanonicalKnowledge(p, "previous promise rankings"), "previous promise rankings"); assert.ok(history.answerItems.some(x => x.assertionId === "old-rule"));
 const conflict = projection(); conflict.restrictions = [{ id: "a", type: "prohibited_claim", instruction: "Do not guarantee refunds.", relatedEntityIds: ["refund-policy"], relatedAssertionIds: ["a"], evidenceIds: [], sourceIds: [], reviewState: "approved", authority: "confirmed" }, { id: "b", type: "prohibited_claim", instruction: "Guarantee refunds.", relatedEntityIds: ["refund-policy"], relatedAssertionIds: ["b"], evidenceIds: [], sourceIds: [], reviewState: "approved", authority: "confirmed" }];
 const retrievedConflict = retrieveStructuredCanonicalKnowledge(conflict, "cannot guarantee refunds"); assert.deepEqual(retrievedConflict.items.map(x => x.category), ["restriction", "restriction"]); assert.ok(retrievedConflict.items.every(x => "reviewState" in x.item)); const unresolved = analyzeCanonicalConflicts(conflict, retrievedConflict, "cannot guarantee refunds"); assert.equal(unresolved.unresolvedConflictGroups.length, 1); assert.equal(unresolved.answerItems.length, 0); assert.match(buildStructuredSystemPrompt(conflict, retrievedConflict, { depth: "brief", intent: "general", reason: "brief" }, unresolved), /Unresolved conflict context/);
});

test("provenance summaries use origins rather than source ID count", () => {
 const corrected = projection([claim("corrected", "$100", { authority: "corrected", reviewState: "corrected", provenance: { classification: "manual_intake", predecessorClassification: null, originalClassification: null, correctedByClerkUserId: "u", correctedByDisplayName: null, correctedByEmail: null, correctedAt: "2026-01-02T00:00:00Z" } })]);
 assert.equal(analyzeCanonicalConflicts(corrected, retrieveStructuredCanonicalKnowledge(corrected, "price"), "price").provenanceSummary[0], "Based on corrected business information.");
 const website = projection(); website.sources[0].origin = "website"; assert.equal(analyzeCanonicalConflicts(website, retrieveStructuredCanonicalKnowledge(website, "price"), "price").provenanceSummary[0], "Based on reviewed website information.");
});
