import "server-only";

import { Pool, type PoolClient } from "@neondatabase/serverless";
import { buildAssistantProjection } from "./buildAssistantProjection";
import { ASSISTANT_PROJECTION_SCHEMA_VERSION, ASSISTANT_PROJECTION_VERSION, type AssistantProjection, type AssistantProjectionInvalidationState, type PersistedAssistantProjectionRecord } from "./contracts";
import { getPersistedAssistantProjection, invalidateAssistantProjectionForBusinessMemoryChange, loadPersistedBusinessMemory, markAssistantProjectionFailedIfUnchanged, updateAssistantProjectionInvalidationState, upsertPersistedAssistantProjection } from "./persistence";

type QueryClient = Pick<PoolClient, "query">;
let pool: Pool | null = null;
const transactionPool = () => (pool ??= new Pool({ connectionString: process.env.DATABASE_URL }));
export type AssistantProjectionStaleReason = "fingerprint_mismatch" | "projection_version_mismatch" | "schema_version_mismatch" | "invalidation_state";
export type AssistantProjectionFreshness = { status: "missing" } | { status: "current"; record: PersistedAssistantProjectionRecord } | { status: "stale"; reasons: AssistantProjectionStaleReason[]; record: PersistedAssistantProjectionRecord };
export type RebuildAssistantProjectionResult = { record: PersistedAssistantProjectionRecord; rebuilt: boolean; previousState: AssistantProjectionInvalidationState | "missing" };
export type AssistantProjectionRebuildFailureContext = { projectId: string; previousFingerprint: string; previousGeneratedAt: string; previousUpdatedAt: string; previousState: AssistantProjectionInvalidationState };
export class AssistantProjectionLifecycleError extends Error { constructor(readonly code: string) { super(code); this.name = "AssistantProjectionLifecycleError"; } }
export class AssistantProjectionRebuildError extends Error { constructor(readonly cause: unknown, readonly failureContext?: AssistantProjectionRebuildFailureContext) { super("assistant_projection_rebuild_failed"); this.name = "AssistantProjectionRebuildError"; } }

export function evaluateAssistantProjectionFreshnessForRecord(record: PersistedAssistantProjectionRecord | null, projection: AssistantProjection): AssistantProjectionFreshness {
  if (!record) return { status: "missing" };
  if (record.projectId !== projection.projectId) throw new AssistantProjectionLifecycleError("assistant_projection_project_id_mismatch");
  const reasons: AssistantProjectionStaleReason[] = [];
  if (record.businessMemoryFingerprint !== projection.businessMemoryFingerprint) reasons.push("fingerprint_mismatch");
  if (record.projectionVersion !== ASSISTANT_PROJECTION_VERSION) reasons.push("projection_version_mismatch");
  if (record.schemaVersion !== ASSISTANT_PROJECTION_SCHEMA_VERSION) reasons.push("schema_version_mismatch");
  if (record.invalidationState !== "valid") reasons.push("invalidation_state");
  return reasons.length ? { status: "stale", reasons, record } : { status: "current", record };
}
export async function evaluateAssistantProjectionFreshness(input: { client: QueryClient; projection: AssistantProjection }): Promise<AssistantProjectionFreshness> { return evaluateAssistantProjectionFreshnessForRecord(await getPersistedAssistantProjection(input.client, input.projection.projectId), input.projection); }
export async function invalidateAssistantProjectionIfStale(input: { client: QueryClient; projection: AssistantProjection }): Promise<AssistantProjectionFreshness> { const result = await evaluateAssistantProjectionFreshness(input); if (result.status !== "stale" || result.record.invalidationState === "invalidated" || result.record.invalidationState === "rebuilding") return result; const record = await invalidateAssistantProjectionForBusinessMemoryChange(input.client, input.projection.projectId); return record ? { status: "stale", reasons: result.reasons, record } : result; }
export async function invalidateAssistantProjectionForCommittedBusinessMemory(client: QueryClient, projectId: string): Promise<void> { await invalidateAssistantProjectionForBusinessMemoryChange(client, projectId); }

/** Caller owns the transaction.  The project lock is acquired before every read of Business Memory. */
export async function rebuildAssistantProjectionInTransaction(input: { client: QueryClient; projectId: string }): Promise<RebuildAssistantProjectionResult> {
  await input.client.query("SELECT id FROM ai_builder_projects WHERE id=$1 FOR UPDATE", [input.projectId]);
  return rebuildAssistantProjectionAfterProjectLock(input);
}

async function rebuildAssistantProjectionAfterProjectLock(input: { client: QueryClient; projectId: string }): Promise<RebuildAssistantProjectionResult> {
  const businessMemory = await loadPersistedBusinessMemory(input.client, input.projectId);
  if (!businessMemory) throw new AssistantProjectionLifecycleError("assistant_projection_business_memory_missing");
  const projection = buildAssistantProjection(businessMemory);
  const existing = await getPersistedAssistantProjection(input.client, input.projectId);
  const freshness = evaluateAssistantProjectionFreshnessForRecord(existing, projection);
  if (freshness.status === "current") return { record: freshness.record, rebuilt: false, previousState: "valid" };
  const previousState = existing?.invalidationState ?? "missing";
  if (existing && existing.invalidationState !== "rebuilding") await updateAssistantProjectionInvalidationState(input.client, input.projectId, "rebuilding");
  await input.client.query("SAVEPOINT assistant_projection_rebuild");
  try {
    const record = await upsertPersistedAssistantProjection(input.client, {
      ...projection,
      projectionVersion: ASSISTANT_PROJECTION_VERSION,
      schemaVersion: ASSISTANT_PROJECTION_SCHEMA_VERSION,
      projection,
    });
    await input.client.query("RELEASE SAVEPOINT assistant_projection_rebuild");
    return { record, rebuilt: true, previousState };
  }
  catch (cause) { await input.client.query("ROLLBACK TO SAVEPOINT assistant_projection_rebuild"); await input.client.query("RELEASE SAVEPOINT assistant_projection_rebuild"); throw new AssistantProjectionRebuildError(cause, existing ? { projectId: input.projectId, previousFingerprint: existing.businessMemoryFingerprint, previousGeneratedAt: existing.generatedAt, previousUpdatedAt: existing.updatedAt, previousState: existing.invalidationState } : undefined); }
}
export async function ensureAssistantProjectionCurrentInTransaction(input: { client: QueryClient; projectId: string }): Promise<RebuildAssistantProjectionResult> { return rebuildAssistantProjectionInTransaction(input); }

/** Public server boundary: its second transaction durably records only the unchanged old artifact's failure. */
export async function rebuildAssistantProjectionForProject(input: { projectId: string; clerkUserId: string }): Promise<RebuildAssistantProjectionResult> {
  const client = await transactionPool().connect(); let failure: AssistantProjectionRebuildError | null = null;
  try { await client.query("BEGIN"); const owner = (await client.query("SELECT clerk_user_id FROM ai_builder_projects WHERE id=$1 FOR UPDATE", [input.projectId])).rows[0] as { clerk_user_id?: string } | undefined; if (!owner || owner.clerk_user_id !== input.clerkUserId) throw new AssistantProjectionLifecycleError("assistant_projection_project_not_found"); const result = await rebuildAssistantProjectionAfterProjectLock({ client, projectId: input.projectId }); await client.query("COMMIT"); return result; }
  catch (cause) { failure = cause instanceof AssistantProjectionRebuildError ? cause : null; await client.query("ROLLBACK").catch(() => undefined); if (!failure?.failureContext) throw cause; try { await client.query("BEGIN"); const owner = (await client.query("SELECT clerk_user_id FROM ai_builder_projects WHERE id=$1 FOR UPDATE", [input.projectId])).rows[0] as { clerk_user_id?: string } | undefined; if (owner?.clerk_user_id === input.clerkUserId) await markAssistantProjectionFailedIfUnchanged(client, { projectId: input.projectId, expectedFingerprint: failure.failureContext.previousFingerprint, expectedGeneratedAt: failure.failureContext.previousGeneratedAt, expectedUpdatedAt: failure.failureContext.previousUpdatedAt, allowedStates: [failure.failureContext.previousState, "rebuilding"] }); await client.query("COMMIT"); } catch (secondary) { await client.query("ROLLBACK").catch(() => undefined); (cause as Error & { failureRecordingError?: unknown }).failureRecordingError = secondary; } throw cause; }
  finally { client.release(); }
}
