import assert from "node:assert/strict";
import test from "node:test";
import { assembleBusinessConcepts } from "./concepts";
import type { DeterministicFact, MaterialConflict, NormalizedEvidence } from "./contracts";
import { assembleConceptRelationships } from "./relationships";

const evidence = (excerpt: string, url = "https://example.test", provenance: "owner" | "website" = "website"): NormalizedEvidence => ({ url, excerpt, sourceDocumentId: `${provenance}:${url}`, sourceBlockId: `${provenance}:${url}:${excerpt}`, crawlAttemptId: "crawl-1", heading: "Details", pageTitle: "Acme", pageType: "other", sourceType: provenance === "owner" ? "owner" : "html", provenance, structured: false });
const fact = (id: string, category: DeterministicFact["category"], topicKey: string, title: string, value: string, items = [evidence(value)], confidenceScore = 80): DeterministicFact => ({ id, category, topicKey, title, value, confidence: "high", confidenceScore, provenance: items[0]?.provenance ?? "website", evidence: items, explicit: true });
const relationships = (facts: DeterministicFact[], conflicts: MaterialConflict[] = []) => assembleConceptRelationships(facts, assembleBusinessConcepts(facts, conflicts), conflicts);

test("recognizes only the supported explicit directional connections", () => {
  const fixtures: Array<[DeterministicFact[], string, string, string]> = [
    [[fact("plan", "pricing_plan", "pricing_plan:professional", "Professional Plan", "The Professional Plan includes Website Design."), fact("service", "service", "service:website_design", "Website Design", "Website Design services for companies.")], "includes", "pricing_plan:professional", "service:website_design"],
    [[fact("plan", "pricing_plan", "pricing_plan:starter", "Starter Plan", "The Starter Plan includes LeadForge."), fact("product", "product", "product:leadforge", "LeadForge", "LeadForge sales software.")], "includes", "pricing_plan:starter", "product:leadforge"],
    [[fact("product", "product", "product:leadforge", "LeadForge", "LeadForge integrates with Google Workspace."), fact("integration", "integration", "integration:google_workspace", "Google Workspace", "Google Workspace integration.")], "integrates_with", "product:leadforge", "integration:google_workspace"],
    [[fact("service", "service", "service:website_design", "Website Design", "Website Design serves Healthcare."), fact("industry", "industry_served", "industry_served:healthcare", "Healthcare", "Healthcare businesses.")], "serves", "service:website_design", "industry_served:healthcare"],
    [[fact("service", "service", "service:website_design", "Website Design", "Website Design is available in Atlanta."), fact("location", "location_service_area", "location_service_area:atlanta", "Atlanta", "Atlanta service area.")], "available_in", "service:website_design", "location_service_area:atlanta"],
    [[fact("policy", "policy", "policy:refund", "Refund Policy", "The Refund Policy applies to the Starter Plan."), fact("plan", "pricing_plan", "pricing_plan:starter", "Starter Plan", "Starter pricing.")], "applies_to", "policy:refund", "pricing_plan:starter"],
    [[fact("contact", "contact_information", "contact_information:billing_email", "Billing Email", "Contact Billing Email for Website Design support."), fact("service", "service", "service:website_design", "Website Design", "Website Design service.")], "contact_for", "contact_information:billing_email", "service:website_design"],
  ];
  for (const [facts, type, source, target] of fixtures) assert.deepEqual(relationships(facts).map(item => [item.type, item.sourceTopicIdentity, item.targetTopicIdentity]), [[type, source, target]]);
});

test("does not use co-occurrence, create dangling endpoints, or include FAQs", () => {
  const base = [fact("plan", "pricing_plan", "pricing_plan:professional", "Professional Plan", "Professional Plan and Website Design are popular."), fact("service", "service", "service:website_design", "Website Design", "Website Design service."), fact("faq", "faq", "faq:plans", "What is included?", "Professional Plan includes Website Design.")];
  assert.deepEqual(relationships(base), []);
  assert.deepEqual(relationships([fact("plan", "pricing_plan", "pricing_plan:professional", "Professional Plan", "Professional Plan includes SEO.")]), []);
});

test("deduplicates evidence, combines sources, preserves provenance, and discounts conflicts", () => {
  const statement = "Professional Plan includes Website Design.";
  const shared = evidence(statement);
  const facts = [fact("a", "pricing_plan", "pricing_plan:professional", "Professional Plan", statement, [shared, { ...shared }], 80), fact("b", "pricing_plan", "pricing_plan:professional", "Professional Plan", statement, [evidence(statement, "owner://knowledge", "owner")], 80), fact("service", "service", "service:website_design", "Website Design", "Website Design service.")];
  const normal = relationships(facts)[0]!;
  assert.deepEqual(normal.supportingFactIds, ["a", "b"]);
  assert.equal(normal.supportingEvidence.length, 2);
  assert.deepEqual(normal.reasonCodes, ["explicit_inclusion", "owner_supported", "website_supported", "multi_source_support"]);
  const conflict: MaterialConflict = { id: "conflict", topicKey: "pricing_plan:professional", factIds: ["a"], preferredFactId: "a", websiteFactIds: ["a"], sessionEntryIds: [], reason: "conflict" };
  const affected = relationships(facts, [conflict])[0]!;
  assert.ok(affected.confidenceScore < normal.confidenceScore);
  assert.ok(affected.reasonCodes.includes("affected_by_conflict"));
});

test("IDs, ordering, repeated runs, facts, concepts, health, and importance remain stable", () => {
  const facts = [fact("z", "service", "service:website_design", "Website Design", "Website Design is available in Atlanta."), fact("l", "location_service_area", "location_service_area:atlanta", "Atlanta", "Atlanta area."), fact("p", "product", "product:leadforge", "LeadForge", "LeadForge integrates with Google Workspace."), fact("i", "integration", "integration:google_workspace", "Google Workspace", "Google Workspace integration.")];
  const beforeFacts = structuredClone(facts), concepts = assembleBusinessConcepts(facts), beforeConcepts = structuredClone(concepts);
  const first = assembleConceptRelationships(facts, concepts), second = assembleConceptRelationships([...facts].reverse(), [...concepts].reverse());
  assert.deepEqual(first, second);
  assert.deepEqual(first.map(item => item.id), [...first.map(item => item.id)].sort());
  assert.deepEqual(facts, beforeFacts);
  assert.deepEqual(concepts, beforeConcepts);
});
