import assert from "node:assert/strict";
import test from "node:test";

import type { AiBuilderSession, BusinessContextEntry, GeneratedFaqEntry } from "@/app/lib/ai-engine/contracts";
import { buildKnowledgePack } from "@/app/lib/ai-engine/knowledge/buildKnowledgePack";
import { applyStructuredWebsiteKnowledge, reconcileStructuredWebsiteKnowledge, websiteFactIdentity, websiteFaqIdentity, type PersistedWebsiteKnowledge, type WebsiteKnowledgeFact } from "@/app/lib/ai-engine/knowledge/websiteKnowledge";
import { normalizeContextProvenance, normalizeFaqProvenance } from "@/app/lib/ai-engine/provenance";
import { buildLegacyProjectPersistenceQueries, getAiBuilderProjectWithDependencies, hydrateAiBuilderProjectSession, persistAiBuilderProjectWithDependencies } from "./ai-builder-repository";

const time = "2026-07-20T10:00:00.000Z";
const later = "2026-07-20T10:05:00.000Z";
const websiteFacts: WebsiteKnowledgeFact[] = [
  { category: "business_identity", title: "Company", value: "Northstar Studio", confidence: "high", evidence: [{ url: "https://northstar.test/about", excerpt: "Northstar Studio." }, { url: "https://northstar.test/", excerpt: "Independent design studio." }] },
  { category: "product", title: "Brand sprint", value: "A five-day positioning workshop.", confidence: "high", evidence: [{ url: "https://northstar.test/services", excerpt: "Five-day brand sprint." }] },
  { category: "service", title: "Website design", value: "Conversion-focused websites.", confidence: "medium", evidence: [{ url: "https://northstar.test/services", excerpt: "Websites for growing teams." }] },
  { category: "pricing", title: "Brand sprint price", value: "Starts at $8,000.", confidence: "high", evidence: [{ url: "https://northstar.test/pricing", excerpt: "Brand sprints start at $8,000." }] },
  { category: "policy", title: "Refund policy", value: "Deposits are non-refundable.", confidence: "medium", evidence: [{ url: "https://northstar.test/terms", excerpt: "Deposits are non-refundable." }] },
  { category: "faq", title: "Timeline", value: "Most websites launch in six weeks.", confidence: "high", evidence: [{ url: "https://northstar.test/faq", excerpt: "Typical launch: six weeks." }] },
];
const websiteKnowledge: PersistedWebsiteKnowledge = { schema_version: 1, document_version: 2, current_crawl_attempt_id: "crawl-fixed", imported_at: time, requested_url: "https://northstar.test/", resolved_url: "https://northstar.test/", pages: [{ url: "https://northstar.test/", title: "Home", pageType: "home" }, { url: "https://northstar.test/faq", title: "FAQ", pageType: "faq" }], warnings: ["One page timed out"], knowledge: { facts: websiteFacts, coverage: { businessIdentity: 100, offers: 90, customers: 0, pricing: 100, policies: 100, processes: 0, faq: 100, contact: 0, overall: 61 }, unresolvedQuestions: ["What are support hours?"] } };

function entry(id: string, category: BusinessContextEntry["category"], title: string, status: BusinessContextEntry["status"], source: BusinessContextEntry["source"]): BusinessContextEntry {
  return { id, sessionId: "project-fixed", category, title, content: `${title} content`, confidence: "high", confidenceScore: .9, status, source, metadata: { generated: false, userEdited: false, conflictingEntryIds: [], tags: ["Priority", "priority", "  Design "] }, createdAt: time, updatedAt: later };
}
function faq(id: string, question: string, status: GeneratedFaqEntry["status"], sourceEntryIds: string[]): GeneratedFaqEntry {
  return { id, sessionId: "project-fixed", question, answer: `${question} answer`, confidence: "medium", confidenceScore: .7, sourceEntryIds, status, createdAt: time, updatedAt: later };
}
function persistedSession(value: AiBuilderSession): AiBuilderSession {
  const contextEntries = value.contextEntries.map(normalizeContextProvenance);
  return { ...value, contextEntries, faqEntries: value.faqEntries.map((entry) => normalizeFaqProvenance(entry, contextEntries)) };
}

function session(): AiBuilderSession {
  return { id: "project-fixed", status: "ready", intakeBlocks: [{ id: "intake-1", label: "Services", content: "Design", createdAt: time, updatedAt: later }], assistantConfiguration: { name: " Northstar Assistant ", purpose: " Help clients ", tone: " Warm ", responseStyle: "concise", primaryAudience: "Founders", escalationInstructions: ["Email team"] }, contextEntries: [entry("manual-policy", "policy", "Deposits", "approved", { intakeBlockId: "intake-1", excerpt: "Deposits are non-refundable.", sourceType: "manual_intake", sourceUrl: null }), entry("archived-service", "service", "Old service", "archived", { intakeBlockId: "intake-1", excerpt: "Old", sourceType: "manual_intake", sourceUrl: null })], faqEntries: [faq("faq-z", "Zebra question", "approved", ["manual-policy", "website-a"]), faq("faq-a", "Alpha question", "approved", ["website-a", "manual-policy"]), faq("faq-archived", "Archived question", "archived", ["manual-policy"])], conflicts: [{ id: "conflict-1", topic: "Price", firstStatement: "A", secondStatement: "B", sourceExcerpts: ["A", "B"], suggestedQuestion: "Which?", resolved: false, resolution: null }], missingInformation: [{ id: "missing-1", topic: "Hours", reason: "Absent", suggestedQuestion: "When?", resolved: false }], contextCounts: { total: 2, approved: 1, proposed: 0, archived: 2, byCategory: { policy: 1, service: 1 } }, buildProgress: [{ stage: "complete", message: "Ready", completed: true, count: 3, createdAt: later }], createdAt: time, updatedAt: later, expiresAt: null };
}

test("website facts retain deterministic distinct restoration identities", () => {
  const first = websiteFacts.map(websiteFactIdentity);
  assert.deepEqual(first, ["website_fact_fd43fbed", "website_fact_45ee29be", "website_fact_91bc106e", "website_fact_2112d45a", "website_fact_2a31198e", "website_fact_37af4a7"]);
  assert.deepEqual(websiteFacts.map(websiteFactIdentity), first);
  assert.equal(new Set(first).size, websiteFacts.length);
});

test("website restoration preserves saved entries and creates deterministically ordered proposed facts", () => {
  const restored = applyStructuredWebsiteKnowledge(session(), websiteKnowledge.knowledge, { defaultStatus: "proposed" });
  assert.deepEqual(restored.contextEntries.map(({ id, status, source }) => ({ id, status, source })), [
    { id: "manual-policy", status: "approved", source: { intakeBlockId: "intake-1", excerpt: "Deposits are non-refundable.", sourceType: "manual_intake", sourceUrl: null } },
    { id: "archived-service", status: "archived", source: { intakeBlockId: "intake-1", excerpt: "Old", sourceType: "manual_intake", sourceUrl: null } },
    ...websiteFacts.map((fact) => ({ id: websiteFactIdentity(fact), status: "proposed", source: { intakeBlockId: "website_knowledge", excerpt: fact.evidence[0]!.excerpt, sourceType: "website", sourceUrl: fact.evidence[0]!.url } })),
  ]);
  assert.deepEqual(restored.contextCounts, {
    total: 12,
    approved: 3,
    proposed: 7,
    archived: 2,
    byCategory: { policy: 2, service: 3, business_profile: 1, pricing: 1, faq: 1 },
  });
});

test("website reconciliation never overwrites reviewed, archived, or removed records", () => {
  const id = websiteFactIdentity(websiteFacts[0]!);
  const reviewed = entry(id, "business_profile", "Corrected company", "corrected", {
    intakeBlockId: "website_knowledge", excerpt: "Northstar Studio.", sourceType: "website", sourceUrl: "https://northstar.test/about",
  });
  reviewed.content = "Northstar & Co.";
  const archived = entry(websiteFactIdentity(websiteFacts[1]!), "service", "Archived service", "archived", {
    intakeBlockId: "website_knowledge", excerpt: "Five-day brand sprint.", sourceType: "website", sourceUrl: "https://northstar.test/services",
  });
  const restored = reconcileStructuredWebsiteKnowledge({ ...session(), contextEntries: [reviewed, archived] }, websiteKnowledge.knowledge, { defaultStatus: "proposed" });
  assert.equal(restored.contextEntries.find((item) => item.id === id)?.content, "Northstar & Co.");
  assert.equal(restored.contextEntries.find((item) => item.id === archived.id)?.status, "archived");
  assert.equal(restored.contextEntries.filter((item) => item.id === id).length, 1);
});

test("website FAQ reconciliation is stable and preserves reviewed FAQ decisions", () => {
  const sourceFact = websiteFacts.find((fact) => fact.category === "faq")!;
  const id = websiteFaqIdentity(sourceFact);
  const first = reconcileStructuredWebsiteKnowledge(session(), websiteKnowledge.knowledge, { defaultStatus: "proposed" });
  const second = reconcileStructuredWebsiteKnowledge(first, websiteKnowledge.knowledge, { defaultStatus: "proposed" });
  assert.equal(first.faqEntries.filter((item) => item.id === id).length, 1);
  assert.equal(second.faqEntries.filter((item) => item.id === id).length, 1);
  const reviewed = { ...first, faqEntries: first.faqEntries.map((item) => item.id === id ? { ...item, question: "Corrected timeline", answer: "Six weeks after kickoff.", status: "corrected" as const, updatedAt: later } : item) };
  const restored = reconcileStructuredWebsiteKnowledge(reviewed, websiteKnowledge.knowledge, { defaultStatus: "proposed" });
  assert.deepEqual(restored.faqEntries.find((item) => item.id === id), reviewed.faqEntries.find((item) => item.id === id));
});

test("KnowledgePack includes only approved knowledge and has stable category, title, FAQ, and reference ordering", () => {
  const restored = applyStructuredWebsiteKnowledge(session(), websiteKnowledge.knowledge, { defaultStatus: "proposed" });
  const pack = buildKnowledgePack(restored);
  assert.deepEqual({ ...pack, builtAt: "<dynamic>" }, {
    sessionId: "project-fixed", assistantName: "Northstar Assistant", assistantPurpose: "Help clients", assistantTone: "Warm", primaryAudience: "Founders",
    facts: [{ id: "knowledge_manual-policy", category: "policy", title: "Deposits", content: "Deposits content", confidence: "high", confidenceScore: .9, sourceEntryId: "manual-policy", sourceExcerpt: "Deposits are non-refundable.", sourceType: "manual_intake", sourceUrl: null, tags: ["Priority", "Design"] }],
    faq: [
      { id: "knowledge_faq-a", question: "Alpha question", answer: "Alpha question answer", confidence: "medium", confidenceScore: .7, sourceEntryIds: ["website-a", "manual-policy"] },
      { id: "knowledge_faq-z", question: "Zebra question", answer: "Zebra question answer", confidence: "medium", confidenceScore: .7, sourceEntryIds: ["manual-policy", "website-a"] },
    ], behaviorRules: [], prohibitedClaims: [], builtAt: "<dynamic>", version: 1,
  });
});

test("repository persistence retains review statuses, source metadata, FAQ references, and every website evidence record", () => {
  const statements: Array<{ values: unknown[] }> = [];
  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => { statements.push({ values }); return {}; }) as never;
  const persisted = session();
  persisted.contextEntries.push(entry("website-a", "service", "Website evidence", "proposed", { intakeBlockId: "website_knowledge", excerpt: websiteFacts[0]!.evidence[0]!.excerpt, sourceType: "website", sourceUrl: websiteFacts[0]!.evidence[0]!.url }));
  buildLegacyProjectPersistenceQueries(sql, { session: persisted, businessName: "Northstar Studio", industry: "Design", website: "https://northstar.test/", websiteKnowledge, initialThread: { id: "thread-fixed", memory: {} as never }, identity: { userId: "user-fixed", displayName: "Ada", email: "ada@northstar.test" } });
  const projectPayload = JSON.parse(String(statements[0]!.values[7]));
  assert.deepEqual(projectPayload.website_knowledge.knowledge.facts[0].evidence, websiteFacts[0]!.evidence);
  const contextPayloads = statements.map((statement) => statement.values).filter((values) => (values[0] === "manual-policy" || values[0] === "archived-service" || values[0] === "website-a") && values.length > 9);
  assert.deepEqual(contextPayloads.map((values) => [values[0], values[7], JSON.parse(String(values[8])), JSON.parse(String(values[9]))]), [
    ["manual-policy", "approved", persisted.contextEntries[0]!.source, persistedSession(reconcileStructuredWebsiteKnowledge(persisted, websiteKnowledge.knowledge, { defaultStatus: "proposed" })).contextEntries[0]!.metadata],
    ["archived-service", "archived", persisted.contextEntries[1]!.source, persistedSession(reconcileStructuredWebsiteKnowledge(persisted, websiteKnowledge.knowledge, { defaultStatus: "proposed" })).contextEntries[1]!.metadata],
    ["website-a", "proposed", persisted.contextEntries[2]!.source, persistedSession(reconcileStructuredWebsiteKnowledge(persisted, websiteKnowledge.knowledge, { defaultStatus: "proposed" })).contextEntries[2]!.metadata],
  ]);
  const faqPayloads = statements.map((statement) => statement.values).filter((values) => (values[0] === "faq-z" || values[0] === "faq-a" || values[0] === "faq-archived") && values.length > 7);
  assert.deepEqual(faqPayloads.map((values) => [values[0], values[7], JSON.parse(String(values[6]))]), [
    ["faq-z", "approved", ["manual-policy", "website-a"]], ["faq-a", "approved", ["website-a", "manual-policy"]], ["faq-archived", "archived", ["manual-policy"]],
  ]);
});

test("repository hydration preserves persisted fields and documents current null and absent-field behavior", () => {
  const hydrated = hydrateAiBuilderProjectSession({ id: "project-fixed", status: "ready", assistant_configuration: session().assistantConfiguration, context_counts: session().contextCounts, created_at: new Date(time), updated_at: later, expires_at: null }, "project-fixed", {
    intakeBlocks: [{ id: "intake-1", label: "Services", content: "Design", created_at: time, updated_at: new Date(later) }],
    contextEntries: [{ ...session().contextEntries[0], created_at: new Date(time), updated_at: later }, { id: "context-nullish", category: "service", title: "Nullable", content: "", confidence: "low", confidence_score: 0.5, status: "archived", created_at: time, updated_at: later }],
    faqEntries: [{ ...session().faqEntries[0], source_entry_ids: ["manual-policy", "website-a"], created_at: time, updated_at: new Date(later) }, { id: "faq-empty", question: "Empty?", answer: "", confidence: "low", confidence_score: 0.5, status: "proposed", source_entry_ids: [], created_at: time, updated_at: later }],
    conflicts: session().conflicts.map((item) => ({ ...item, first_statement: item.firstStatement, second_statement: item.secondStatement, source_excerpts: item.sourceExcerpts, suggested_question: item.suggestedQuestion })), missingInformation: [], buildProgress: [{ stage: "complete", message: "Ready", completed: true, count: null, created_at: new Date(later) }],
  });
  assert.equal(hydrated.createdAt, time); assert.equal(hydrated.intakeBlocks[0]!.updatedAt, later);
  assert.deepEqual(hydrated.faqEntries.map((item) => item.sourceEntryIds), [["manual-policy", "website-a"], []]);
  assert.equal(hydrated.contextEntries[1]!.source, undefined);
  assert.deepEqual(hydrated.contextEntries[1]!.metadata, { provenanceClassification: "ai_generated" });
  assert.deepEqual(hydrated.buildProgress[0], { stage: "complete", message: "Ready", completed: true, count: null, createdAt: later });
  assert.equal(hydrated.expiresAt, null);
});


test("repository persistence round-trips the representative project through the production reopen flow", async () => {
  type Row = Record<string, unknown>;
  const state: { project: Row | null; intake: Row[]; context: Row[]; faq: Row[]; conflicts: Row[]; missing: Row[]; progress: Row[]; threads: Row[] } = { project: null, intake: [], context: [], faq: [], conflicts: [], missing: [], progress: [], threads: [] };
  const apply = (text: string, values: unknown[]) => {
    if (text.includes("INSERT INTO ai_builder_projects")) {
      state.project = { id: values[0], status: values[1], business_name: values[2], industry: values[3], website: values[4], assistant_configuration: JSON.parse(String(values[5])), context_counts: JSON.parse(String(values[6])), website_knowledge: JSON.parse(String(values[7])).website_knowledge, created_at: values[8], updated_at: values[9], expires_at: values[10] };
    } else if (text.includes("INSERT INTO ai_builder_intake_blocks")) state.intake.push({ id: values[0], project_id: values[1], label: values[2], content: values[3], created_at: values[4], updated_at: values[5] });
    else if (text.includes("INSERT INTO ai_builder_context_entries")) state.context.push({ id: values[0], project_id: values[1], category: values[2], title: values[3], content: values[4], confidence: values[5], confidence_score: values[6], status: values[7], source: JSON.parse(String(values[8])), metadata: JSON.parse(String(values[9])), created_at: values[10], updated_at: values[11] });
    else if (text.includes("INSERT INTO ai_builder_faq_entries")) state.faq.push({ id: values[0], project_id: values[1], question: values[2], answer: values[3], confidence: values[4], confidence_score: values[5], source_entry_ids: JSON.parse(String(values[6])), status: values[7], created_at: values[8], updated_at: values[9] });
    else if (text.includes("INSERT INTO ai_builder_conflicts")) state.conflicts.push({ id: values[0], topic: values[2], first_statement: values[3], second_statement: values[4], source_excerpts: JSON.parse(String(values[5])), suggested_question: values[6], resolved: values[7], resolution: values[8] });
    else if (text.includes("INSERT INTO ai_builder_missing_information")) state.missing.push({ id: values[0], topic: values[2], reason: values[3], suggested_question: values[4], resolved: values[5] });
    else if (text.includes("INSERT INTO ai_builder_progress")) state.progress.push({ project_id: values[0], stage: values[1], message: values[2], completed: values[3], count: values[4], created_at: values[5] });
    else if (text.includes("INSERT INTO ai_builder_chat_threads")) state.threads.push({ id: values[0], project_id: values[1], memory: JSON.parse(String(values[3])), created_at: values[4] });
  };
  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("?");
    if (text.includes("FROM ai_builder_projects")) return Promise.resolve(state.project ? [{ ...state.project }] : []);
    if (text.includes("FROM ai_builder_intake_blocks")) return Promise.resolve(state.intake);
    if (text.includes("FROM ai_builder_context_entries")) return Promise.resolve(state.context);
    if (text.includes("FROM ai_builder_faq_entries")) return Promise.resolve(state.faq);
    if (text.includes("FROM ai_builder_conflicts")) return Promise.resolve(state.conflicts);
    if (text.includes("FROM ai_builder_missing_information")) return Promise.resolve(state.missing);
    if (text.includes("FROM ai_builder_progress")) return Promise.resolve(state.progress);
    if (text.includes("FROM ai_builder_chat_threads")) return Promise.resolve(state.threads);
    return Promise.resolve([]);
  }) as never;
  (sql as { transaction: (build: (tx: never) => Array<{ queryData: { text: string; values: unknown[] } }>) => Promise<void> }).transaction = async (build) => {
    const tx = ((strings: TemplateStringsArray, ...values: unknown[]) => ({ queryData: { text: strings.join("?"), values } })) as never;
    for (const query of build(tx)) apply(query.queryData.text, query.queryData.values);
  };
  const persisted = session();
  persisted.contextEntries.push(entry("website-a", "service", "Website evidence", "proposed", { intakeBlockId: "website_knowledge", excerpt: websiteFacts[0]!.evidence[0]!.excerpt, sourceType: "website", sourceUrl: websiteFacts[0]!.evidence[0]!.url }));
  const initialThread = { id: "thread-fixed", memory: { summary: "Northstar thread" } as never };
  const identity = { userId: "user-fixed", displayName: "Ada", email: "ada@northstar.test" };
  await persistAiBuilderProjectWithDependencies({ session: persisted, businessName: "Northstar Studio", industry: "Design", website: "https://northstar.test/", websiteKnowledge, initialThread }, { identity, ensureSchema: async () => {}, sql, buildCanonicalProvenanceShadowQueries: ((): never[] => []) as never });
  assert.equal(state.faq.filter((item) => item.id === websiteFaqIdentity(websiteFacts[5]!)).length, 1);
  const reopened = await getAiBuilderProjectWithDependencies("project-fixed", { identity, ensureSchema: async () => {}, sql });
  assert.deepEqual(reopened, { session: persistedSession(reconcileStructuredWebsiteKnowledge(persisted, websiteKnowledge.knowledge, { defaultStatus: "proposed" })), businessName: "Northstar Studio", industry: "Design", website: "https://northstar.test/", websiteKnowledge, initialThread });
});

function websiteRepairSqlState(input: { project: Record<string, unknown>; context: Record<string, unknown>[]; faq: Record<string, unknown>[] }) {
  const state = { project: { ...input.project }, context: input.context.map((row) => ({ ...row })), faq: input.faq.map((row) => ({ ...row })), repairFaqInserts: 0, verificationQueries: 0 };
  const sql = ((strings: TemplateStringsArray) => {
    const text = strings.join("?");
    if (text.includes("FROM ai_builder_projects")) return Promise.resolve([{ ...state.project }]);
    if (text.includes("FROM ai_builder_context_entries")) return Promise.resolve(state.context.filter((row) => row.project_id === "project-fixed").map((row) => ({ ...row })));
    if (text.includes("FROM ai_builder_faq_entries")) return Promise.resolve(state.faq.filter((row) => row.project_id === "project-fixed").map((row) => ({ ...row })));
    return Promise.resolve([]);
  }) as never;
  (sql as { transaction: (build: (tx: never) => Array<{ queryData: { text: string; values: unknown[] } }>) => Promise<void> }).transaction = async (build) => {
    const tx = ((strings: TemplateStringsArray, ...values: unknown[]) => ({ queryData: { text: strings.join("?"), values } })) as never;
    const working = { project: { ...state.project }, context: state.context.map((row) => ({ ...row })), faq: state.faq.map((row) => ({ ...row })) };
    for (const query of build(tx)) {
      const { text, values } = query.queryData;
      if (text.includes("INSERT INTO ai_builder_context_entries")) {
        if (!working.context.some((row) => row.id === values[0])) working.context.push({ id: values[0], project_id: values[1], category: values[2], title: values[3], content: values[4], confidence: values[5], confidence_score: values[6], status: values[7], source: JSON.parse(String(values[8])), metadata: JSON.parse(String(values[9])), created_at: values[10], updated_at: values[11] });
      } else if (text.includes("INSERT INTO ai_builder_faq_entries")) {
        if (!working.faq.some((row) => row.id === values[0])) { working.faq.push({ id: values[0], project_id: values[1], question: values[2], answer: values[3], confidence: values[4], confidence_score: values[5], source_entry_ids: JSON.parse(String(values[6])), status: values[7], created_at: values[8], updated_at: values[9] }); state.repairFaqInserts += 1; }
      } else if (text.includes("verified_repair_owner")) {
        state.verificationQueries += 1;
        const table = text.includes("ai_builder_faq_entries") ? working.faq : working.context;
        if (!table.some((row) => row.id === values[0] && row.project_id === values[1])) throw new Error("division by zero");
      } else if (text.includes("UPDATE ai_builder_projects SET context_counts")) working.project.context_counts = JSON.parse(String(values[0]));
    }
    state.project = working.project; state.context = working.context; state.faq = working.faq;
  };
  return { sql, state };
}

function websiteFaqRepairFixture() {
  const faqFact = websiteFacts[5]!;
  const faqKnowledge = { ...websiteKnowledge, knowledge: { ...websiteKnowledge.knowledge, facts: [faqFact] } };
  const source = reconcileStructuredWebsiteKnowledge({ ...session(), contextEntries: [], faqEntries: [] }, faqKnowledge.knowledge, { defaultStatus: "proposed" });
  const context = source.contextEntries[0]!;
  const project = { id: "project-fixed", status: "ready", business_name: "Northstar Studio", industry: "Design", website: "https://northstar.test/", assistant_configuration: session().assistantConfiguration, context_counts: { total: 1, approved: 0, proposed: 1, archived: 0, byCategory: { faq: 1 } }, website_knowledge: faqKnowledge, created_at: time, updated_at: later, expires_at: null };
  return { faqFact, faqKnowledge, project, context: { ...context, project_id: "project-fixed", created_at: context.createdAt, updated_at: context.updatedAt } };
}

test("an older project repairs and durably retains one missing website FAQ", async () => {
  const fixture = websiteFaqRepairFixture();
  const { sql, state } = websiteRepairSqlState({ project: fixture.project, context: [fixture.context], faq: [] });
  const identity = { userId: "user-fixed", displayName: "Ada", email: "ada@northstar.test" };
  const first = await getAiBuilderProjectWithDependencies("project-fixed", { identity, ensureSchema: async () => {}, sql });
  const id = websiteFaqIdentity(fixture.faqFact);
  assert.equal(state.repairFaqInserts, 1);
  assert.equal(state.faq.filter((row) => row.id === id && row.project_id === "project-fixed").length, 1);
  assert.equal(first?.session.faqEntries.filter((entry) => entry.id === id).length, 1);
  const second = await getAiBuilderProjectWithDependencies("project-fixed", { identity, ensureSchema: async () => {}, sql });
  assert.equal(state.repairFaqInserts, 1);
  assert.equal(second?.session.faqEntries.filter((entry) => entry.id === id).length, 1);
});

test("a conflicting website repair ID aborts loading without committing repairs", async () => {
  const fixture = websiteFaqRepairFixture();
  const foreignId = websiteFactIdentity(fixture.faqFact);
  const foreignContext = { ...fixture.context, id: foreignId, project_id: "another-project" };
  const originalCounts = fixture.project.context_counts;
  const { sql, state } = websiteRepairSqlState({ project: fixture.project, context: [foreignContext], faq: [] });
  await assert.rejects(
    getAiBuilderProjectWithDependencies("project-fixed", { identity: { userId: "user-fixed", displayName: "Ada", email: "ada@northstar.test" }, ensureSchema: async () => {}, sql }),
    /division by zero/,
  );
  assert.ok(state.verificationQueries > 0);
  assert.deepEqual(state.project.context_counts, originalCounts);
  assert.deepEqual(state.context, [foreignContext]);
  assert.deepEqual(state.faq, []);
});
