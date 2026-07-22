export const PROJECT_MIGRATION_STATES = [
  "legacy_only",
  "canonical_shadow",
  "business_memory_backfilled",
  "business_memory_verified",
  "assistant_projection_ready",
  "canonical_runtime",
  "legacy_retired",
] as const;

export type ProjectMigrationState = (typeof PROJECT_MIGRATION_STATES)[number];

export const PROJECT_MIGRATION_STATE_VERSION = 1;

export const PROJECT_MIGRATION_TRANSITIONS: Readonly<Record<ProjectMigrationState, ProjectMigrationState | null>> = {
  legacy_only: "canonical_shadow",
  canonical_shadow: "business_memory_backfilled",
  business_memory_backfilled: "business_memory_verified",
  business_memory_verified: "assistant_projection_ready",
  assistant_projection_ready: "canonical_runtime",
  canonical_runtime: "legacy_retired",
  legacy_retired: null,
};

const stateSet: ReadonlySet<string> = new Set(PROJECT_MIGRATION_STATES);

/** Parses database values without allowing unchecked state casts at the boundary. */
export function parseProjectMigrationState(value: unknown): ProjectMigrationState {
  if (typeof value === "string" && stateSet.has(value)) {
    const state = PROJECT_MIGRATION_STATES.find((candidate) => candidate === value);
    if (state) return state;
  }
  throw new Error("AI_BUILDER_INVALID_PERSISTED_MIGRATION_STATE");
}

export function isValidProjectMigrationTransition(current: ProjectMigrationState, next: ProjectMigrationState): boolean {
  return PROJECT_MIGRATION_TRANSITIONS[current] === next;
}
