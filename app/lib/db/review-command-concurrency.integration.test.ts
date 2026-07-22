import assert from "node:assert/strict";
import test from "node:test";
import { neon, Pool } from "@neondatabase/serverless";
import type { AiBuilderSession } from "../ai-engine/contracts";
import { commandsFromLegacyReviewSession, UnsupportedLegacyReviewMutationError } from "../ai-engine/business-memory/legacy-review-command-adapter";

const databaseUrl = process.env.DATABASE_URL_TEST;

test("legacy snapshot compatibility rejects unsupported mutations before persistence", () => {
  const now = new Date().toISOString();
  const before = { id: "legacy-project", status: "review_required", governanceRevision: 0, intakeBlocks: [], faqEntries: [], conflicts: [], missingInformation: [], buildProgress: [], assistantConfiguration: {}, contextCounts: { total: 1, approved: 1, proposed: 0, archived: 0, byCategory: {} }, contextEntries: [{ id: "item-1", sessionId: "legacy-project", category: "business_profile", title: "Title", content: "Content", confidence: "high", confidenceScore: 1, status: "approved", source: { sourceType: "manual_intake", intakeBlockId: "intake-1", excerpt: "Content" }, metadata: { generated: false, userEdited: false, conflictingEntryIds: [], tags: [] }, createdAt: now, updatedAt: now }], createdAt: now, updatedAt: now, expiresAt: null } as unknown as AiBuilderSession;
  const after = structuredClone(before);
  after.contextEntries[0]!.status = "corrected";
  assert.throws(() => commandsFromLegacyReviewSession(before, after, { clerkUserId: "owner-1", displayName: null, email: null }), UnsupportedLegacyReviewMutationError);
});

test("legacy snapshot compatibility rejects all persisted non-command fields before persistence", () => {
  const now = "2026-07-22T00:00:00.000Z";
  const base = {
    id: "legacy-fields", status: "review_required", governanceRevision: 0, intakeBlocks: [], conflicts: [], missingInformation: [], buildProgress: [], assistantConfiguration: {},
    contextCounts: { total: 2, approved: 0, proposed: 2, archived: 0, byCategory: {} }, createdAt: now, updatedAt: now, expiresAt: null,
    contextEntries: [{ id: "context-1", sessionId: "legacy-fields", category: "service", title: "Service", content: "Content", confidence: "high", confidenceScore: .9, status: "proposed", source: { sourceType: "manual_intake", intakeBlockId: "intake-1", excerpt: "Content" }, metadata: { generated: false, userEdited: false, conflictingEntryIds: [], tags: [] }, createdAt: now, updatedAt: now }],
    faqEntries: [{ id: "faq-1", sessionId: "legacy-fields", question: "Question?", answer: "Answer.", confidence: "high", confidenceScore: .9, sourceEntryIds: ["context-1"], status: "proposed", metadata: { generated: true }, createdAt: now, updatedAt: now }],
  } as unknown as AiBuilderSession;
  const actor = { clerkUserId: "owner-1", displayName: null, email: null };
  const contextMutations = [
    (item: any) => { item.confidence = "low"; }, (item: any) => { item.confidenceScore = .1; },
    (item: any) => { item.metadata = { changed: true }; }, (item: any) => { item.source = { ...item.source, excerpt: "changed" }; },
    (item: any) => { item.sessionId = "other"; }, (item: any) => { item.createdAt = "2026-07-23T00:00:00.000Z"; },
    (item: any) => { item.updatedAt = "2026-07-23T00:00:00.000Z"; }, (item: any) => { item.persistedExtension = true; },
  ];
  const faqMutations = [
    (item: any) => { item.confidence = "low"; }, (item: any) => { item.confidenceScore = .1; },
    (item: any) => { item.metadata = { changed: true }; }, (item: any) => { item.sourceEntryIds = ["other"]; },
    (item: any) => { item.sessionId = "other"; }, (item: any) => { item.createdAt = "2026-07-23T00:00:00.000Z"; },
    (item: any) => { item.updatedAt = "2026-07-23T00:00:00.000Z"; }, (item: any) => { item.persistedExtension = true; },
  ];
  for (const mutate of contextMutations) {
    const submitted = structuredClone(base); mutate(submitted.contextEntries[0]);
    assert.throws(() => commandsFromLegacyReviewSession(base, submitted, actor), UnsupportedLegacyReviewMutationError);
  }
  for (const mutate of faqMutations) {
    const submitted = structuredClone(base); mutate(submitted.faqEntries[0]);
    assert.throws(() => commandsFromLegacyReviewSession(base, submitted, actor), UnsupportedLegacyReviewMutationError);
  }
});

test("real Postgres keeps aggregate counters separate from Business Knowledge readiness", {
  skip: databaseUrl ? false : "DATABASE_URL_TEST is not configured",
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const { ensureAiBuilderSchema } = await import("./ai-builder-schema");
  const { executePersistedReviewCommand } = await import("../ai-engine/business-memory/services/execute-persisted-review-command");
  const { NeonReviewCommandExecutionStore } = await import("../ai-engine/business-memory/persistence/neon-review-command-execution-store");
  await ensureAiBuilderSchema();
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  const ownerId = `readiness-owner-${crypto.randomUUID()}`;
  try {
    for (const scenario of [
      { name: "only-faq", context: false, faq: true, status: "review_required", approved: 1 },
      { name: "only-context", context: true, faq: false, status: "ready", approved: 1 },
      { name: "both", context: true, faq: true, status: "ready", approved: 2 },
      { name: "neither", context: false, faq: false, status: "review_required", approved: 0 },
    ]) {
      const projectId = `readiness-${scenario.name}-${crypto.randomUUID()}`;
      const contextId = `context-${crypto.randomUUID()}`; const faqId = `faq-${crypto.randomUUID()}`;
      await client.query("INSERT INTO ai_builder_projects (id,status,business_name,industry,assistant_configuration,context_counts,governance_revision,clerk_user_id,created_at,updated_at) VALUES ($1,'review_required','Readiness','test','{}'::jsonb,'{}'::jsonb,0,$2,NOW(),NOW())", [projectId, ownerId]);
      await client.query("INSERT INTO ai_builder_context_entries (id,project_id,category,title,content,confidence,confidence_score,status,source,metadata,created_at,updated_at) VALUES ($1,$2,'service','Service','Content','high',1,'proposed','{}'::jsonb,'{}'::jsonb,NOW(),NOW())", [contextId, projectId]);
      await client.query("INSERT INTO ai_builder_faq_entries (id,project_id,question,answer,confidence,confidence_score,source_entry_ids,status,metadata,created_at,updated_at) VALUES ($1,$2,'Question?','Answer.','high',1,'[]'::jsonb,'proposed','{}'::jsonb,NOW(),NOW())", [faqId, projectId]);
      let revision = 0;
      if (scenario.faq) { await executePersistedReviewCommand({ projectId, clerkUserId: ownerId, request: { commandId: crypto.randomUUID(), projectId, itemId: faqId, itemKind: "faq", clientRevision: revision++, expectedCurrentState: "proposed", kind: "approve" } }); }
      if (scenario.context) { await executePersistedReviewCommand({ projectId, clerkUserId: ownerId, request: { commandId: crypto.randomUUID(), projectId, itemId: contextId, itemKind: "context_entry", clientRevision: revision++, expectedCurrentState: "proposed", kind: "approve" } }); }
      await new NeonReviewCommandExecutionStore(client, projectId).transaction(`read-model-${scenario.name}`, async (transaction) => transaction.updateReviewReadModels({ projectId, itemKind: "context_entry", previousState: "proposed", newState: "proposed" }));
      const row = (await client.query("SELECT status, context_counts FROM ai_builder_projects WHERE id=$1", [projectId])).rows[0];
      assert.equal(row.status, scenario.status, scenario.name);
      assert.deepEqual(row.context_counts, { total: 2, approved: scenario.approved, proposed: 2 - scenario.approved, archived: 0, byCategory: { service: 1 } }, scenario.name);
    }
  } finally {
    await client.query("DELETE FROM ai_builder_projects WHERE clerk_user_id=$1", [ownerId]).catch(() => undefined);
    client.release(); await pool.end();
  }
});

test("real Postgres serializes, replays, and atomically commits review commands", {
  skip: databaseUrl ? false : "DATABASE_URL_TEST is not configured",
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const { ensureAiBuilderSchema } = await import("./ai-builder-schema");
  const { executePersistedReviewCommand } = await import("../ai-engine/business-memory/services/execute-persisted-review-command");
  await ensureAiBuilderSchema();

  const pool = new Pool({ connectionString: databaseUrl });
  const projectId = `review-concurrency-${crypto.randomUUID()}`;
  const ownerId = `owner-${crypto.randomUUID()}`;
  const itemId = `item-${crypto.randomUUID()}`;
  const secondItemId = `item-${crypto.randomUUID()}`;
  const commandId = `command-${crypto.randomUUID()}`;
  const client = await pool.connect();
  try {
    await client.query("INSERT INTO ai_builder_projects (id,status,business_name,industry,assistant_configuration,context_counts,governance_revision,clerk_user_id,created_at,updated_at) VALUES ($1,'review_required','Concurrency test','test','{}'::jsonb,'{}'::jsonb,0,$2,NOW(),NOW())", [projectId, ownerId]);
    for (const id of [itemId, secondItemId]) await client.query("INSERT INTO ai_builder_context_entries (id,project_id,category,title,content,confidence,confidence_score,status,source,metadata,created_at,updated_at) VALUES ($1,$2,'business_profile','Test','Test','high',1,'proposed','{}'::jsonb,'{}'::jsonb,NOW(),NOW())", [id, projectId]);
    await client.query("INSERT INTO ai_builder_faq_entries (id,project_id,question,answer,confidence,confidence_score,source_entry_ids,status,metadata,created_at,updated_at) VALUES ($1,$2,'Question?','Answer.','high',1,'[]'::jsonb,'proposed','{}'::jsonb,NOW(),NOW())", [`faq-${crypto.randomUUID()}`, projectId]);

    const request = { commandId, projectId, itemId, itemKind: "context_entry" as const, clientRevision: 0, expectedCurrentState: "proposed" as const, kind: "approve" as const };
    const simultaneous = await Promise.all([
      executePersistedReviewCommand({ projectId, clerkUserId: ownerId, request }),
      executePersistedReviewCommand({ projectId, clerkUserId: ownerId, request }),
    ]);
    assert.deepEqual(simultaneous.map((value) => value.result.disposition).sort(), ["executed", "replayed"]);
    assert.equal(simultaneous[0].result.resultingRevision, 1);
    assert.deepEqual(simultaneous[0].result.history, simultaneous[1].result.history);

    // Simulate a response lost after commit: the caller submits the identical
    // request again without having observed the first response.
    const retry = await executePersistedReviewCommand({ projectId, clerkUserId: ownerId, request });
    assert.equal(retry.result.disposition, "replayed");

    const competing = await Promise.allSettled([
      executePersistedReviewCommand({ projectId, clerkUserId: ownerId, request: { ...request, commandId: `command-${crypto.randomUUID()}`, itemId: secondItemId, clientRevision: 1 } }),
      executePersistedReviewCommand({ projectId, clerkUserId: ownerId, request: { ...request, commandId: `command-${crypto.randomUUID()}`, itemId: secondItemId, clientRevision: 1 } }),
    ]);
    assert.equal(competing.filter((value) => value.status === "fulfilled").length, 1);
    assert.equal(competing.filter((value) => value.status === "rejected").length, 1);

    const state = (await client.query(`
      SELECT p.governance_revision, p.context_counts,
        (SELECT COUNT(*) FROM ai_builder_review_command_history h WHERE h.project_id=p.id) history_count,
        (SELECT COUNT(*) FROM ai_builder_review_command_ledger l WHERE l.project_id=p.id) ledger_count,
        (SELECT COUNT(*) FROM ai_builder_context_entries i WHERE i.project_id=p.id AND i.status='approved') approved_count
      FROM ai_builder_projects p WHERE p.id=$1
    `, [projectId])).rows[0];
    assert.deepEqual({ revision: Number(state.governance_revision), history: Number(state.history_count), ledger: Number(state.ledger_count), approved: Number(state.approved_count) }, { revision: 2, history: 2, ledger: 2, approved: 2 });
    assert.deepEqual(state.context_counts, { total: 3, approved: 2, proposed: 1, archived: 0, byCategory: { business_profile: 2 } });
  } finally {
    await client.query("DELETE FROM ai_builder_projects WHERE id=$1", [projectId]).catch(() => undefined);
    client.release();
    await pool.end();
  }
});

test("real Postgres rolls back an earlier legacy command when a later command fails", {
  skip: databaseUrl ? false : "DATABASE_URL_TEST is not configured",
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const { ensureAiBuilderSchema } = await import("./ai-builder-schema");
  const { executePersistedReviewCommandsAtomically } = await import("../ai-engine/business-memory/services/execute-persisted-review-command");
  await ensureAiBuilderSchema();
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  const projectId = `review-rollback-${crypto.randomUUID()}`;
  const ownerId = `owner-${crypto.randomUUID()}`;
  const firstId = `item-${crypto.randomUUID()}`;
  const secondId = `item-${crypto.randomUUID()}`;
  try {
    await client.query("INSERT INTO ai_builder_projects (id,status,business_name,industry,assistant_configuration,context_counts,governance_revision,clerk_user_id,created_at,updated_at) VALUES ($1,'review_required','Rollback test','test','{}'::jsonb,'{}'::jsonb,0,$2,NOW(),NOW())", [projectId, ownerId]);
    for (const id of [firstId, secondId]) await client.query("INSERT INTO ai_builder_context_entries (id,project_id,category,title,content,confidence,confidence_score,status,source,metadata,created_at,updated_at) VALUES ($1,$2,'business_profile','Test','Test','high',1,'proposed','{}'::jsonb,'{}'::jsonb,NOW(),NOW())", [id, projectId]);
    await assert.rejects(() => executePersistedReviewCommandsAtomically({ projectId, clerkUserId: ownerId, requests: [
      { commandId: `command-${crypto.randomUUID()}`, projectId, itemId: firstId, itemKind: "context_entry", clientRevision: 0, expectedCurrentState: "proposed", kind: "approve" },
      { commandId: `command-${crypto.randomUUID()}`, projectId, itemId: secondId, itemKind: "context_entry", clientRevision: 1, expectedCurrentState: "approved", kind: "unapprove" },
    ] }));
    const state = (await client.query("SELECT governance_revision, (SELECT COUNT(*) FROM ai_builder_context_entries WHERE project_id=$1 AND status='approved') approved, (SELECT COUNT(*) FROM ai_builder_review_command_history WHERE project_id=$1) history, (SELECT COUNT(*) FROM ai_builder_review_command_ledger WHERE project_id=$1) ledger FROM ai_builder_projects WHERE id=$1", [projectId])).rows[0];
    assert.deepEqual({ revision: Number(state.governance_revision), approved: Number(state.approved), history: Number(state.history), ledger: Number(state.ledger) }, { revision: 0, approved: 0, history: 0, ledger: 0 });
  } finally {
    await client.query("DELETE FROM ai_builder_projects WHERE id=$1", [projectId]).catch(() => undefined);
    client.release(); await pool.end();
  }
});

test("real Postgres enforces the lifetime project limit including archived projects", {
  skip: databaseUrl ? false : "DATABASE_URL_TEST is not configured",
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const { ensureAiBuilderSchema } = await import("./ai-builder-schema");
  const { AI_BUILDER_PROJECT_LIMIT_ERROR, persistAiBuilderProjectWithDependencies } = await import("./ai-builder-repository");
  await ensureAiBuilderSchema();
  const ownerId = `limit-owner-${crypto.randomUUID()}`;
  const sql = neon(databaseUrl!);
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  const now = new Date().toISOString();
  try {
    for (let index = 0; index < 3; index += 1) await client.query("INSERT INTO ai_builder_projects (id,status,business_name,industry,assistant_configuration,context_counts,clerk_user_id,created_at,updated_at,archived_at) VALUES ($1,'review_required','Limit test','test','{}'::jsonb,'{}'::jsonb,$2,NOW(),NOW(),CASE WHEN $3 THEN NOW() ELSE NULL END)", [`limit-existing-${index}-${crypto.randomUUID()}`, ownerId, index === 0]);
    const projectId = `limit-rejected-${crypto.randomUUID()}`;
    const session = { id: projectId, status: "review_required", governanceRevision: 0, intakeBlocks: [], contextEntries: [], faqEntries: [], conflicts: [], missingInformation: [], buildProgress: [], assistantConfiguration: {}, contextCounts: { total: 0, approved: 0, proposed: 0, archived: 0, byCategory: {} }, createdAt: now, updatedAt: now, expiresAt: null } as unknown as AiBuilderSession;
    await assert.rejects(() => persistAiBuilderProjectWithDependencies({ session, businessName: "Rejected", industry: "test", website: null, websiteKnowledge: null, initialThread: { id: `thread-${crypto.randomUUID()}`, memory: {} as never } }, {
      identity: { userId: ownerId, displayName: null, email: null } as never,
      ensureSchema: async () => undefined,
      sql: sql as never,
      buildCanonicalProvenanceShadowQueries: (() => []) as never,
    }), (error: unknown) => error instanceof Error && error.message.includes(AI_BUILDER_PROJECT_LIMIT_ERROR));
    const rejected = await client.query("SELECT 1 FROM ai_builder_projects WHERE id=$1", [projectId]);
    assert.equal(rejected.rowCount, 0);
  } finally {
    await client.query("DELETE FROM ai_builder_projects WHERE clerk_user_id=$1", [ownerId]).catch(() => undefined);
    client.release(); await pool.end();
  }
});
