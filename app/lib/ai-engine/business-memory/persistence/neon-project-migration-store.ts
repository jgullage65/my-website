import "server-only";

import type { Pool, PoolClient } from "@neondatabase/serverless";
import {
  PROJECT_MIGRATION_STATE_VERSION,
  isValidProjectMigrationTransition,
  parseProjectMigrationState,
  type ProjectMigrationState,
} from "../migration/project-migration-state";

export class ProjectMigrationStoreError extends Error {
  constructor(readonly code: "AI_BUILDER_PROJECT_NOT_FOUND" | "AI_BUILDER_MIGRATION_REVISION_CONFLICT" | "AI_BUILDER_INVALID_MIGRATION_TRANSITION") {
    super(code);
  }
}

export type ProjectMigrationRecord = {
  projectId: string; clerkUserId: string; migrationState: ProjectMigrationState;
  migrationStateVersion: number; migrationRevision: number; migrationStartedAt: string | null;
  migrationLastTransitionAt: string | null; migrationCompletedAt: string | null;
  migrationLastSuccessfulStep: string | null; migrationLastAttemptedStep: string | null;
  migrationLastErrorCode: string | null; migrationLastErrorMessage: string | null;
  migrationLastErrorAt: string | null; migrationAttemptCount: number; migrationRunId: string | null;
};

export type GetProjectMigrationStateInput = { projectId: string; clerkUserId: string };
export type TransitionProjectMigrationStateInput = GetProjectMigrationStateInput & {
  expectedRevision: number; nextState: ProjectMigrationState; migrationRunId: string | null;
  actorType: "system" | "admin"; actorId: string | null; reason: string; successfulStep: string;
};
export type RecordProjectMigrationFailureInput = GetProjectMigrationStateInput & {
  expectedRevision: number; migrationRunId: string | null; attemptedStep: string; errorCode: string; errorMessage: string;
};

const columns = "id, clerk_user_id, migration_state, migration_state_version, migration_revision, migration_started_at, migration_last_transition_at, migration_completed_at, migration_last_successful_step, migration_last_attempted_step, migration_last_error_code, migration_last_error_message, migration_last_error_at, migration_attempt_count, migration_run_id";
const date = (value: unknown) => value == null ? null : new Date(String(value)).toISOString();
function record(row: Record<string, unknown>): ProjectMigrationRecord {
  return { projectId: String(row.id), clerkUserId: String(row.clerk_user_id), migrationState: parseProjectMigrationState(row.migration_state), migrationStateVersion: Number(row.migration_state_version), migrationRevision: Number(row.migration_revision), migrationStartedAt: date(row.migration_started_at), migrationLastTransitionAt: date(row.migration_last_transition_at), migrationCompletedAt: date(row.migration_completed_at), migrationLastSuccessfulStep: row.migration_last_successful_step == null ? null : String(row.migration_last_successful_step), migrationLastAttemptedStep: row.migration_last_attempted_step == null ? null : String(row.migration_last_attempted_step), migrationLastErrorCode: row.migration_last_error_code == null ? null : String(row.migration_last_error_code), migrationLastErrorMessage: row.migration_last_error_message == null ? null : String(row.migration_last_error_message), migrationLastErrorAt: date(row.migration_last_error_at), migrationAttemptCount: Number(row.migration_attempt_count), migrationRunId: row.migration_run_id == null ? null : String(row.migration_run_id) };
}

function persistedErrorMessage(value: string): string {
  // Error objects frequently carry stack frames on later lines; persist only a
  // bounded, single-line diagnostic and never an exception stack trace.
  return (value.replace(/\u0000/g, "").split(/\r?\n/)[0] ?? "").trim().slice(0, 2_000);
}

/** Neon-backed migration state persistence. Every mutation locks the owned project row. */
export class NeonProjectMigrationStore {
  constructor(private readonly pool: Pool) {}

  async getProjectMigrationState(input: GetProjectMigrationStateInput): Promise<ProjectMigrationRecord> {
    const result = await this.pool.query(`SELECT ${columns} FROM ai_builder_projects WHERE id = $1 AND clerk_user_id = $2`, [input.projectId, input.clerkUserId]);
    if (!result.rows[0]) throw new ProjectMigrationStoreError("AI_BUILDER_PROJECT_NOT_FOUND");
    return record(result.rows[0]);
  }

  async transitionProjectMigrationState(input: TransitionProjectMigrationStateInput): Promise<ProjectMigrationRecord> {
    return this.transaction((client) => this.transition(client, input));
  }

  async recordProjectMigrationFailure(input: RecordProjectMigrationFailureInput): Promise<ProjectMigrationRecord> {
    return this.transaction(async (client) => {
      const current = await this.lockOwned(client, input);
      if (current.migrationRevision !== input.expectedRevision) throw new ProjectMigrationStoreError("AI_BUILDER_MIGRATION_REVISION_CONFLICT");
      const result = await client.query(`UPDATE ai_builder_projects SET migration_attempt_count = migration_attempt_count + 1, migration_last_attempted_step = $3, migration_run_id = $4, migration_last_error_code = $5, migration_last_error_message = $6, migration_last_error_at = NOW() WHERE id = $1 AND clerk_user_id = $2 RETURNING ${columns}`, [input.projectId, input.clerkUserId, input.attemptedStep, input.migrationRunId, persistedErrorMessage(input.errorCode), persistedErrorMessage(input.errorMessage)]);
      return record(result.rows[0]);
    });
  }

  private async transition(client: PoolClient, input: TransitionProjectMigrationStateInput): Promise<ProjectMigrationRecord> {
    const current = await this.lockOwned(client, input);
    if (current.migrationRevision !== input.expectedRevision) throw new ProjectMigrationStoreError("AI_BUILDER_MIGRATION_REVISION_CONFLICT");
    if (input.nextState === current.migrationState) return current;
    if (!isValidProjectMigrationTransition(current.migrationState, input.nextState)) throw new ProjectMigrationStoreError("AI_BUILDER_INVALID_MIGRATION_TRANSITION");
    const result = await client.query(`UPDATE ai_builder_projects SET migration_state = $3, migration_state_version = $4, migration_revision = migration_revision + 1, migration_started_at = CASE WHEN migration_state = 'legacy_only' AND migration_started_at IS NULL THEN NOW() ELSE migration_started_at END, migration_last_transition_at = NOW(), migration_completed_at = CASE WHEN $3 = 'legacy_retired' THEN NOW() ELSE migration_completed_at END, migration_last_successful_step = $5, migration_last_attempted_step = $5, migration_run_id = $6, migration_last_error_code = NULL, migration_last_error_message = NULL, migration_last_error_at = NULL WHERE id = $1 AND clerk_user_id = $2 RETURNING ${columns}`, [input.projectId, input.clerkUserId, input.nextState, PROJECT_MIGRATION_STATE_VERSION, input.successfulStep, input.migrationRunId]);
    const updated = record(result.rows[0]);
    await client.query("INSERT INTO ai_builder_project_migration_history (project_id, clerk_user_id, previous_state, next_state, previous_revision, resulting_revision, state_version, migration_run_id, actor_type, actor_id, reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)", [input.projectId, input.clerkUserId, current.migrationState, updated.migrationState, current.migrationRevision, updated.migrationRevision, updated.migrationStateVersion, input.migrationRunId, input.actorType, input.actorId, input.reason]);
    return updated;
  }

  private async lockOwned(client: PoolClient, input: GetProjectMigrationStateInput): Promise<ProjectMigrationRecord> {
    const result = await client.query(`SELECT ${columns} FROM ai_builder_projects WHERE id = $1 AND clerk_user_id = $2 FOR UPDATE`, [input.projectId, input.clerkUserId]);
    if (!result.rows[0]) throw new ProjectMigrationStoreError("AI_BUILDER_PROJECT_NOT_FOUND");
    return record(result.rows[0]);
  }
  private async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try { await client.query("BEGIN ISOLATION LEVEL READ COMMITTED"); const result = await callback(client); await client.query("COMMIT"); return result; }
    catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
    finally { client.release(); }
  }
}
