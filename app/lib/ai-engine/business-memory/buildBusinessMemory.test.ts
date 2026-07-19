import assert from "node:assert/strict";
import test from "node:test";
import type { AiBuilderSession, BusinessContextEntry } from "../contracts";
import { websiteFactIdentity, type PersistedWebsiteKnowledge } from "../knowledge/websiteKnowledge";
import { buildBusinessMemory } from "./buildBusinessMemory";

const createdAt = "2026-07-19T10:00:00.000Z";
const updatedAt = "2026-07-19T11:00:00.000Z";

function session(overrides: Partial<AiBuilderSession> = {}): AiBuilderSession {
  return {
    id: "project_1", status: "review_required", intakeBlocks: [],
    assistantConfiguration: { name: "Test", purpose: "Test", tone: "Test", responseStyle: "Test", primaryAudience: null, escalationInstructions: [] },
    contextEntries: [], faqEntries: [], conflicts: [], missingInformation: [],
    contextCounts: { total: 0, approved: 0, proposed: 0, archived: 0, byCategory: {} },
    buildProgress: [], createdAt, updatedAt, expiresAt: null, ...overrides,
  };
}

function entry(overrides: Partial<BusinessContextEntry> = {}): BusinessContextEntry {
  return {
    id: "entry_planning_1", sessionId: "project_1", category: "service", title: "Planning", content: "We provide planning workshops.",
    confidence: "medium", confidenceScore: 0.72, status: "approved",
    source: { intakeBlockId: "manual_services", excerpt: "We provide planning workshops.", sourceType: "manual_intake", sourceUrl: null },
    metadata: { generated: false, userEdited: false, conflictingEntryIds: [], tags: ["Workshops", "Strategy"] },
    createdAt, updatedAt, ...overrides,
  };
}

function websiteKnowledge(facts: PersistedWebsiteKnowledge["knowledge"]["facts"]): PersistedWebsiteKnowledge {
  return {
    schema_version: 1, document_version: 1, current_crawl_attempt_id: "crawl_1", imported_at: createdAt,
    requested_url: "https://example.com", resolved_url: "https://example.com", pages: [], warnings: [],
    knowledge: { facts, coverage: { businessIdentity: 0, offers: 0, customers: 0, pricing: 0, policies: 0, processes: 0, faq: 0, contact: 0, overall: 0 }, unresolvedQuestions: [] },
  };
}

const planningWebsiteFact = {
  category: "service" as const, title: " planning ", value: "Planning sessions are available remotely.", confidence: "high" as const,
  evidence: [
    { url: "https://example.com/services", excerpt: "Planning sessions are available remotely." },
    { url: "https://example.com/about", excerpt: "Our planning sessions can be remote." },
  ],
};

const planningWebsiteFactTwo = {
  category: "service" as const, title: "Planning", value: "Planning is available in person.", confidence: "medium" as const,
  evidence: [{ url: "https://example.com/contact", excerpt: "Planning is available in person." }],
};

test("produces byte-equivalent deterministic output regardless of input order", () => {
  const first = entry();
  const second = entry({ id: "entry_planning_2", title: " planning ", content: "Planning sessions are available remotely.", status: "corrected", confidence: "high", confidenceScore: 0.91 });
  const website = websiteKnowledge([planningWebsiteFact, planningWebsiteFactTwo]);
  const forward = buildBusinessMemory({ session: session({ contextEntries: [first, second] }), websiteKnowledge: website });
  const reversed = buildBusinessMemory({ session: session({ contextEntries: [second, first] }), websiteKnowledge: websiteKnowledge([planningWebsiteFactTwo, planningWebsiteFact]) });
  assert.equal(JSON.stringify(forward), JSON.stringify(reversed));
});

test("maps an empty project without entities, assertions, sources, evidence, or relationships", () => {
  const memory = buildBusinessMemory({ session: session(), websiteKnowledge: null });
  assert.deepEqual({ entities: memory.entities, assertions: memory.assertions, relationships: memory.relationships, sources: memory.sources, evidence: memory.evidence }, { entities: [], assertions: [], relationships: [], sources: [], evidence: [] });
});

test("groups same normalized context title and type under one canonical entity without merging assertions", () => {
  const first = entry();
  const second = entry({ id: "entry_planning_2", title: " planning ", content: "Planning sessions are available remotely.", status: "corrected", confidence: "high", confidenceScore: 0.91 });
  const memory = buildBusinessMemory({ session: session({ contextEntries: [first, second] }), websiteKnowledge: null });
  assert.equal(memory.entities.length, 1);
  assert.equal(memory.assertions.length, 2);
  assert.deepEqual(memory.entities[0].aliases, ["Planning"]);
  assert.equal(memory.entities[0].assertionIds.length, 2);
  assert.deepEqual(memory.assertions.map((item) => item.value).sort(), ["Planning sessions are available remotely.", "We provide planning workshops."]);
  assert.deepEqual(memory.assertions.map((item) => item.reviewState).sort(), ["approved", "corrected"]);
  assert.deepEqual(memory.assertions.map((item) => item.confidence.score).sort(), [0.72, 0.91]);
});

test("keeps same name under different entity types separate", () => {
  const service = entry();
  const process = entry({ id: "entry_process", category: "process", title: "Planning", content: "Planning starts with a call." });
  const memory = buildBusinessMemory({ session: session({ contextEntries: [service, process] }), websiteKnowledge: null });
  assert.equal(memory.entities.length, 2);
  assert.deepEqual(memory.entities.map((item) => item.type).sort(), ["process", "service"]);
});

test("groups matching manual and website concepts while preserving all website evidence and independent sources", () => {
  const memory = buildBusinessMemory({ session: session({ contextEntries: [entry()] }), websiteKnowledge: websiteKnowledge([planningWebsiteFact]) });
  assert.equal(memory.entities.length, 1);
  assert.equal(memory.assertions.length, 2);
  assert.equal(memory.evidence.length, 3);
  assert.equal(memory.sources.length, 3);
  assert.deepEqual(memory.evidence.map((item) => item.excerpt).sort(), ["Our planning sessions can be remote.", "Planning sessions are available remotely.", "We provide planning workshops."]);
  assert.deepEqual(memory.entities[0].tags, ["Strategy", "Workshops", "service"]);
});

test("preserves duplicate values as distinct assertions and all review states", () => {
  const statuses = ["proposed", "approved", "corrected", "archived"] as const;
  const entries = statuses.map((status, index) => entry({ id: `entry_${status}`, title: "Planning", content: "Same independent statement.", status, confidenceScore: index / 10, updatedAt: `2026-07-19T11:00:0${index}.000Z` }));
  const memory = buildBusinessMemory({ session: session({ contextEntries: entries }), websiteKnowledge: null });
  assert.equal(memory.entities.length, 1);
  assert.equal(memory.assertions.length, 4);
  assert.deepEqual(memory.assertions.map((item) => item.reviewState).sort(), ["approved", "archived", "corrected", "proposed"]);
  assert.deepEqual(memory.assertions.map((item) => item.legacyEntryId).sort(), statuses.map((status) => `entry_${status}`).sort());
});

test("aggregates entity aliases, tags, sources, evidence, and timestamps deterministically", () => {
  const older = entry({ id: "entry_old", title: "Planning", metadata: { generated: false, userEdited: false, conflictingEntryIds: [], tags: ["Strategy"] }, createdAt: "2026-07-18T10:00:00.000Z", updatedAt: "2026-07-18T12:00:00.000Z" });
  const newer = entry({ id: "entry_new", title: "Plan", metadata: { generated: false, userEdited: true, conflictingEntryIds: [], tags: ["Remote"] }, source: { intakeBlockId: "edited", excerpt: "Remote planning is available.", sourceType: "user_edit", sourceUrl: "https://example.com/remote" }, createdAt: "2026-07-20T10:00:00.000Z", updatedAt: "2026-07-21T12:00:00.000Z" });
  const memory = buildBusinessMemory({ session: session({ contextEntries: [older, newer] }), websiteKnowledge: null });
  // Different names intentionally create separate canonical concepts; aggregate the Planning concept with a whitespace alias.
  const grouped = buildBusinessMemory({ session: session({ contextEntries: [older, { ...newer, title: " planning " }] }), websiteKnowledge: null });
  const entity = grouped.entities[0];
  assert.deepEqual(entity.aliases, ["planning"]);
  assert.deepEqual(entity.tags, ["Remote", "Strategy"]);
  assert.equal(entity.sourceIds.length, 2);
  assert.equal(entity.evidenceIds.length, 2);
  assert.equal(entity.createdAt, "2026-07-18T10:00:00.000Z");
  assert.equal(entity.updatedAt, "2026-07-21T12:00:00.000Z");
  assert.equal(memory.entities.length, 2);
});

test("uses grouped canonical entities for direct FAQ support relationships", () => {
  const one = entry();
  const two = entry({ id: "entry_planning_2", title: " planning ", content: "Remote planning is available." });
  const faq = { id: "faq_1", sessionId: "project_1", question: "Do you offer planning?", answer: "Yes.", confidence: "high" as const, confidenceScore: 0.91, sourceEntryIds: [one.id, two.id], status: "corrected" as const, createdAt, updatedAt };
  const memory = buildBusinessMemory({ session: session({ contextEntries: [one, two], faqEntries: [faq] }), websiteKnowledge: null });
  const planning = memory.entities.find((item) => item.type === "service")!;
  const faqEntity = memory.entities.find((item) => item.type === "faq")!;
  assert.equal(memory.relationships.length, 2);
  assert.ok(memory.relationships.every((item) => item.fromEntityId === planning.id && item.toEntityId === faqEntity.id));
  assert.equal(memory.assertions.find((item) => item.legacyEntryId === faq.id)?.value, "Yes.");
});

test("supports website-only, manual-only, FAQ-only, and mixed projects", () => {
  const faq = { id: "faq_only", sessionId: "project_1", question: "Question?", answer: "Answer.", confidence: "low" as const, confidenceScore: 0.4, sourceEntryIds: [], status: "proposed" as const, createdAt, updatedAt };
  assert.equal(buildBusinessMemory({ session: session(), websiteKnowledge: websiteKnowledge([planningWebsiteFact]) }).entities.length, 1);
  assert.equal(buildBusinessMemory({ session: session({ contextEntries: [entry()] }), websiteKnowledge: null }).entities.length, 1);
  assert.equal(buildBusinessMemory({ session: session({ faqEntries: [faq] }), websiteKnowledge: null }).entities.length, 1);
  assert.equal(buildBusinessMemory({ session: session({ contextEntries: [entry()], faqEntries: [faq] }), websiteKnowledge: websiteKnowledge([planningWebsiteFact]) }).entities.length, 2);
});


test("maps source origin and assertion authority independently", () => {
  const untouched = entry({ id: "untouched", status: "approved" });
  const manual = entry({ id: "manual", status: "corrected" });
  const edited = entry({ id: "edited", metadata: { generated: false, userEdited: true, conflictingEntryIds: [], tags: [] }, status: "approved" });
  const editedCorrected = entry({ id: "edited_corrected", metadata: { generated: false, userEdited: true, conflictingEntryIds: [], tags: [] }, status: "corrected" });
  const faq = { id: "faq_authority", sessionId: "project_1", question: "FAQ?", answer: "Answer.", confidence: "low" as const, confidenceScore: 0.4, sourceEntryIds: [], status: "corrected" as const, createdAt, updatedAt };
  const memory = buildBusinessMemory({ session: session({ contextEntries: [untouched, manual, edited, editedCorrected], faqEntries: [faq] }), websiteKnowledge: websiteKnowledge([planningWebsiteFact]) });
  assert.equal(memory.assertions.find((item) => item.legacyEntryId === untouched.id)?.authority, "provided");
  assert.equal(memory.assertions.find((item) => item.legacyEntryId === manual.id)?.authority, "corrected");
  assert.equal(memory.assertions.find((item) => item.legacyEntryId === edited.id)?.authority, "confirmed");
  assert.equal(memory.assertions.find((item) => item.legacyEntryId === editedCorrected.id)?.authority, "corrected");
  assert.equal(memory.assertions.find((item) => item.legacyEntryId === faq.id)?.authority, "corrected");
  const generated = { ...faq, id: "faq_generated", status: "approved" as const };
  const generatedMemory = buildBusinessMemory({ session: session({ faqEntries: [generated] }), websiteKnowledge: null });
  assert.equal(generatedMemory.assertions[0].authority, "generated");
  assert.ok(memory.sources.some((item) => item.origin === "website"));
  assert.ok(memory.sources.some((item) => item.origin === "manual_intake"));
  assert.ok(memory.sources.some((item) => item.origin === "user_edit"));
  assert.ok(memory.sources.some((item) => item.origin === "generated_qa"));
});

test("selects preferred alias display deterministically", () => {
  const website = entry({ id: "website_style", title: "planning", metadata: { generated: false, userEdited: false, conflictingEntryIds: [], tags: [] }, status: "proposed" });
  const manual = entry({ id: "manual_style", title: " PLANNING ", metadata: { generated: false, userEdited: false, conflictingEntryIds: [], tags: [] }, status: "approved" });
  const corrected = entry({ id: "edit_style", title: "Planning", metadata: { generated: false, userEdited: true, conflictingEntryIds: [], tags: [] }, status: "corrected" });
  const strategic = entry({ id: "strategic", title: "Strategic Planning", metadata: { generated: false, userEdited: false, conflictingEntryIds: [], tags: [] } });
  const memory = buildBusinessMemory({ session: session({ contextEntries: [website, manual, corrected, strategic] }), websiteKnowledge: null });
  const planning = memory.entities.find((item) => item.aliases.includes("Planning"))!;
  assert.equal(planning.name, "Planning");
  assert.deepEqual(planning.aliases, ["Planning"]);
  assert.ok(memory.entities.some((item) => item.aliases.includes("Strategic Planning")));
});

function restoredWebsiteEntry(fact = planningWebsiteFact, overrides: Partial<BusinessContextEntry> = {}): BusinessContextEntry {
  return entry({
    id: websiteFactIdentity(fact),
    category: "service",
    title: fact.title,
    content: fact.value,
    status: "approved",
    source: { intakeBlockId: "website_knowledge", excerpt: fact.evidence[0].excerpt, sourceType: "website", sourceUrl: fact.evidence[0].url },
    metadata: { generated: true, userEdited: false, conflictingEntryIds: [], tags: [fact.category] },
    ...overrides,
  });
}

test("preserves sourceType origin independently of edit metadata", () => {
  const website = entry({ id: "website", source: { intakeBlockId: "website_knowledge", excerpt: "x", sourceType: "website", sourceUrl: "https://example.com" } });
  const generated = entry({ id: "generated", source: { intakeBlockId: "generated", excerpt: "x", sourceType: "generated_qa", sourceUrl: null } });
  const manual = entry({ id: "manual-origin" });
  const userEdit = entry({ id: "user-edit", source: { intakeBlockId: "manual", excerpt: "x", sourceType: "manual_intake", sourceUrl: null }, metadata: { generated: false, userEdited: true, conflictingEntryIds: [], tags: [] } });
  const memory = buildBusinessMemory({ session: session({ contextEntries: [website, generated, manual, userEdit] }), websiteKnowledge: null });
  const originFor = (id: string) => memory.sources.find((source) => source.sourceEntryId === id)?.origin;
  assert.equal(originFor(website.id), "website");
  assert.equal(originFor(generated.id), "generated_qa");
  assert.equal(originFor(manual.id), "manual_intake");
  assert.equal(originFor(userEdit.id), "user_edit");
});

test("reconciles restored website facts into one workflow-preserving assertion with full provenance", () => {
  for (const status of ["approved", "corrected", "archived"] as const) {
    const restored = restoredWebsiteEntry(planningWebsiteFact, { status });
    const memory = buildBusinessMemory({ session: session({ contextEntries: [restored] }), websiteKnowledge: websiteKnowledge([planningWebsiteFact]) });
    assert.equal(memory.assertions.length, 1);
    assert.equal(memory.assertions[0].reviewState, status);
    assert.equal(memory.assertions[0].authority, status === "corrected" ? "corrected" : "observed");
    assert.equal(memory.evidence.length, planningWebsiteFact.evidence.length);
    assert.deepEqual(memory.sources.map((source) => source.url).sort(), planningWebsiteFact.evidence.map((item) => item.url).sort());
    assert.ok(memory.sources.every((source) => source.crawlAttemptId === "crawl_1"));
  }
});

test("uses the newest imported or assertion timestamp for memory freshness", () => {
  const imported = "2026-07-20T12:00:00.000Z";
  const knowledge = { ...websiteKnowledge([planningWebsiteFact]), imported_at: imported };
  assert.equal(buildBusinessMemory({ session: session({ updatedAt }), websiteKnowledge: knowledge }).updatedAt, imported);
  assert.equal(buildBusinessMemory({ session: session({ contextEntries: [entry({ updatedAt: "2026-07-21T12:00:00.000Z" })] }), websiteKnowledge: null }).updatedAt, "2026-07-21T12:00:00.000Z");
});

test("relationship provenance retains both endpoint entity and assertion IDs", () => {
  const source = entry();
  const faq = { id: "faq_provenance", sessionId: "project_1", question: "Do you plan?", answer: "Yes.", confidence: "high" as const, confidenceScore: 0.9, sourceEntryIds: [source.id], status: "approved" as const, createdAt, updatedAt };
  const memory = buildBusinessMemory({ session: session({ contextEntries: [source], faqEntries: [faq] }), websiteKnowledge: null });
  const relationship = memory.relationships[0];
  assert.equal(relationship.fromEntityId, memory.assertions.find((item) => item.id === relationship.fromAssertionId)?.entityId);
  assert.equal(relationship.toEntityId, memory.assertions.find((item) => item.id === relationship.toAssertionId)?.entityId);
});

test("uses long deterministic IDs and serializes reviewed merge contracts deterministically", () => {
  const merges = [{ canonicalEntityId: "entity_b", mergedEntityIds: ["entity_c", "entity_a"], approvedAliases: ["Beta", "Alpha"], mergedAt: "2026-07-22T00:00:00.000Z" }];
  const forward = buildBusinessMemory({ session: session({ contextEntries: [entry(), entry({ id: "entry_2" })] }), websiteKnowledge: null, entityMerges: merges });
  const reversed = buildBusinessMemory({ session: session({ contextEntries: [entry({ id: "entry_2" }), entry()] }), websiteKnowledge: null, entityMerges: merges });
  assert.equal(JSON.stringify(forward), JSON.stringify(reversed));
  assert.match(forward.id, /^business_memory_[a-f0-9]{64}$/);
  assert.deepEqual(forward.entityMerges, [{ ...merges[0], mergedEntityIds: ["entity_a", "entity_c"], approvedAliases: ["Alpha", "Beta"] }]);
  assert.equal("entityMerges" in buildBusinessMemory({ session: session(), websiteKnowledge: null }), false);
});

test("reconciles a corrected website fact after save, restore, and recrawl", () => {
  const initialFact = planningWebsiteFact;
  const imported = restoredWebsiteEntry(initialFact);
  const corrected = {
    ...imported,
    status: "corrected" as const,
    metadata: { ...imported.metadata, userEdited: false },
    content: "Planning sessions are available globally.",
    updatedAt: "2026-07-20T10:00:00.000Z",
  };
  // A restored session preserves the structured entry ID and its reviewed workflow state.
  const restored = session({ contextEntries: [corrected] });
  const recrawledFact = {
    ...initialFact,
    evidence: initialFact.evidence.map((item) => ({ ...item, excerpt: `${item.excerpt} Refreshed.` })),
  };
  const recrawledKnowledge = {
    ...websiteKnowledge([recrawledFact]),
    current_crawl_attempt_id: "crawl_2",
    imported_at: "2026-07-21T10:00:00.000Z",
  };
  const memory = buildBusinessMemory({ session: restored, websiteKnowledge: recrawledKnowledge });
  assert.equal(memory.assertions.length, 1);
  assert.equal(memory.assertions[0].reviewState, "corrected");
  assert.equal(memory.assertions[0].authority, "corrected");
  assert.equal(memory.entities.length, 1);
  assert.equal(memory.entities[0].id, buildBusinessMemory({ session: session({ contextEntries: [corrected] }), websiteKnowledge: null }).entities[0].id);
  assert.deepEqual(memory.evidence.map((item) => item.excerpt).sort(), recrawledFact.evidence.map((item) => item.excerpt).sort());
  assert.ok(memory.sources.every((source) => source.crawlAttemptId === "crawl_2"));
  assert.equal(memory.assertions.filter((item) => item.reviewState === "proposed").length, 0);
});
