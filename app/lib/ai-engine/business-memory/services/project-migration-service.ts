import "server-only";

import { Pool } from "@neondatabase/serverless";
import { ensureAiBuilderSchema } from "@/app/lib/db/ai-builder-schema";
import { parseProjectMigrationState, type ProjectMigrationState } from "../migration/project-migration-state";
import { NeonProjectMigrationStore, ProjectMigrationStoreError, type GetProjectMigrationStateInput, type ProjectMigrationRecord, type RecordProjectMigrationFailureInput, type TransitionProjectMigrationStateInput } from "../persistence/neon-project-migration-store";

let pool: Pool | null = null;
const databasePool = () => (pool ??= new Pool({ connectionString: process.env.DATABASE_URL }));

export class ProjectMigrationServiceError extends Error {
  constructor(readonly code: string) { super(code); }
}
const text = (value: unknown, field: string, nullable = false): string | null => {
  if (value == null && nullable) return null;
  if (typeof value !== "string" || !value.trim() || value.includes("\u0000")) throw new ProjectMigrationServiceError(`AI_BUILDER_INVALID_MIGRATION_INPUT:${field}`);
  return value.trim();
};
const revision = (value: unknown) => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new ProjectMigrationServiceError("AI_BUILDER_INVALID_MIGRATION_INPUT:expectedRevision");
  return value;
};
const state = (value: unknown) => { try { return parseProjectMigrationState(value); } catch { throw new ProjectMigrationServiceError("AI_BUILDER_INVALID_MIGRATION_INPUT:nextState"); } };
function store() { return new NeonProjectMigrationStore(databasePool()); }
function remap(error: unknown): never { if (error instanceof ProjectMigrationStoreError) throw new ProjectMigrationServiceError(error.code); throw error; }

/** The sole application-level boundary for persisted project migration state. */
export async function getProjectMigrationState(input: GetProjectMigrationStateInput): Promise<ProjectMigrationRecord> {
  await ensureAiBuilderSchema();
  try { return await store().getProjectMigrationState({ projectId: text(input.projectId, "projectId")!, clerkUserId: text(input.clerkUserId, "clerkUserId")! }); } catch (error) { return remap(error); }
}
export async function transitionProjectMigrationState(input: TransitionProjectMigrationStateInput): Promise<ProjectMigrationRecord> {
  await ensureAiBuilderSchema();
  try { return await store().transitionProjectMigrationState({ projectId: text(input.projectId, "projectId")!, clerkUserId: text(input.clerkUserId, "clerkUserId")!, expectedRevision: revision(input.expectedRevision), nextState: state(input.nextState), migrationRunId: text(input.migrationRunId, "migrationRunId", true), actorType: input.actorType === "system" || input.actorType === "admin" ? input.actorType : (() => { throw new ProjectMigrationServiceError("AI_BUILDER_INVALID_MIGRATION_INPUT:actorType"); })(), actorId: text(input.actorId, "actorId", true), reason: text(input.reason, "reason")!, successfulStep: text(input.successfulStep, "successfulStep")! }); } catch (error) { return remap(error); }
}
export async function recordProjectMigrationFailure(input: RecordProjectMigrationFailureInput): Promise<ProjectMigrationRecord> {
  await ensureAiBuilderSchema();
  try { return await store().recordProjectMigrationFailure({ projectId: text(input.projectId, "projectId")!, clerkUserId: text(input.clerkUserId, "clerkUserId")!, expectedRevision: revision(input.expectedRevision), migrationRunId: text(input.migrationRunId, "migrationRunId", true), attemptedStep: text(input.attemptedStep, "attemptedStep")!, errorCode: text(input.errorCode, "errorCode")!, errorMessage: text(input.errorMessage, "errorMessage")! }); } catch (error) { return remap(error); }
}

export type { ProjectMigrationState };
