import "server-only";

import { getSql } from "./client";

let schemaPromise: Promise<void> | null = null;

async function createAiBuilderSchema() {
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS ai_builder_projects (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      business_name TEXT NOT NULL,
      industry TEXT NOT NULL,
      website TEXT,
      assistant_configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
      context_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ,
      archived_at TIMESTAMPTZ
    )
  `;

  await sql`
    ALTER TABLE ai_builder_projects
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ai_builder_intake_blocks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES ai_builder_projects(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ai_builder_context_entries (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES ai_builder_projects(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      confidence TEXT NOT NULL,
      confidence_score DOUBLE PRECISION NOT NULL,
      status TEXT NOT NULL,
      source JSONB NOT NULL DEFAULT '{}'::jsonb,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ai_builder_faq_entries (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES ai_builder_projects(id) ON DELETE CASCADE,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      confidence TEXT NOT NULL,
      confidence_score DOUBLE PRECISION NOT NULL,
      source_entry_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ai_builder_conflicts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES ai_builder_projects(id) ON DELETE CASCADE,
      topic TEXT NOT NULL,
      first_statement TEXT NOT NULL,
      second_statement TEXT NOT NULL,
      source_excerpts JSONB NOT NULL DEFAULT '[]'::jsonb,
      suggested_question TEXT NOT NULL,
      resolved BOOLEAN NOT NULL DEFAULT FALSE,
      resolution TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ai_builder_missing_information (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES ai_builder_projects(id) ON DELETE CASCADE,
      topic TEXT NOT NULL,
      reason TEXT NOT NULL,
      suggested_question TEXT NOT NULL,
      resolved BOOLEAN NOT NULL DEFAULT FALSE
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ai_builder_progress (
      id BIGSERIAL PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES ai_builder_projects(id) ON DELETE CASCADE,
      stage TEXT NOT NULL,
      message TEXT NOT NULL,
      completed BOOLEAN NOT NULL,
      count INTEGER,
      created_at TIMESTAMPTZ NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ai_builder_chat_threads (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES ai_builder_projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'Demo conversation',
      memory JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ai_builder_chat_messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL REFERENCES ai_builder_chat_threads(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS ai_builder_projects_updated_at_idx ON ai_builder_projects(updated_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_projects_archived_at_idx ON ai_builder_projects(archived_at)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_intake_blocks_project_idx ON ai_builder_intake_blocks(project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_context_entries_project_idx ON ai_builder_context_entries(project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_faq_entries_project_idx ON ai_builder_faq_entries(project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_conflicts_project_idx ON ai_builder_conflicts(project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_missing_information_project_idx ON ai_builder_missing_information(project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_progress_project_idx ON ai_builder_progress(project_id, id)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_chat_threads_project_idx ON ai_builder_chat_threads(project_id, updated_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_chat_messages_thread_idx ON ai_builder_chat_messages(thread_id, created_at)`;
}

export function ensureAiBuilderSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = createAiBuilderSchema().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }

  return schemaPromise;
}
