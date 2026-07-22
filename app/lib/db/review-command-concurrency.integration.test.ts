import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL_TEST;

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
      SELECT p.governance_revision,
        (SELECT COUNT(*) FROM ai_builder_review_command_history h WHERE h.project_id=p.id) history_count,
        (SELECT COUNT(*) FROM ai_builder_review_command_ledger l WHERE l.project_id=p.id) ledger_count,
        (SELECT COUNT(*) FROM ai_builder_context_entries i WHERE i.project_id=p.id AND i.status='approved') approved_count
      FROM ai_builder_projects p WHERE p.id=$1
    `, [projectId])).rows[0];
    assert.deepEqual({ revision: Number(state.governance_revision), history: Number(state.history_count), ledger: Number(state.ledger_count), approved: Number(state.approved_count) }, { revision: 2, history: 2, ledger: 2, approved: 2 });
  } finally {
    await client.query("DELETE FROM ai_builder_projects WHERE id=$1", [projectId]).catch(() => undefined);
    client.release();
    await pool.end();
  }
});
