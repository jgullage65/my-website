import assert from "node:assert/strict";
import test from "node:test";

import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
import { websiteFactIdentity } from "@/app/lib/ai-engine/knowledge/websiteKnowledge";
import {
  buildLegacyProjectPersistenceQueries,
  persistAiBuilderProjectWithDependencies,
} from "./ai-builder-repository";
import { buildCanonicalProvenanceShadowQueries } from "./canonical-provenance-shadow";
import { buildExpectedCanonicalProjection } from "./canonical-provenance-reconciliation";

const timestamp = "2026-07-20T10:00:00.000Z";
const input = (status = "review") => ({
  session: {
    id: "project-1", status, createdAt: timestamp, updatedAt: timestamp,
    expiresAt: "2026-07-21T10:00:00.000Z", assistantConfiguration: {}, contextCounts: {},
    intakeBlocks: [{ id: "intake-1", label: "Services", content: "Planning", createdAt: timestamp, updatedAt: timestamp }],
    contextEntries: [{ id: "context-1", category: "services", title: "Planning", content: "Planning", confidence: "high", confidenceScore: 0.9, status: "proposed", source: { sourceType: "manual_intake", intakeBlockId: "intake-1" }, metadata: { generated: true }, createdAt: timestamp, updatedAt: timestamp }],
    faqEntries: [{ id: "faq-1", question: "What do you do?", answer: "Planning", confidence: "high", confidenceScore: 0.9, sourceEntryIds: ["context-1"], status: "proposed", createdAt: timestamp, updatedAt: timestamp }],
    conflicts: [{ id: "conflict-1", topic: "Pricing", firstStatement: "A", secondStatement: "B", sourceExcerpts: [], suggestedQuestion: "Which?", resolved: false, resolution: null }],
    missingInformation: [{ id: "missing-1", topic: "Hours", reason: "Missing", suggestedQuestion: "When?", resolved: false }],
    buildProgress: [{ stage: "intake", message: "Complete", completed: true, count: 1, createdAt: timestamp }],
  } as unknown as AiBuilderSession,
  businessName: "Acme", industry: "Consulting", website: null, websiteKnowledge: null,
  initialThread: { id: "thread-1", memory: {} as never },
});

type Child = { projectId: string; content: string; status?: string };
type State = { projects: Map<string, { owner: string; status: string }>; children: Map<string, Map<string, Child>>; progress: string[] };
const childTables = ["intake_blocks", "context_entries", "faq_entries", "conflicts", "missing_information", "chat_threads"];

function clone(state: State): State {
  return { projects: new Map(state.projects), children: new Map(Array.from(state.children).map(([key, value]) => [key, new Map(value)])), progress: [...state.progress] };
}

function fakeDatabase(options: { failAt?: string; failWhen?: (text: string, values: unknown[]) => boolean; owner?: string } = {}) {
  const state: State = { projects: new Map(options.owner ? [["project-1", { owner: options.owner, status: "existing" }]] : []), children: new Map(childTables.map((table) => [table, new Map()])), progress: ["old-progress"] };
  const sql = {
    transaction: async (build: (tx: never) => Array<{ queryData: { text: string; values: unknown[] } }>) => {
      const working = clone(state);
      const tag = ((strings: TemplateStringsArray, ...values: unknown[]) => ({ queryData: { text: strings.join("?").replace(/\s+/g, " ").trim(), values } })) as never;
      for (const query of build(tag)) {
        const { text, values } = query.queryData;
        if (options.failAt && text.includes(options.failAt)) throw new Error(`simulated_${options.failAt}`);
        if (options.failWhen?.(text, values)) throw new Error("simulated_query_failure");
        if (text.includes("ai_builder_canonical_")) continue;
        if (text.includes("INSERT INTO ai_builder_projects")) {
          const [id, status] = values as [string, string];
          const owner = values[11] as string;
          const existing = working.projects.get(id);
          if (!existing || existing.owner === owner) working.projects.set(id, { owner, status });
        } else if (text.includes("child_ownership_verified")) {
          const table = childTables.find((name) => text.includes(`ai_builder_${name}`));
          const [id, projectId] = values as [string, string];
          if (!table || working.children.get(table)?.get(id)?.projectId !== projectId) throw new Error("AI_BUILDER_CHILD_OWNERSHIP_COLLISION");
        } else if (text.includes("ownership_verified")) {
          const [id, owner] = values as [string, string];
          if (working.projects.get(id)?.owner !== owner) throw new Error("AI_BUILDER_PROJECT_OWNERSHIP_COLLISION");
        } else if (text.includes("DELETE FROM ai_builder_progress")) {
          working.progress = [];
        } else if (text.startsWith("DELETE FROM ai_builder_")) {
          const table = childTables.find((name) => text.includes(`DELETE FROM ai_builder_${name}`));
          if (table) {
            const [projectId, submittedIds] = values as [string, string[] | undefined];
            for (const [id, child] of working.children.get(table) ?? []) {
              if (child.projectId === projectId && (!submittedIds || !submittedIds.includes(id))) working.children.get(table)?.delete(id);
            }
          }
        } else if (text.includes("INSERT INTO ai_builder_progress")) {
          working.progress.push(values[1] as string);
        } else {
          const table = childTables.find((name) => text.includes(`INSERT INTO ai_builder_${name}`));
          if (table) {
            const id = values[0] as string; const projectId = values[1] as string;
            const existing = working.children.get(table)?.get(id);
            if (!existing || existing.projectId === projectId) working.children.get(table)?.set(id, { projectId, content: String(values[4] ?? values[3] ?? ""), status: table === "context_entries" || table === "faq_entries" ? String(values[7]) : undefined });
          }
        }
      }
      state.projects = working.projects; state.children = working.children; state.progress = working.progress;
    },
  };
  return { state, sql, options };
}

function seedAuthoritativeChildren(state: State, projectId: string, suffix: "1" | "2" | "3" = "2") {
  for (const table of childTables.filter((table) => table !== "chat_threads")) {
    const prefix = table === "intake_blocks" ? "intake" : table === "context_entries" ? "context" : table === "faq_entries" ? "faq" : table === "missing_information" ? "missing" : "conflict";
    state.children.get(table)?.set(`${prefix}-${suffix}`, { projectId, content: `${table}-${suffix}` });
  }
}

function reducedInput() {
  return input();
}

async function persist(db: ReturnType<typeof fakeDatabase>, project = input()) {
  return persistAiBuilderProjectWithDependencies(project, {
    identity: { userId: "user-1", displayName: "Ada", email: "ada@example.test" },
    ensureSchema: async () => {}, sql: db.sql as never, buildCanonicalProvenanceShadowQueries,
  });
}

function assertCompleteGraph(state: State) {
  assert.equal(state.projects.size, 1);
  for (const table of childTables) assert.equal(state.children.get(table)?.size, 1, table);
  assert.deepEqual(state.progress, ["intake"]);
}

test("a child failure rolls back the new project graph, and retry commits one graph", async () => {
  const db = fakeDatabase({ failAt: "ai_builder_context_entries" });
  await assert.rejects(persist(db));
  assert.equal(db.state.projects.size, 0);
  for (const table of childTables) assert.equal(db.state.children.get(table)?.size, 0, table);
  assert.deepEqual(db.state.progress, ["old-progress"]);

  db.options.failAt = undefined;
  await persist(db);
  await persist(db);
  assertCompleteGraph(db.state);
});

test("another Clerk owner aborts before child data changes", async () => {
  const db = fakeDatabase({ owner: "other-user" });
  await assert.rejects(persist(db), /AI_BUILDER_PROJECT_OWNERSHIP_COLLISION/);
  assert.equal(db.state.projects.get("project-1")?.owner, "other-user");
  for (const table of childTables) assert.equal(db.state.children.get(table)?.size, 0, table);
  assert.deepEqual(db.state.progress, ["old-progress"]);
});

test("canonical provenance failure rolls back the complete legacy graph", async () => {
  const db = fakeDatabase({ failAt: "ai_builder_canonical_sources" });
  await assert.rejects(persist(db));
  assert.equal(db.state.projects.size, 0);
  for (const table of childTables) assert.equal(db.state.children.get(table)?.size, 0, table);
  assert.deepEqual(db.state.progress, ["old-progress"]);
});

test("same-owner re-persist upserts the project and atomically replaces progress", async () => {
  const db = fakeDatabase();
  await persist(db, input("review"));
  const updated = input("ready");
  updated.session.buildProgress = [{ stage: "complete", message: "Ready", completed: false, count: 2, createdAt: timestamp }];
  await persist(db, updated);
  assert.equal(db.state.projects.get("project-1")?.status, "ready");
  assert.deepEqual(db.state.progress, ["complete"]);
  assertCompleteGraph({ ...db.state, progress: ["intake"] });
});

test("a context id owned by another project aborts without changing either graph", async () => {
  const db = fakeDatabase();
  db.state.children.get("context_entries")?.set("context-1", { projectId: "project-other", content: "Other project content" });
  await assert.rejects(persist(db), /AI_BUILDER_CHILD_OWNERSHIP_COLLISION/);
  assert.deepEqual(db.state.children.get("context_entries")?.get("context-1"), { projectId: "project-other", content: "Other project content" });
  assert.equal(db.state.projects.size, 0);
  for (const table of childTables.filter((table) => table !== "context_entries")) assert.equal(db.state.children.get(table)?.size, 0, table);
  assert.deepEqual(db.state.progress, ["old-progress"]);
});

test("a late chat-thread collision rolls back the complete ordered graph", async () => {
  const db = fakeDatabase();
  db.state.children.get("chat_threads")?.set("thread-1", { projectId: "project-other", content: "Other memory" });
  await assert.rejects(persist(db), /AI_BUILDER_CHILD_OWNERSHIP_COLLISION/);
  assert.equal(db.state.projects.size, 0);
  for (const table of childTables.filter((table) => table !== "chat_threads")) assert.equal(db.state.children.get(table)?.size, 0, table);
  assert.deepEqual(db.state.children.get("chat_threads")?.get("thread-1"), { projectId: "project-other", content: "Other memory" });
  assert.deepEqual(db.state.progress, ["old-progress"]);
});

test("reconciliation removes stale authoritative rows but preserves submitted rows, progress, and chat", async () => {
  const db = fakeDatabase();
  await persist(db);
  seedAuthoritativeChildren(db.state, "project-1");
  await persist(db, reducedInput());
  for (const table of childTables.filter((table) => table !== "chat_threads")) {
    assert.equal(db.state.children.get(table)?.size, 1, table);
    assert.equal([...db.state.children.get(table)?.values() ?? []][0]?.projectId, "project-1");
  }
  assert.equal(db.state.projects.size, 1);
  assert.deepEqual(db.state.progress, ["intake"]);
  assert.equal(db.state.children.get("chat_threads")?.size, 1);
});

test("empty authoritative collections clear only their project rows without invalid SQL", async () => {
  const db = fakeDatabase();
  await persist(db);
  seedAuthoritativeChildren(db.state, "project-1");
  const empty = input();
  empty.session.intakeBlocks = [];
  empty.session.contextEntries = [];
  empty.session.faqEntries = [];
  empty.session.conflicts = [];
  empty.session.missingInformation = [];
  await persist(db, empty);
  for (const table of childTables.filter((table) => table !== "chat_threads")) assert.equal(db.state.children.get(table)?.size, 0, table);
  assert.deepEqual(db.state.progress, ["intake"]);
  assert.equal(db.state.children.get("chat_threads")?.size, 1);
});

test("reconciliation never deletes another project's authoritative rows", async () => {
  const db = fakeDatabase();
  await persist(db);
  seedAuthoritativeChildren(db.state, "project-1", "2");
  seedAuthoritativeChildren(db.state, "project-other", "3");
  await persist(db, reducedInput());
  for (const table of childTables.filter((table) => table !== "chat_threads")) {
    const prefix = table === "intake_blocks" ? "intake" : table === "context_entries" ? "context" : table === "faq_entries" ? "faq" : table === "missing_information" ? "missing" : "conflict";
    assert.equal(db.state.children.get(table)?.has(`${prefix}-2`), false, table);
    const foreignRow = db.state.children.get(table)?.get(`${prefix}-3`);
    assert.ok(foreignRow, table);
    assert.equal(foreignRow.projectId, "project-other", table);
  }
});

test("archived submitted context and FAQ entries remain in the authoritative collections", async () => {
  const db = fakeDatabase();
  const archived = input();
  archived.session.contextEntries[0].status = "archived";
  archived.session.faqEntries[0].status = "archived";
  await persist(db, archived);
  assert.equal(db.state.children.get("context_entries")?.get("context-1")?.status, "archived");
  assert.equal(db.state.children.get("faq_entries")?.get("faq-1")?.status, "archived");
});

test("a child collision rolls cleanup and all later writes back", async () => {
  const db = fakeDatabase();
  db.state.projects.set("project-1", { owner: "user-1", status: "existing" });
  seedAuthoritativeChildren(db.state, "project-1");
  db.state.children.get("context_entries")?.set("context-1", { projectId: "project-other", content: "foreign" });
  const original = clone(db.state);
  await assert.rejects(persist(db), /AI_BUILDER_CHILD_OWNERSHIP_COLLISION/);
  assert.deepEqual(db.state, original);
});

test("late chat-thread failure restores rows targeted by stale cleanup", async () => {
  const db = fakeDatabase();
  db.state.projects.set("project-1", { owner: "user-1", status: "existing" });
  seedAuthoritativeChildren(db.state, "project-1");
  db.state.children.get("chat_threads")?.set("thread-1", { projectId: "project-other", content: "foreign" });
  const original = clone(db.state);
  await assert.rejects(persist(db), /AI_BUILDER_CHILD_OWNERSHIP_COLLISION/);
  assert.deepEqual(db.state, original);
});

test("the transaction batch protects and verifies every child upsert", () => {
  const statements: Array<{ text: string; values: unknown[] }> = [];
  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim(); statements.push({ text, values }); return { queryData: { text, values } };
  }) as never;
  buildLegacyProjectPersistenceQueries(sql, { ...input(), identity: { userId: "user-1", displayName: "Ada", email: "ada@example.test" } });
  assert.match(statements[1].text, /AI_BUILDER_PROJECT_OWNERSHIP_COLLISION/);
  assert.match(statements[1].text, /WHERE id = \? AND clerk_user_id = \?/);
  for (const table of childTables) {
    const upsert = statements.find(({ text }) => text.includes(`INSERT INTO ai_builder_${table}`));
    const verification = statements.find(({ text }) => text.includes(`FROM ai_builder_${table}`) && text.includes("child_ownership_verified"));
    assert.match(upsert?.text ?? "", new RegExp(`WHERE ai_builder_${table}\\.project_id = EXCLUDED\\.project_id`));
    assert.match(verification?.text ?? "", /AI_BUILDER_CHILD_OWNERSHIP_COLLISION/);
    assert.match(verification?.text ?? "", /WHERE id = \? AND project_id = \?/);
    assert.deepEqual(verification?.values, [table === "chat_threads" ? "thread-1" : `${table === "intake_blocks" ? "intake" : table === "context_entries" ? "context" : table === "faq_entries" ? "faq" : table === "missing_information" ? "missing" : "conflict"}-1`, "project-1"]);
  }
  assert.ok(statements.findIndex(({ text }) => text.includes("ownership_verified")) < statements.findIndex(({ text }) => text.includes("INSERT INTO ai_builder_intake_blocks")));
});

test("the transaction batch reconciles every authoritative collection in dependency-safe order", () => {
  const statements: Array<{ text: string; values: unknown[] }> = [];
  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim(); statements.push({ text, values }); return { queryData: { text, values } };
  }) as never;
  buildLegacyProjectPersistenceQueries(sql, { ...input(), identity: { userId: "user-1", displayName: "Ada", email: "ada@example.test" } });
  const authoritative = ["faq_entries", "context_entries", "intake_blocks", "conflicts", "missing_information"];
  const cleanupIndexes = authoritative.map((table) => {
    const index = statements.findIndex(({ text }) => text.includes(`DELETE FROM ai_builder_${table}`));
    assert.ok(index >= 0, table);
    assert.match(statements[index]!.text, /WHERE project_id = \? AND id <> ALL\(\?\)/);
    assert.deepEqual(statements[index]!.values[0], "project-1");
    assert.ok(Array.isArray(statements[index]!.values[1]));
    return index;
  });
  assert.deepEqual(cleanupIndexes, [...cleanupIndexes].sort((a, b) => a - b));
  const lastChildVerification = Math.max(...statements.map(({ text }, index) => text.includes("child_ownership_verified") && !text.includes("ai_builder_chat_threads") ? index : -1));
  assert.ok(lastChildVerification < cleanupIndexes[0]!);
  assert.ok(cleanupIndexes.at(-1)! < statements.findIndex(({ text }) => text.includes("DELETE FROM ai_builder_progress")));
  assert.equal(statements.some(({ text }) => text.includes("DELETE FROM ai_builder_chat_threads") || text.includes("DELETE FROM ai_builder_chat_messages")), false);

  const empty = input();
  empty.session.intakeBlocks = []; empty.session.contextEntries = []; empty.session.faqEntries = []; empty.session.conflicts = []; empty.session.missingInformation = [];
  const emptyStatements: Array<{ text: string; values: unknown[] }> = [];
  const emptySql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim(); emptyStatements.push({ text, values }); return { queryData: { text, values } };
  }) as never;
  buildLegacyProjectPersistenceQueries(emptySql, { ...empty, identity: { userId: "user-1", displayName: "Ada", email: "ada@example.test" } });
  for (const table of authoritative) {
    const statement = emptyStatements.find(({ text }) => text.includes(`DELETE FROM ai_builder_${table}`));
    assert.match(statement?.text ?? "", /WHERE project_id = \?$/);
    assert.deepEqual(statement?.values, ["project-1"]);
  }
});

test("project, progress, and canonical persistence failures each abort the one creation batch", async () => {
  for (const failurePoint of ["INSERT INTO ai_builder_projects", "INSERT INTO ai_builder_progress", "ai_builder_canonical_sources"]) {
    const db = fakeDatabase({ failAt: failurePoint });
    await assert.rejects(persist(db));
    assert.equal(db.state.projects.size, 0, failurePoint);
    for (const table of childTables) assert.equal(db.state.children.get(table)?.size, 0, `${failurePoint}:${table}`);
    assert.deepEqual(db.state.progress, ["old-progress"], failurePoint);
  }
});

test("canonical provenance statements are appended to the authoritative creation transaction", () => {
  const statements: string[] = [];
  const sql = ((strings: TemplateStringsArray, ..._values: unknown[]) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    statements.push(text);
    return { queryData: { text, values: [] } };
  }) as never;
  const project = input();
  const legacy = buildLegacyProjectPersistenceQueries(sql, { ...project, identity: { userId: "user-1", displayName: "Ada", email: "ada@example.test" } });
  const canonical = buildCanonicalProvenanceShadowQueries(sql, { projectId: project.session.id, session: project.session, website: project.website, websiteKnowledge: project.websiteKnowledge });
  assert.ok(legacy.length > 0);
  assert.ok(canonical.length > 0);
  assert.ok(statements.findIndex((text) => text.includes("INSERT INTO ai_builder_chat_threads")) < statements.findIndex((text) => text.includes("INSERT INTO ai_builder_canonical_sources")));
  assert.ok(statements.some((text) => text.includes("AI_BUILDER_CANONICAL_PROVENANCE_OWNERSHIP_COLLISION")));
  assert.ok(statements.some((text) => text.includes("INSERT INTO ai_builder_canonical_candidate_claims")));
});

test("canonical candidate-evidence verification uses typed projection fields without integer-cast sentinels", () => {
  const project = input();
  const expectedLinks = buildExpectedCanonicalProjection({
    projectId: project.session.id,
    session: project.session,
    website: project.website,
    websiteKnowledge: project.websiteKnowledge,
  }).filter((record) => record.type === "candidate_evidence_link");
  const statements = canonicalClaimStatements(project).filter(({ text }) => text.includes("canonical_candidate_evidence_link_verified"));

  assert.equal(statements.length, expectedLinks.length);
  assert.deepEqual(
    statements.map(({ values }) => values.slice(0, 2)),
    expectedLinks.map((record) => [record.fields.candidateClaim, record.fields.evidence]),
  );
  assert.ok(statements.every(({ text }) => !text.includes("AI_BUILDER_CANONICAL_PROVENANCE_INCOMPLETE") && !text.includes("CAST(")));
});


function withWebsiteContext(project = input()) {
  const fact = { category: "service", title: "Website planning", value: "Website planning", confidence: "high", evidence: [{ url: "https://acme.test/services", excerpt: "Planning services" }, { url: "https://acme.test/about", excerpt: "Experienced planners" }] } as const;
  const websiteKnowledge = {
    schema_version: 1, document_version: 1, current_crawl_attempt_id: "crawl-1", imported_at: timestamp,
    requested_url: "https://acme.test/", resolved_url: "https://acme.test/", pages: [], warnings: [],
    knowledge: { facts: [fact], coverage: { businessIdentity: 0, offers: 100, customers: 0, pricing: 0, policies: 0, processes: 0, faq: 0, contact: 0, overall: 10 }, unresolvedQuestions: [] },
  } as never;
  const websiteContextId = websiteFactIdentity(fact);
  project.website = "https://acme.test/";
  project.websiteKnowledge = websiteKnowledge;
  project.session.contextEntries.push({ id: websiteContextId, category: "services", title: fact.title, content: fact.value, confidence: "high", confidenceScore: 0.9, status: "proposed", source: { sourceType: "website", intakeBlockId: "website_knowledge", sourceUrl: fact.evidence[0].url, excerpt: fact.evidence[0].excerpt }, metadata: { generated: true }, createdAt: timestamp, updatedAt: timestamp });
  return { project, websiteContextId };
}

function canonicalClaimStatements(project: ReturnType<typeof input>): Array<{ text: string; values: unknown[] }> {
  const statements: Array<{ text: string; values: unknown[] }> = [];
  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    const statement = { text, values }; statements.push(statement); return { queryData: statement };
  }) as never;
  buildCanonicalProvenanceShadowQueries(sql, { projectId: project.session.id, session: project.session, website: project.website, websiteKnowledge: project.websiteKnowledge });
  return statements;
}

function faqClaim(statements: Array<{ text: string; values: unknown[] }>) {
  return statements.find(({ values }) => String(values[10]).includes("legacyFaqEntryId"));
}

test("manual FAQ provenance uses its context entry provenance", () => {
  const claim = faqClaim(canonicalClaimStatements(input()));
  assert.ok(claim);
  assert.equal(claim.values[3], "faq");
});

test("website FAQ provenance uses website context evidence from one snapshot", () => {
  const { project, websiteContextId } = withWebsiteContext();
  project.session.faqEntries = [{ ...project.session.faqEntries[0], sourceEntryIds: [websiteContextId] }];
  const statements = canonicalClaimStatements(project);
  const claim = faqClaim(statements);
  assert.ok(claim);
  const links = statements.filter(({ text, values }) => text.includes("candidate_claim_evidence") && values.some((value) => value === claim.values[0]));
  assert.equal(links.length, 4);
});

test("FAQ provenance combines multiple context evidence records from one snapshot", () => {
  const { project, websiteContextId } = withWebsiteContext();
  project.session.faqEntries = [{ ...project.session.faqEntries[0], sourceEntryIds: [websiteContextId, websiteContextId] }];
  const statements = canonicalClaimStatements(project);
  const claim = faqClaim(statements);
  assert.ok(claim);
  const links = statements.filter(({ text, values }) => text.includes("candidate_claim_evidence") && values.some((value) => value === claim.values[0]));
  assert.equal(links.length, 4);
});

test("mixed-snapshot FAQ provenance is skipped", () => {
  const { project, websiteContextId } = withWebsiteContext();
  project.session.faqEntries = [{ ...project.session.faqEntries[0], sourceEntryIds: ["context-1", websiteContextId] }];
  assert.equal(faqClaim(canonicalClaimStatements(project)), undefined);
});

test("FAQ canonical persistence failure rolls back the atomic project graph", async () => {
  const db = fakeDatabase({ failWhen: (text, values) => text.includes("INSERT INTO ai_builder_canonical_candidate_claims") && String(values[10]).includes("legacyFaqEntryId") });
  await assert.rejects(persist(db));
  assert.equal(db.state.projects.size, 0);
  for (const table of childTables) assert.equal(db.state.children.get(table)?.size, 0, table);
  assert.deepEqual(db.state.progress, ["old-progress"]);
});
