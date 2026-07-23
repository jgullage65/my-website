import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;
const db = databaseUrl ? test : test.skip;

db("project mutations reject stale competing writes and return authoritative revisions", async () => {
  process.env.DATABASE_URL = databaseUrl;
  const { ensureAiBuilderSchema } = await import("./ai-builder-schema");
  const { AiBuilderRevisionConflictError, mutateAiBuilderProjectForOwner } = await import("./ai-builder-repository");
  await ensureAiBuilderSchema();
  const pool = new Pool({ connectionString: databaseUrl });
  const projectId = `state-concurrency-${randomUUID()}`;
  const owner = `owner-${randomUUID()}`;
  await pool.query("INSERT INTO ai_builder_projects (id,status,business_name,industry,assistant_configuration,context_counts,clerk_user_id,created_at,updated_at) VALUES ($1,'ready','Original','test','{}'::jsonb,'{}'::jsonb,$2,NOW(),NOW())", [projectId, owner]);
  try {
    const writes = await Promise.allSettled([
      mutateAiBuilderProjectForOwner(projectId, owner, 0, "rename", "First"),
      mutateAiBuilderProjectForOwner(projectId, owner, 0, "rename", "Second"),
    ]);
    assert.equal(writes.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = writes.find((result) => result.status === "rejected") as PromiseRejectedResult;
    assert.ok(rejected.reason instanceof AiBuilderRevisionConflictError);
    assert.equal(rejected.reason.currentRevision, 1);
    const row = (await pool.query("SELECT business_name,state_revision FROM ai_builder_projects WHERE id=$1", [projectId])).rows[0];
    assert.equal(Number(row.state_revision), 1);
    assert.ok(row.business_name === "First" || row.business_name === "Second");

    const archived = await mutateAiBuilderProjectForOwner(projectId, owner, 1, "archive");
    assert.equal(archived?.stateRevision, 2);
    await assert.rejects(() => mutateAiBuilderProjectForOwner(projectId, owner, 1, "restore"), (error: unknown) => error instanceof AiBuilderRevisionConflictError && error.currentRevision === 2);
    const restored = await mutateAiBuilderProjectForOwner(projectId, owner, 2, "restore");
    assert.equal(restored?.stateRevision, 3);
  } finally {
    await pool.query("DELETE FROM ai_builder_projects WHERE id=$1", [projectId]);
    await pool.end();
  }
});

db("chat schema enforces per-thread sequence and exchange idempotency uniqueness", async () => {
  process.env.DATABASE_URL = databaseUrl;
  const { ensureAiBuilderSchema } = await import("./ai-builder-schema");
  await ensureAiBuilderSchema();
  const pool = new Pool({ connectionString: databaseUrl });
  const projectId = `chat-concurrency-${randomUUID()}`, threadId = `thread-${randomUUID()}`;
  await pool.query("INSERT INTO ai_builder_projects (id,status,business_name,industry,assistant_configuration,context_counts,created_at,updated_at) VALUES ($1,'ready','Chat','test','{}'::jsonb,'{}'::jsonb,NOW(),NOW())", [projectId]);
  await pool.query("INSERT INTO ai_builder_chat_threads (id,project_id) VALUES ($1,$2)", [threadId, projectId]);
  try {
    await pool.query("INSERT INTO ai_builder_chat_messages (id,thread_id,role,content,sequence) VALUES ($1,$2,'user','one',1),($3,$2,'assistant','two',2)", [`user-${randomUUID()}`, threadId, `assistant-${randomUUID()}`]);
    await assert.rejects(() => pool.query("INSERT INTO ai_builder_chat_messages (id,thread_id,role,content,sequence) VALUES ($1,$2,'user','duplicate',1)", [`duplicate-${randomUUID()}`, threadId]), (error: { code?:string }) => error.code === "23505");
    const ids = (await pool.query("SELECT id FROM ai_builder_chat_messages WHERE thread_id=$1 ORDER BY sequence", [threadId])).rows;
    await pool.query("INSERT INTO ai_builder_chat_exchanges (project_id,thread_id,idempotency_key,user_message_id,assistant_message_id,user_message_count) VALUES ($1,$2,'retry-key',$3,$4,1)", [projectId, threadId, ids[0].id, ids[1].id]);
    await assert.rejects(() => pool.query("INSERT INTO ai_builder_chat_exchanges (project_id,thread_id,idempotency_key,user_message_id,assistant_message_id,user_message_count) VALUES ($1,$2,'retry-key',$3,$4,1)", [projectId, threadId, ids[0].id, ids[1].id]), (error: { code?:string }) => error.code === "23505");
  } finally {
    await pool.query("DELETE FROM ai_builder_projects WHERE id=$1", [projectId]);
    await pool.end();
  }
});
