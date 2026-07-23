import "server-only";

import type { PoolClient } from "@neondatabase/serverless";
import type { BusinessMemory } from "../business-memory/contracts";
import { buildAssistantProjection } from "./buildAssistantProjection";
import { ASSISTANT_PROJECTION_SCHEMA_VERSION, ASSISTANT_PROJECTION_VERSION, type AssistantProjection, type AssistantProjectionInvalidationState, type PersistedAssistantProjectionRecord } from "./contracts";
import { getPersistedAssistantProjection, getPersistedAssistantProjectionForUpdate, updateAssistantProjectionInvalidationState, upsertPersistedAssistantProjection } from "./persistence";

type QueryClient = Pick<PoolClient, "query">;
export type AssistantProjectionStaleReason = "fingerprint_mismatch" | "projection_version_mismatch" | "schema_version_mismatch" | "invalidation_state";
export type AssistantProjectionFreshness =
  | { status: "missing" }
  | { status: "current"; record: PersistedAssistantProjectionRecord }
  | { status: "stale"; reasons: AssistantProjectionStaleReason[]; record: PersistedAssistantProjectionRecord };
export type RebuildAssistantProjectionResult = { record: PersistedAssistantProjectionRecord; rebuilt: boolean; previousState: AssistantProjectionInvalidationState | "missing" };
export type AssistantProjectionTransaction = <T>(work: (client: QueryClient) => Promise<T>) => Promise<T>;

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
  const record = await updateAssistantProjectionInvalidationState(input.client, projection.projectId, "invalidated");
  return { status: "stale", reasons: result.reasons, record: record! };
}

async function rebuildLocked(client: QueryClient, projection: AssistantProjection): Promise<RebuildAssistantProjectionResult> {
  const existing = await getPersistedAssistantProjectionForUpdate(client, projection.projectId);
  const state = evaluateAssistantProjectionFreshnessForRecord(existing, projection);
  if (state.status === "current") return { record: state.record, rebuilt: false, previousState: "valid" };
  const previousState = existing?.invalidationState ?? "missing";
  if (existing) {
    // Guarded transitions: valid|invalidated|failed -> rebuilding only.
    if (existing.invalidationState !== "rebuilding") await updateAssistantProjectionInvalidationState(client, projection.projectId, "rebuilding");
  }
  try {
    const record = await upsertPersistedAssistantProjection(client, { ...projection, projection });
    return { record, rebuilt: true, previousState };
  } catch (error) {
    // The upsert is atomic.  A failed rebuild therefore leaves the old payload,
    // fingerprint, and generatedAt in place before this metadata transition.
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
export async function rebuildAssistantProjection(input: { client: QueryClient; businessMemory?: BusinessMemory; projection?: AssistantProjection; transaction?: AssistantProjectionTransaction }): Promise<RebuildAssistantProjectionResult> {
  const projection = input.projection ?? buildAssistantProjection(input.businessMemory!);
  return input.transaction ? input.transaction((client) => rebuildLocked(client, projection)) : rebuildLocked(input.client, projection);
}

/** Explicit orchestration entry point for mutations/migrations that require a current artifact. */
export async function ensureAssistantProjectionCurrent(input: { client: QueryClient; businessMemory?: BusinessMemory; projection?: AssistantProjection; transaction?: AssistantProjectionTransaction }): Promise<RebuildAssistantProjectionResult> {
  return rebuildAssistantProjection(input);
}
