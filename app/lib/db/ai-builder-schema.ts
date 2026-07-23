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
      governance_revision INTEGER NOT NULL DEFAULT 0,
      trusted_knowledge_revision INTEGER NOT NULL DEFAULT 0,
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

  await sql`ALTER TABLE ai_builder_projects ADD COLUMN IF NOT EXISTS owner_name TEXT`;
  await sql`ALTER TABLE ai_builder_projects ADD COLUMN IF NOT EXISTS owner_email TEXT`;
  await sql`ALTER TABLE ai_builder_projects ADD COLUMN IF NOT EXISTS clerk_user_id TEXT`;
  await sql`ALTER TABLE ai_builder_projects ADD COLUMN IF NOT EXISTS internal_status TEXT`;
  await sql`ALTER TABLE ai_builder_projects ADD COLUMN IF NOT EXISTS internal_fields JSONB NOT NULL DEFAULT '{}'::jsonb`;
  await sql`ALTER TABLE ai_builder_projects ADD COLUMN IF NOT EXISTS governance_revision INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE ai_builder_projects ADD COLUMN IF NOT EXISTS trusted_knowledge_revision INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE ai_builder_projects ADD COLUMN IF NOT EXISTS business_memory_revision INTEGER NOT NULL DEFAULT 0`;
  // These are deliberately relational columns rather than JSONB: migration
  // transitions are a durable, lockable state machine for each project.
  await sql`ALTER TABLE ai_builder_projects ADD COLUMN IF NOT EXISTS migration_state TEXT NOT NULL DEFAULT 'legacy_only'`;
  await sql`ALTER TABLE ai_builder_projects ADD COLUMN IF NOT EXISTS migration_state_version INTEGER NOT NULL DEFAULT 1`;
  await sql`ALTER TABLE ai_builder_projects ADD COLUMN IF NOT EXISTS migration_revision INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE ai_builder_projects ADD COLUMN IF NOT EXISTS migration_started_at TIMESTAMPTZ`;
  await sql`ALTER TABLE ai_builder_projects ADD COLUMN IF NOT EXISTS migration_last_transition_at TIMESTAMPTZ`;
  await sql`ALTER TABLE ai_builder_projects ADD COLUMN IF NOT EXISTS migration_completed_at TIMESTAMPTZ`;
  await sql`ALTER TABLE ai_builder_projects ADD COLUMN IF NOT EXISTS migration_last_successful_step TEXT`;
  await sql`ALTER TABLE ai_builder_projects ADD COLUMN IF NOT EXISTS migration_last_attempted_step TEXT`;
  await sql`ALTER TABLE ai_builder_projects ADD COLUMN IF NOT EXISTS migration_last_error_code TEXT`;
  await sql`ALTER TABLE ai_builder_projects ADD COLUMN IF NOT EXISTS migration_last_error_message TEXT`;
  await sql`ALTER TABLE ai_builder_projects ADD COLUMN IF NOT EXISTS migration_last_error_at TIMESTAMPTZ`;
  await sql`ALTER TABLE ai_builder_projects ADD COLUMN IF NOT EXISTS migration_attempt_count INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE ai_builder_projects ADD COLUMN IF NOT EXISTS migration_run_id TEXT`;
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_builder_projects_migration_state_check') THEN
        ALTER TABLE ai_builder_projects ADD CONSTRAINT ai_builder_projects_migration_state_check
          CHECK (migration_state IN ('legacy_only', 'canonical_shadow', 'business_memory_backfilled', 'business_memory_verified', 'assistant_projection_ready', 'canonical_runtime', 'legacy_retired'));
      END IF;
    END $$
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ai_builder_project_migration_history (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT NOT NULL REFERENCES ai_builder_projects(id) ON DELETE CASCADE,
      clerk_user_id TEXT NOT NULL,
      previous_state TEXT NOT NULL,
      next_state TEXT NOT NULL,
      previous_revision INTEGER NOT NULL,
      resulting_revision INTEGER NOT NULL,
      state_version INTEGER NOT NULL,
      migration_run_id TEXT,
      actor_type TEXT NOT NULL,
      actor_id TEXT,
      reason TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (project_id, resulting_revision)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ai_builder_canonical_sources (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT NOT NULL REFERENCES ai_builder_projects(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('manual', 'website')),
      canonical_identity TEXT NOT NULL UNIQUE,
      url TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ai_builder_canonical_source_snapshots (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      source_id TEXT NOT NULL REFERENCES ai_builder_canonical_sources(id) ON DELETE CASCADE,
      snapshot_identity TEXT NOT NULL UNIQUE,
      snapshot_kind TEXT NOT NULL,
      payload JSONB NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      captured_at TIMESTAMPTZ NOT NULL
    )
  `;

  await sql`ALTER TABLE ai_builder_canonical_source_snapshots ADD COLUMN IF NOT EXISTS snapshot_identity TEXT`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS ai_builder_canonical_source_snapshots_identity_idx ON ai_builder_canonical_source_snapshots(snapshot_identity) WHERE snapshot_identity IS NOT NULL`;

  await sql`
    CREATE TABLE IF NOT EXISTS ai_builder_canonical_evidence (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      source_id TEXT NOT NULL REFERENCES ai_builder_canonical_sources(id) ON DELETE CASCADE,
      source_snapshot_id TEXT NOT NULL REFERENCES ai_builder_canonical_source_snapshots(id) ON DELETE CASCADE,
      evidence_identity TEXT NOT NULL UNIQUE,
      content TEXT NOT NULL,
      url TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      captured_at TIMESTAMPTZ NOT NULL
    )
  `;

  await sql`ALTER TABLE ai_builder_canonical_sources ALTER COLUMN id SET DEFAULT gen_random_uuid()::text`;
  await sql`ALTER TABLE ai_builder_canonical_source_snapshots ALTER COLUMN id SET DEFAULT gen_random_uuid()::text`;
  await sql`ALTER TABLE ai_builder_canonical_evidence ALTER COLUMN id SET DEFAULT gen_random_uuid()::text`;
  await sql`
    CREATE TABLE IF NOT EXISTS ai_builder_canonical_candidate_claims (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      claim_identity TEXT NOT NULL UNIQUE,
      project_id TEXT NOT NULL REFERENCES ai_builder_projects(id) ON DELETE CASCADE,
      source_snapshot_id TEXT NOT NULL REFERENCES ai_builder_canonical_source_snapshots(id) ON DELETE CASCADE,
      claim_type TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      normalized_content TEXT NOT NULL,
      confidence TEXT NOT NULL,
      confidence_score DOUBLE PRECISION NOT NULL,
      status TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ai_builder_canonical_candidate_claim_evidence (
      candidate_claim_id TEXT NOT NULL REFERENCES ai_builder_canonical_candidate_claims(id) ON DELETE CASCADE,
      evidence_id TEXT NOT NULL REFERENCES ai_builder_canonical_evidence(id) ON DELETE CASCADE,
      PRIMARY KEY (candidate_claim_id, evidence_id)
    )
  `;

  await sql`ALTER TABLE ai_builder_canonical_candidate_claims ALTER COLUMN id SET DEFAULT gen_random_uuid()::text`;

  // Governance history is append-only. Legacy workflow rows remain authoritative
  // during the dual-write migration, while these rows preserve their decisions.
  await sql`
    CREATE TABLE IF NOT EXISTS ai_builder_canonical_claim_reviews (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      review_identity TEXT NOT NULL UNIQUE,
      project_id TEXT NOT NULL REFERENCES ai_builder_projects(id) ON DELETE CASCADE,
      candidate_claim_id TEXT NOT NULL REFERENCES ai_builder_canonical_candidate_claims(id) ON DELETE RESTRICT,
      action TEXT NOT NULL CHECK (action IN ('approve', 'correction', 'archive', 'restore', 'reject')),
      actor JSONB NOT NULL DEFAULT '{}'::jsonb,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      legacy_references JSONB NOT NULL DEFAULT '{}'::jsonb,
      reviewed_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ai_builder_canonical_trusted_knowledge (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      trusted_knowledge_identity TEXT NOT NULL UNIQUE,
      project_id TEXT NOT NULL REFERENCES ai_builder_projects(id) ON DELETE CASCADE,
      candidate_claim_id TEXT NOT NULL REFERENCES ai_builder_canonical_candidate_claims(id) ON DELETE RESTRICT,
      claim_review_id TEXT NOT NULL REFERENCES ai_builder_canonical_claim_reviews(id) ON DELETE RESTRICT,
      previous_trusted_knowledge_id TEXT REFERENCES ai_builder_canonical_trusted_knowledge(id) ON DELETE RESTRICT,
      legacy_kind TEXT NOT NULL CHECK (legacy_kind IN ('context_entry', 'faq')),
      legacy_entry_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      lifecycle TEXT NOT NULL CHECK (lifecycle IN ('active', 'archived', 'rejected')),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL,
      UNIQUE (project_id, legacy_kind, legacy_entry_id, revision)
    )
  `;
  // The runtime projection is deliberately separate from the append-only
  // provenance shadow above. One row is the current, assistant-ready view of
  // one canonical review item; history remains on the reviewed source row.
  await sql`
    CREATE TABLE IF NOT EXISTS ai_builder_trusted_knowledge_projection (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT NOT NULL REFERENCES ai_builder_projects(id) ON DELETE CASCADE,
      source_item_id TEXT NOT NULL,
      source_item_kind TEXT NOT NULL CHECK (source_item_kind IN ('context_entry', 'faq')),
      review_state TEXT NOT NULL CHECK (review_state IN ('approved', 'corrected', 'proposed', 'archived')),
      active BOOLEAN NOT NULL,
      content JSONB NOT NULL,
      provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
      source_entry_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      governance_revision INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      UNIQUE (project_id, source_item_kind, source_item_id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_trusted_knowledge_projection_active_idx ON ai_builder_trusted_knowledge_projection(project_id, active)`;
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
  await sql`ALTER TABLE ai_builder_faq_entries ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb`;

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

  await sql`
    CREATE TABLE IF NOT EXISTS ai_builder_purchase_interest (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL UNIQUE REFERENCES ai_builder_projects(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE ai_builder_purchase_interest ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new'`;
  await sql`ALTER TABLE ai_builder_purchase_interest ADD COLUMN IF NOT EXISTS follow_up_stage TEXT NOT NULL DEFAULT 'new'`;
  await sql`ALTER TABLE ai_builder_purchase_interest ADD COLUMN IF NOT EXISTS internal_comments TEXT`;
  await sql`ALTER TABLE ai_builder_purchase_interest ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;

  await sql`
    CREATE TABLE IF NOT EXISTS ai_builder_admin_notes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES ai_builder_projects(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      author_id TEXT NOT NULL,
      author_email TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ai_builder_communications (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES ai_builder_projects(id) ON DELETE CASCADE,
      email_type TEXT NOT NULL,
      recipient_email TEXT,
      delivery_status TEXT NOT NULL,
      provider_message_id TEXT,
      sent_at TIMESTAMPTZ NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ai_builder_impersonation_events (
      id TEXT PRIMARY KEY,
      admin_id TEXT NOT NULL,
      admin_email TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      customer_email TEXT,
      project_id TEXT,
      event_type TEXT NOT NULL,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ai_builder_crawl_telemetry (
      id TEXT PRIMARY KEY,
      project_id TEXT REFERENCES ai_builder_projects(id) ON DELETE CASCADE,
      requested_url TEXT NOT NULL,
      resolved_url TEXT,
      status TEXT NOT NULL,
      attempt_number INTEGER NOT NULL,
      started_at TIMESTAMPTZ NOT NULL,
      completed_at TIMESTAMPTZ,
      duration_ms INTEGER,
      pages_discovered INTEGER,
      pages_processed INTEGER,
      pages_skipped INTEGER,
      pages_failed INTEGER,
      final_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
      warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
      errors JSONB NOT NULL DEFAULT '[]'::jsonb,
      restrictions JSONB,
      failure_stage TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ai_builder_generation_telemetry (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      status TEXT NOT NULL,
      attempt_number INTEGER NOT NULL,
      started_at TIMESTAMPTZ NOT NULL,
      completed_at TIMESTAMPTZ,
      duration_ms INTEGER,
      model TEXT,
      knowledge_count INTEGER,
      faq_count INTEGER,
      retry_count INTEGER,
      input_tokens INTEGER,
      output_tokens INTEGER,
      total_tokens INTEGER,
      cost_micros BIGINT,
      warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
      errors JSONB NOT NULL DEFAULT '[]'::jsonb,
      failure_stage TEXT,
      provider_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS ai_builder_projects_updated_at_idx ON ai_builder_projects(updated_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_projects_owner_email_idx ON ai_builder_projects(owner_email)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_projects_clerk_user_id_idx ON ai_builder_projects(clerk_user_id, updated_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_projects_archived_at_idx ON ai_builder_projects(archived_at)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_projects_migration_state_version_idx ON ai_builder_projects(migration_state, migration_state_version)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_project_migration_history_project_created_idx ON ai_builder_project_migration_history(project_id, created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_canonical_sources_project_idx ON ai_builder_canonical_sources(project_id, created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_canonical_source_snapshots_source_idx ON ai_builder_canonical_source_snapshots(source_id, captured_at)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_canonical_evidence_snapshot_idx ON ai_builder_canonical_evidence(source_snapshot_id, captured_at)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_canonical_candidate_claims_project_idx ON ai_builder_canonical_candidate_claims(project_id, created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_canonical_candidate_claims_snapshot_idx ON ai_builder_canonical_candidate_claims(source_snapshot_id, created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_canonical_candidate_claim_evidence_evidence_idx ON ai_builder_canonical_candidate_claim_evidence(evidence_id)`;
  // Business Memory is a normalized, project-owned canonical projection.  It is
  // intentionally not written by the browser or the legacy session routes.
  await sql`CREATE TABLE IF NOT EXISTS ai_builder_business_memory (id TEXT PRIMARY KEY, project_id TEXT NOT NULL UNIQUE REFERENCES ai_builder_projects(id) ON DELETE CASCADE, schema_version INTEGER NOT NULL, revision INTEGER NOT NULL, trusted_knowledge_revision INTEGER NOT NULL, state_fingerprint TEXT, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL)`;
  // A deterministic fingerprint makes retries of the same Trusted Knowledge
  // state idempotent. Nullable keeps this additive change compatible with #89.
  await sql`ALTER TABLE ai_builder_business_memory ADD COLUMN IF NOT EXISTS state_fingerprint TEXT`;
  // The Assistant Projection is a replaceable runtime artifact.  Its source
  // Business Memory remains relational above; this row holds only one current
  // serialized projection per project, with invalidation queryable as metadata.
  await sql`
    CREATE TABLE IF NOT EXISTS ai_builder_assistant_projections (
      project_id TEXT PRIMARY KEY REFERENCES ai_builder_projects(id) ON DELETE CASCADE,
      business_memory_fingerprint TEXT NOT NULL,
      projection_version INTEGER NOT NULL CHECK (projection_version > 0),
      schema_version INTEGER NOT NULL CHECK (schema_version > 0),
      generated_at TIMESTAMPTZ NOT NULL,
      invalidation_state TEXT NOT NULL CHECK (invalidation_state IN ('valid', 'invalidated', 'rebuilding', 'failed')),
      projection_json JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )
  `;
  // Existing installations need these additive checks too; do not pin exact
  // versions because future projection migrations remain valid.
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_builder_assistant_projections_projection_version_positive_check') THEN
        ALTER TABLE ai_builder_assistant_projections ADD CONSTRAINT ai_builder_assistant_projections_projection_version_positive_check CHECK (projection_version > 0);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_builder_assistant_projections_schema_version_positive_check') THEN
        ALTER TABLE ai_builder_assistant_projections ADD CONSTRAINT ai_builder_assistant_projections_schema_version_positive_check CHECK (schema_version > 0);
      END IF;
    END $$
  `;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_assistant_projections_state_updated_idx ON ai_builder_assistant_projections(invalidation_state, updated_at)`;
  await sql`CREATE TABLE IF NOT EXISTS ai_builder_assistant_projection_parity_reports (project_id TEXT PRIMARY KEY REFERENCES ai_builder_projects(id) ON DELETE CASCADE, compared_at TIMESTAMPTZ NOT NULL, legacy_runtime_version INTEGER NOT NULL, assistant_projection_version INTEGER, assistant_projection_schema_version INTEGER, status TEXT NOT NULL CHECK (status IN ('MATCH','MINOR_DIFFERENCE','MAJOR_DIFFERENCE','COMPARISON_FAILURE')), mismatch_summary JSONB NOT NULL, category_breakdown JSONB NOT NULL, failure_details JSONB, updated_at TIMESTAMPTZ NOT NULL)`;
  // One current report per project bounds observability storage while retaining durable evidence.

  await sql`CREATE TABLE IF NOT EXISTS ai_builder_business_memory_entities (id TEXT PRIMARY KEY, memory_id TEXT NOT NULL REFERENCES ai_builder_business_memory(id) ON DELETE CASCADE, entity_type TEXT NOT NULL, name TEXT NOT NULL, aliases JSONB NOT NULL DEFAULT '[]'::jsonb, tags JSONB NOT NULL DEFAULT '[]'::jsonb, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS ai_builder_business_memory_assertions (id TEXT PRIMARY KEY, memory_id TEXT NOT NULL REFERENCES ai_builder_business_memory(id) ON DELETE CASCADE, entity_id TEXT NOT NULL REFERENCES ai_builder_business_memory_entities(id) ON DELETE CASCADE, trusted_knowledge_id TEXT NOT NULL REFERENCES ai_builder_canonical_trusted_knowledge(id) ON DELETE RESTRICT, candidate_claim_id TEXT NOT NULL REFERENCES ai_builder_canonical_candidate_claims(id) ON DELETE RESTRICT, value TEXT NOT NULL, confidence TEXT NOT NULL, confidence_score DOUBLE PRECISION NOT NULL, review_state TEXT NOT NULL, authority TEXT NOT NULL, tags JSONB NOT NULL DEFAULT '[]'::jsonb, legacy_entry_id TEXT, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL, UNIQUE(memory_id, trusted_knowledge_id))`;
  // Lifecycle makes restore distinguishable from an ordinary approval without
  // attempting to copy append-only governance history into Business Memory.
  await sql`ALTER TABLE ai_builder_business_memory_assertions ADD COLUMN IF NOT EXISTS trusted_lifecycle TEXT NOT NULL DEFAULT 'active'`;
  await sql`CREATE TABLE IF NOT EXISTS ai_builder_business_memory_sources (id TEXT PRIMARY KEY, memory_id TEXT NOT NULL REFERENCES ai_builder_business_memory(id) ON DELETE CASCADE, canonical_source_id TEXT NOT NULL REFERENCES ai_builder_canonical_sources(id) ON DELETE RESTRICT, origin TEXT NOT NULL, source_entry_id TEXT, intake_block_id TEXT, url TEXT, label TEXT, captured_at TIMESTAMPTZ NOT NULL, crawl_attempt_id TEXT, UNIQUE(memory_id, canonical_source_id))`;
  await sql`CREATE TABLE IF NOT EXISTS ai_builder_business_memory_evidence (id TEXT PRIMARY KEY, memory_id TEXT NOT NULL REFERENCES ai_builder_business_memory(id) ON DELETE CASCADE, source_id TEXT NOT NULL REFERENCES ai_builder_business_memory_sources(id) ON DELETE CASCADE, canonical_evidence_id TEXT NOT NULL REFERENCES ai_builder_canonical_evidence(id) ON DELETE RESTRICT, excerpt TEXT NOT NULL, url TEXT, captured_at TIMESTAMPTZ NOT NULL, UNIQUE(memory_id, canonical_evidence_id))`;
  await sql`CREATE TABLE IF NOT EXISTS ai_builder_business_memory_assertion_sources (assertion_id TEXT NOT NULL REFERENCES ai_builder_business_memory_assertions(id) ON DELETE CASCADE, source_id TEXT NOT NULL REFERENCES ai_builder_business_memory_sources(id) ON DELETE CASCADE, PRIMARY KEY(assertion_id, source_id))`;
  await sql`CREATE TABLE IF NOT EXISTS ai_builder_business_memory_assertion_evidence (assertion_id TEXT NOT NULL REFERENCES ai_builder_business_memory_assertions(id) ON DELETE CASCADE, evidence_id TEXT NOT NULL REFERENCES ai_builder_business_memory_evidence(id) ON DELETE CASCADE, PRIMARY KEY(assertion_id, evidence_id))`;
  await sql`CREATE TABLE IF NOT EXISTS ai_builder_business_memory_relationships (id TEXT PRIMARY KEY, memory_id TEXT NOT NULL REFERENCES ai_builder_business_memory(id) ON DELETE CASCADE, relationship_type TEXT NOT NULL, from_entity_id TEXT NOT NULL REFERENCES ai_builder_business_memory_entities(id) ON DELETE CASCADE, to_entity_id TEXT NOT NULL REFERENCES ai_builder_business_memory_entities(id) ON DELETE CASCADE, from_assertion_id TEXT NOT NULL REFERENCES ai_builder_business_memory_assertions(id) ON DELETE CASCADE, to_assertion_id TEXT NOT NULL REFERENCES ai_builder_business_memory_assertions(id) ON DELETE CASCADE, source_entry_ids JSONB NOT NULL DEFAULT '[]'::jsonb, provenance JSONB NOT NULL DEFAULT '[]'::jsonb, review_state TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL)`;
  await sql`ALTER TABLE ai_builder_business_memory_relationships ADD COLUMN IF NOT EXISTS provenance JSONB NOT NULL DEFAULT '[]'::jsonb`;
  await sql`CREATE TABLE IF NOT EXISTS ai_builder_business_memory_conflicts (id TEXT PRIMARY KEY, memory_id TEXT NOT NULL REFERENCES ai_builder_business_memory(id) ON DELETE CASCADE, resolved_entity_id TEXT NOT NULL, topic TEXT NOT NULL, conflicting_statements JSONB NOT NULL, detection_rule TEXT NOT NULL DEFAULT '', suggested_question TEXT NOT NULL, resolved BOOLEAN NOT NULL DEFAULT FALSE, resolution TEXT, active BOOLEAN NOT NULL DEFAULT TRUE, material_input_hash TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL)`;
  await sql`ALTER TABLE ai_builder_business_memory_conflicts ADD COLUMN IF NOT EXISTS resolved_entity_id TEXT`;
  await sql`ALTER TABLE ai_builder_business_memory_conflicts ADD COLUMN IF NOT EXISTS detection_rule TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE ai_builder_business_memory_conflicts ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE`;
  await sql`ALTER TABLE ai_builder_business_memory_conflicts ADD COLUMN IF NOT EXISTS material_input_hash TEXT NOT NULL DEFAULT ''`;
  await sql`CREATE TABLE IF NOT EXISTS ai_builder_business_memory_conflict_assertions (conflict_id TEXT NOT NULL REFERENCES ai_builder_business_memory_conflicts(id) ON DELETE CASCADE, assertion_id TEXT NOT NULL REFERENCES ai_builder_business_memory_assertions(id) ON DELETE CASCADE, PRIMARY KEY(conflict_id, assertion_id))`;
  await sql`CREATE TABLE IF NOT EXISTS ai_builder_business_memory_missing_information (id TEXT PRIMARY KEY, memory_id TEXT NOT NULL REFERENCES ai_builder_business_memory(id) ON DELETE CASCADE, topic TEXT NOT NULL, reason TEXT NOT NULL, suggested_question TEXT NOT NULL, resolved BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL)`;
  // Section 2 uses Model A: immutable source entities plus durable resolved entities.
  await sql`CREATE TABLE IF NOT EXISTS ai_builder_business_memory_resolved_entities (id TEXT PRIMARY KEY, memory_id TEXT NOT NULL REFERENCES ai_builder_business_memory(id) ON DELETE CASCADE, project_id TEXT NOT NULL REFERENCES ai_builder_projects(id) ON DELETE CASCADE, entity_type TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS ai_builder_business_memory_entity_resolution (source_entity_id TEXT PRIMARY KEY REFERENCES ai_builder_business_memory_entities(id) ON DELETE RESTRICT, resolved_entity_id TEXT NOT NULL REFERENCES ai_builder_business_memory_resolved_entities(id) ON DELETE RESTRICT, memory_id TEXT NOT NULL REFERENCES ai_builder_business_memory(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS ai_builder_business_memory_identity_keys (id TEXT PRIMARY KEY, memory_id TEXT NOT NULL REFERENCES ai_builder_business_memory(id) ON DELETE CASCADE, project_id TEXT NOT NULL REFERENCES ai_builder_projects(id) ON DELETE CASCADE, resolved_entity_id TEXT NOT NULL REFERENCES ai_builder_business_memory_resolved_entities(id) ON DELETE RESTRICT, source_entity_id TEXT REFERENCES ai_builder_business_memory_entities(id) ON DELETE RESTRICT, key_type TEXT NOT NULL, normalized_value TEXT NOT NULL, display_value TEXT, strength TEXT NOT NULL, authoritative BOOLEAN NOT NULL, source_ids JSONB NOT NULL DEFAULT '[]'::jsonb, active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS ai_builder_business_memory_entity_aliases (id TEXT PRIMARY KEY, memory_id TEXT NOT NULL REFERENCES ai_builder_business_memory(id) ON DELETE CASCADE, project_id TEXT NOT NULL REFERENCES ai_builder_projects(id) ON DELETE CASCADE, resolved_entity_id TEXT NOT NULL REFERENCES ai_builder_business_memory_resolved_entities(id) ON DELETE RESTRICT, display_value TEXT NOT NULL, normalized_value TEXT NOT NULL, source_ids JSONB NOT NULL DEFAULT '[]'::jsonb, accepted BOOLEAN NOT NULL DEFAULT TRUE, active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL, UNIQUE(memory_id, resolved_entity_id, normalized_value))`;
  await sql`CREATE TABLE IF NOT EXISTS ai_builder_business_memory_entity_redirects (from_resolved_entity_id TEXT PRIMARY KEY REFERENCES ai_builder_business_memory_resolved_entities(id) ON DELETE RESTRICT, to_resolved_entity_id TEXT NOT NULL REFERENCES ai_builder_business_memory_resolved_entities(id) ON DELETE RESTRICT, memory_id TEXT NOT NULL REFERENCES ai_builder_business_memory(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS ai_builder_business_memory_merge_ledger (command_id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES ai_builder_projects(id) ON DELETE CASCADE, memory_id TEXT NOT NULL REFERENCES ai_builder_business_memory(id) ON DELETE CASCADE, command JSONB NOT NULL, resulting_revision INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS ai_builder_business_memory_merge_history (id TEXT PRIMARY KEY, command_id TEXT NOT NULL REFERENCES ai_builder_business_memory_merge_ledger(command_id) ON DELETE RESTRICT, memory_id TEXT NOT NULL REFERENCES ai_builder_business_memory(id) ON DELETE CASCADE, survivor_resolved_entity_id TEXT NOT NULL, merged_resolved_entity_ids JSONB NOT NULL, reason TEXT NOT NULL, actor TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS ai_builder_business_memory_reconciliation_history (id TEXT PRIMARY KEY, memory_id TEXT NOT NULL REFERENCES ai_builder_business_memory(id) ON DELETE CASCADE, starting_revision INTEGER NOT NULL, resulting_revision INTEGER NOT NULL, mutation_fingerprint TEXT NOT NULL, changed_ids JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_business_memory_resolved_entities_memory_idx ON ai_builder_business_memory_resolved_entities(memory_id, active)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_business_memory_identity_keys_lookup_idx ON ai_builder_business_memory_identity_keys(project_id, key_type, normalized_value, active)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_business_memory_assertions_memory_idx ON ai_builder_business_memory_assertions(memory_id, entity_id)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_intake_blocks_project_idx ON ai_builder_intake_blocks(project_id)`;
  await sql`CREATE TABLE IF NOT EXISTS ai_builder_review_command_history (id TEXT PRIMARY KEY, command_id TEXT NOT NULL UNIQUE, project_id TEXT NOT NULL REFERENCES ai_builder_projects(id) ON DELETE CASCADE, item_id TEXT NOT NULL, item_kind TEXT NOT NULL, command_kind TEXT NOT NULL, actor JSONB NOT NULL, previous_state TEXT NOT NULL, new_state TEXT NOT NULL, project_revision INTEGER NOT NULL, correction JSONB, created_at TIMESTAMPTZ NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS ai_builder_review_command_ledger (command_id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES ai_builder_projects(id) ON DELETE CASCADE, item_id TEXT NOT NULL, resulting_revision INTEGER NOT NULL, resulting_state TEXT NOT NULL, executed_at TIMESTAMPTZ NOT NULL, result JSONB NOT NULL)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_context_entries_project_idx ON ai_builder_context_entries(project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_faq_entries_project_idx ON ai_builder_faq_entries(project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_conflicts_project_idx ON ai_builder_conflicts(project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_missing_information_project_idx ON ai_builder_missing_information(project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_progress_project_idx ON ai_builder_progress(project_id, id)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_chat_threads_project_idx ON ai_builder_chat_threads(project_id, updated_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_chat_messages_thread_idx ON ai_builder_chat_messages(thread_id, created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_purchase_interest_created_at_idx ON ai_builder_purchase_interest(created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_admin_notes_project_idx ON ai_builder_admin_notes(project_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_communications_project_idx ON ai_builder_communications(project_id, sent_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_impersonation_events_admin_idx ON ai_builder_impersonation_events(admin_id, occurred_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_crawl_telemetry_project_idx ON ai_builder_crawl_telemetry(project_id, started_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_crawl_telemetry_url_idx ON ai_builder_crawl_telemetry(requested_url, started_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_builder_generation_telemetry_project_idx ON ai_builder_generation_telemetry(project_id, started_at DESC)`;
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
