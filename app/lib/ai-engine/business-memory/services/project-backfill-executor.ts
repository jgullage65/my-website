import "server-only";

import { Pool } from "@neondatabase/serverless";
import { ensureAiBuilderSchema } from "@/app/lib/db/ai-builder-schema";
import { inspectCanonicalProvenanceProject, repairCanonicalProvenanceProject } from "@/app/lib/db/canonical-provenance-reconciliation";
import { rebuildPersistedBusinessMemoryFromTrustedKnowledge } from "../persistence/rebuild-persisted-business-memory";
import { getProjectMigrationState, recordProjectMigrationFailure, transitionProjectMigrationState } from "./project-migration-service";
import type { ProjectMigrationRecord } from "../persistence/neon-project-migration-store";

export type ExecuteProjectBackfillInput = {
  projectId: string;
  clerkUserId: string;
  migrationRunId: string;
  actorType: "system" | "admin";
  actorId: string | null;
};

export type ProjectBackfillResult = {
  projectId: string;
  migrationRunId: string;
  startingState: ProjectMigrationRecord["migrationState"];
  endingState: ProjectMigrationRecord["migrationState"];
  completedSteps: string[];
  skippedSteps: string[];
  finalMigrationRevision: number;
};

const CANONICAL_STEP = "canonical_shadow_verified";
const BUSINESS_MEMORY_STEP = "business_memory_backfill_verified";
const errorText = (error: unknown, fallback: string) => {
  const value = error instanceof Error ? error.message : fallback;
  return value.replace(/\u0000/g, "").split(/\r?\n/)[0]!.slice(0, 2_000) || fallback;
};
const errorCode = (error: unknown, fallback: string) => {
  const value = error instanceof Error ? error.message : "";
  return (/^[A-Z0-9_:-]{1,120}$/.test(value) ? value : fallback);
};

function databasePool() {
  return new Pool({ connectionString: process.env.DATABASE_URL });
}

async function verifyAndRepairCanonical(input: ExecuteProjectBackfillInput): Promise<void> {
  let report = await inspectCanonicalProvenanceProject(input.projectId, input.clerkUserId);
  if (report.readiness === "ready") return;
  report = await repairCanonicalProvenanceProject(input.projectId, input.clerkUserId);
  // This is deliberately a separate reread from the repair path: a state
  // transition is never based on an in-memory repair result.
  report = await inspectCanonicalProvenanceProject(input.projectId, input.clerkUserId);
  if (report.readiness !== "ready" || report.repairFailures.length) {
    throw new Error(`canonical_shadow_not_ready:${report.readiness}`);
  }
}

async function rebuildAndVerifyBusinessMemory(input: ExecuteProjectBackfillInput): Promise<void> {
  const pool = databasePool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Ownership is checked again at the database boundary before any rebuild
    // query is allowed to observe or mutate project-scoped data.
    const project = await client.query("SELECT trusted_knowledge_revision, business_memory_revision FROM ai_builder_projects WHERE id=$1 AND clerk_user_id=$2 FOR UPDATE", [input.projectId, input.clerkUserId]);
    if (!project.rows[0]) throw new Error("AI_BUILDER_PROJECT_NOT_FOUND");
    const trustedRevision = Number(project.rows[0].trusted_knowledge_revision);
    await rebuildPersistedBusinessMemoryFromTrustedKnowledge(client, input.projectId, trustedRevision);
    const verification = await client.query("SELECT memory.revision, memory.trusted_knowledge_revision, project.business_memory_revision FROM ai_builder_projects project LEFT JOIN ai_builder_business_memory memory ON memory.project_id=project.id WHERE project.id=$1 AND project.clerk_user_id=$2", [input.projectId, input.clerkUserId]);
    const row = verification.rows[0];
    if (!row || row.revision == null || Number(row.trusted_knowledge_revision) !== trustedRevision || Number(row.business_memory_revision) !== Number(row.revision)) {
      throw new Error("business_memory_backfill_verification_failed");
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function recordFailure(input: ExecuteProjectBackfillInput, state: ProjectMigrationRecord, attemptedStep: string, error: unknown) {
  await recordProjectMigrationFailure({ projectId: input.projectId, clerkUserId: input.clerkUserId, expectedRevision: state.migrationRevision, migrationRunId: input.migrationRunId, attemptedStep, errorCode: errorCode(error, "AI_BUILDER_BACKFILL_FAILED"), errorMessage: errorText(error, "Project backfill failed.") });
}

/** Executes only 7E's two durable projections; later migration states are intentionally untouched. */
export async function executeProjectBackfill(input: ExecuteProjectBackfillInput): Promise<ProjectBackfillResult> {
  await ensureAiBuilderSchema();
  let state = await getProjectMigrationState({ projectId: input.projectId, clerkUserId: input.clerkUserId });
  const startingState = state.migrationState;
  const completedSteps: string[] = [];
  const skippedSteps: string[] = [];
  if (state.migrationState !== "legacy_only" && state.migrationState !== "canonical_shadow") {
    return { projectId: input.projectId, migrationRunId: input.migrationRunId, startingState, endingState: state.migrationState, completedSteps, skippedSteps: ["7e_already_complete"], finalMigrationRevision: state.migrationRevision };
  }

  try {
    await verifyAndRepairCanonical(input);
    if (state.migrationState === "legacy_only") {
      state = await transitionProjectMigrationState({ projectId: input.projectId, clerkUserId: input.clerkUserId, expectedRevision: state.migrationRevision, nextState: "canonical_shadow", migrationRunId: input.migrationRunId, actorType: input.actorType, actorId: input.actorId, reason: "Verified deterministic canonical shadow projection.", successfulStep: CANONICAL_STEP });
      completedSteps.push(CANONICAL_STEP);
    } else skippedSteps.push(CANONICAL_STEP);
  } catch (error) {
    // Do not turn a stale transition conflict into a failure record for a newer run.
    if (!(error instanceof Error) || !/AI_BUILDER_MIGRATION_(REVISION_CONFLICT|REPLAY_MISMATCH)/.test(error.message)) await recordFailure(input, state, CANONICAL_STEP, error);
    throw error;
  }

  // Reread after the first transition so a crash/retry or competing executor
  // always uses the persisted revision as its checkpoint.
  state = await getProjectMigrationState({ projectId: input.projectId, clerkUserId: input.clerkUserId });
  try {
    await rebuildAndVerifyBusinessMemory(input);
    state = await transitionProjectMigrationState({ projectId: input.projectId, clerkUserId: input.clerkUserId, expectedRevision: state.migrationRevision, nextState: "business_memory_backfilled", migrationRunId: input.migrationRunId, actorType: input.actorType, actorId: input.actorId, reason: "Rebuilt and verified Business Memory from Trusted Knowledge.", successfulStep: BUSINESS_MEMORY_STEP });
    completedSteps.push(BUSINESS_MEMORY_STEP);
  } catch (error) {
    if (!(error instanceof Error) || !/AI_BUILDER_MIGRATION_(REVISION_CONFLICT|REPLAY_MISMATCH)/.test(error.message)) await recordFailure(input, state, BUSINESS_MEMORY_STEP, error);
    throw error;
  }
  return { projectId: input.projectId, migrationRunId: input.migrationRunId, startingState, endingState: state.migrationState, completedSteps, skippedSteps, finalMigrationRevision: state.migrationRevision };
}
