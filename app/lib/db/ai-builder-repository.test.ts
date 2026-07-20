import assert from "node:assert/strict";
import test from "node:test";

import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
import {
  buildLegacyProjectPersistenceQueries,
  persistAiBuilderProjectWithDependencies,
} from "./ai-builder-repository";

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

type Child = { projectId: string; content: string };
type State = { projects: Map<string, { owner: string; status: string }>; children: Map<string, Map<string, Child>>; progress: string[] };
const childTables = ["intake_blocks", "context_entries", "faq_entries", "conflicts", "missing_information", "chat_threads"];

function clone(state: State): State {
  return { projects: new Map(state.projects), children: new Map(Array.from(state.children).map(([key, value]) => [key, new Map(value)])), progress: [...state.progress] };
}

function fakeDatabase(options: { failAt?: string; owner?: string } = {}) {
  const state: State = { projects: new Map(options.owner ? [["project-1", { owner: options.owner, status: "existing" }]] : []), children: new Map(childTables.map((table) => [table, new Map()])), progress: ["old-progress"] };
  const sql = {
    transaction: async (build: (tx: never) => Array<{ queryData: { text: string; values: unknown[] } }>) => {
      const working = clone(state);
      const tag = ((strings: TemplateStringsArray, ...values: unknown[]) => ({ queryData: { text: strings.join("?").replace(/\s+/g, " ").trim(), values } })) as never;
      for (const query of build(tag)) {
        const { text, values } = query.queryData;
        if (options.failAt && text.includes(options.failAt)) throw new Error(`simulated_${options.failAt}`);
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
        } else if (text.includes("INSERT INTO ai_builder_progress")) {
          working.progress.push(values[1] as string);
        } else {
          const table = childTables.find((name) => text.includes(`INSERT INTO ai_builder_${name}`));
          if (table) {
            const id = values[0] as string; const projectId = values[1] as string;
            const existing = working.children.get(table)?.get(id);
            if (!existing || existing.projectId === projectId) working.children.get(table)?.set(id, { projectId, content: String(values[4] ?? values[3] ?? "") });
          }
        }
      }
      state.projects = working.projects; state.children = working.children; state.progress = working.progress;
    },
  };
  return { state, sql, options };
}

async function persist(db: ReturnType<typeof fakeDatabase>, project = input(), shadow = async () => {}) {
  return persistAiBuilderProjectWithDependencies(project, {
    identity: { userId: "user-1", displayName: "Ada", email: "ada@example.test" },
    ensureSchema: async () => {}, sql: db.sql as never, writeCanonicalProvenanceShadow: shadow as never,
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

test("canonical shadow failure runs after the committed legacy graph", async () => {
  const db = fakeDatabase();
  const originalError = console.error; console.error = () => {};
  try { await persist(db, input(), async () => { throw new Error("shadow failed"); }); } finally { console.error = originalError; }
  assertCompleteGraph(db.state);
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
