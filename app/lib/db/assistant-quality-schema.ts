import "server-only";

import { getSql } from "./client";

let schemaPromise: Promise<void> | null = null;

async function createAssistantQualitySchema(): Promise<void> {
  const sql = getSql();

  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;

  await sql`
    CREATE TABLE IF NOT EXISTS assistant_quality_runs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES ai_builder_projects(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('draft', 'queued', 'running', 'completed', 'failed', 'cancelled')),
      assistant_provider TEXT NOT NULL,
      assistant_model TEXT NOT NULL,
      evaluator_provider TEXT,
      evaluator_model TEXT,
      passing_score INTEGER NOT NULL DEFAULT 80 CHECK (passing_score BETWEEN 0 AND 100),
      overall_score INTEGER CHECK (overall_score BETWEEN 0 AND 100),
      passed BOOLEAN,
      completed_question_count INTEGER NOT NULL DEFAULT 0 CHECK (completed_question_count >= 0),
      failed_question_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_question_count >= 0),
      evaluation_failure_count INTEGER NOT NULL DEFAULT 0 CHECK (evaluation_failure_count >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      evaluated_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS assistant_quality_run_questions (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES assistant_quality_runs(id) ON DELETE CASCADE,
      definition_id TEXT,
      title TEXT NOT NULL,
      prompt TEXT NOT NULL,
      category TEXT NOT NULL,
      source TEXT NOT NULL,
      purpose TEXT,
      expected_behavior JSONB NOT NULL DEFAULT '[]'::jsonb,
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
      sequence INTEGER NOT NULL CHECK (sequence >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (run_id, sequence)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS assistant_quality_question_results (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES assistant_quality_runs(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL REFERENCES assistant_quality_run_questions(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
      answer TEXT,
      citations JSONB NOT NULL DEFAULT '[]'::jsonb,
      execution_metadata JSONB,
      error_code TEXT,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (run_id, question_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS assistant_quality_question_evaluations (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      run_id TEXT NOT NULL REFERENCES assistant_quality_runs(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL REFERENCES assistant_quality_run_questions(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('completed', 'execution_failed', 'evaluation_failed')),
      overall_score INTEGER CHECK (overall_score BETWEEN 0 AND 100),
      passed BOOLEAN,
      summary TEXT NOT NULL,
      strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
      issues JSONB NOT NULL DEFAULT '[]'::jsonb,
      dimensions JSONB NOT NULL DEFAULT '[]'::jsonb,
      evaluator_metadata JSONB,
      error_code TEXT,
      evaluated_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (run_id, question_id)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS assistant_quality_runs_project_created_idx
      ON assistant_quality_runs(project_id, created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS assistant_quality_run_questions_run_sequence_idx
      ON assistant_quality_run_questions(run_id, sequence)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS assistant_quality_question_evaluations_run_status_idx
      ON assistant_quality_question_evaluations(run_id, status)
  `;
}

export function ensureAssistantQualitySchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = createAssistantQualitySchema().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }

  return schemaPromise;
}
