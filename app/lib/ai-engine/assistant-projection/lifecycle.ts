import "server-only";

import type { PoolClient } from "@neondatabase/serverless";
import type { BusinessMemory } from "../business-memory/contracts";
import { buildAssistantProjection } from "./buildAssistantProjection";
import { ASSISTANT_PROJECTION_SCHEMA_VERSION, ASSISTANT_PROJECTION_VERSION, type AssistantProjection, type AssistantProjectionInvalidationState, type PersistedAssistantProjectionRecord } from "./contracts";
import { getPersistedAssistantProjection, getPersistedAssistantProjectionForUpdate, invalidateAssistantProjectionForBusinessMemoryChange, updateAssistantProjectionInvalidationState, upsertPersistedAssistantProjection } from "./persistence";

type QueryClient = Pick<PoolClient, "query">;
export type AssistantProjectionStaleReason = "fingerprint_mismatch" | "projection_version_mismatch" | "schema_version_mismatch" | "invalidation_state";
export type AssistantProjectionFreshness =
  | { status: "missing" }
  | { status: "current"; record: PersistedAssistantProjectionRecord }
  | { status: "stale"; reasons: AssistantProjectionStaleReason[]; record: PersistedAssistantProjectionRecord };
export type RebuildAssistantProjectionResult = { record: PersistedAssistantProjectionRecord; rebuilt: boolean; previousState: AssistantProjectionInvalidationState | "missing" };

export function evaluateAssistantProjectionFreshnessForRecord(record: PersistedAssistantProjectionRecord | null, projection: AssistantProjection): AssistantProjectionFreshness {
  if (!record) return { status: "missing" };
  const reasons: AssistantProjectionStaleReason[] = [];
  if (record.projectId !== projection.projectId || record.businessMemoryFingerprint !== projection.businessMemoryFingerprint) reasons.push("fingerprint_mismatch");
  if (record.projectionVersion !== ASSISTANT_PROJECTION_VERSION) reasons.push("projection_version_mismatch");
  if (record.schemaVersion !== ASSISTANT_PROJECTION_SCHEMA_VERSION) reasons.push("schema_version_mismatch");
  if (record.invalidationState !== "valid") reasons.push("invalidation_state");
  return reasons.length ? { status: "stale", reasons, record } : { status: "current", record };
}

/** Evaluates deterministic content and durable lifecycle metadata; timestamps are intentionally irrelevant. */
export async function evaluateAssistantProjectionFreshness(input: { client: QueryClient; businessMemory?: BusinessMemory; projection?: AssistantProjection }): Promise<AssistantProjectionFreshness> {
  const projection = input.projection ?? buildAssistantProjection(input.businessMemory!);
  return evaluateAssistantProjectionFreshnessForRecord(await getPersistedAssistantProjection(input.client, projection.projectId), projection);
}

/** Marks only stale artifacts invalidated and never rewrites their payload or generatedAt. */
export async function invalidateAssistantProjectionIfStale(input: { client: QueryClient; businessMemory?: BusinessMemory; projection?: AssistantProjection }): Promise<AssistantProjectionFreshness> {
  const projection = input.projection ?? buildAssistantProjection(input.businessMemory!);
  const result = await evaluateAssistantProjectionFreshness({ client: input.client, projection });
  if (result.status !== "stale" || result.record.invalidationState === "invalidated") return result;
  // rebuilding is owned by its active rebuild; it must not be moved backwards.
  if (result.record.invalidationState === "rebuilding") return result;
  const record = await invalidateAssistantProjectionForBusinessMemoryChange(input.client, projection.projectId);
  // A concurrent rebuild or failure won the lifecycle transition.  Preserve
  // that state instead of moving it backwards to invalidated.
  return record
    ? { status: "stale", reasons: result.reasons, record }
    : result;
}

/** Marks a previously current artifact stale after a material Business Memory commit. */
export async function invalidateAssistantProjectionForCommittedBusinessMemory(client: QueryClient, projectId: string): Promise<void> {
  await invalidateAssistantProjectionForBusinessMemoryChange(client, projectId);
}

async function rebuildLocked(client: QueryClient, businessMemory: BusinessMemory): Promise<RebuildAssistantProjectionResult> {
  // This lock deliberately precedes generation: a waiting rebuild must derive
  // from the canonical state visible after the preceding transaction commits.
  const projectId = businessMemory.projectId;
  const existing = await getPersistedAssistantProjectionForUpdate(client, projectId);
  const projection = buildAssistantProjection(businessMemory);
  const state = evaluateAssistantProjectionFreshnessForRecord(existing, projection);
  if (state.status === "current") return { record: state.record, rebuilt: false, previousState: "valid" };
  const previousState = existing?.invalidationState ?? "missing";
  if (existing) {
    // Guarded transitions: valid|invalidated|failed -> rebuilding only.
    if (existing.invalidationState !== "rebuilding") await updateAssistantProjectionInvalidationState(client, projection.projectId, "rebuilding");
  }
  await client.query("SAVEPOINT assistant_projection_rebuild");
  try {
    const record = await upsertPersistedAssistantProjection(client, { ...projection, projection });
    await client.query("RELEASE SAVEPOINT assistant_projection_rebuild");
    return { record, rebuilt: true, previousState };
  } catch (error) {
    // PostgreSQL marks a transaction aborted after a failed write.  Roll back
    // only the rebuild attempt, then make the failed lifecycle state durable
    // in the caller's transaction before returning the original error.
    await client.query("ROLLBACK TO SAVEPOINT assistant_projection_rebuild");
    await client.query("RELEASE SAVEPOINT assistant_projection_rebuild");
    if (existing) {
      try { await updateAssistantProjectionInvalidationState(client, projection.projectId, "failed"); } catch { /* preserve original failure */ }
    }
    throw error;
  }
}

/**
 * Rebuilds inside a caller-supplied transaction. The project FOR UPDATE lock
 * serializes same-project attempts and forces the second waiter to re-check.
 */
export async function rebuildAssistantProjectionInTransaction(input: { client: QueryClient; businessMemory: BusinessMemory }): Promise<RebuildAssistantProjectionResult> {
  return rebuildLocked(input.client, input.businessMemory);
}

/** Explicit orchestration entry point for mutations/migrations that require a current artifact. */
export async function ensureAssistantProjectionCurrentInTransaction(input: { client: QueryClient; businessMemory: BusinessMemory }): Promise<RebuildAssistantProjectionResult> {
  return rebuildAssistantProjectionInTransaction(input);
}
