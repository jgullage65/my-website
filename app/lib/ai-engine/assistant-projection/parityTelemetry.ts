import type { PoolClient } from "@neondatabase/serverless";
import type { KnowledgePack } from "../knowledge/contracts";
import { compareAssistantProjectionParity } from "./parity";
import type { ProjectRuntimeAuthority } from "../runtime-authority/projectRuntimeAuthority";
import { getPersistedAssistantProjection, upsertAssistantProjectionParityReport } from "./persistence";

export type AssistantProjectionParityDependencies = {
  connect: () => Promise<PoolClient>;
  getPersisted: typeof getPersistedAssistantProjection;
  compare: typeof compareAssistantProjectionParity;
  upsert: typeof upsertAssistantProjectionParityReport;
};

/**
 * Phase 9B observability. Its caller supplies the legacy comparison pack in
 * either authority mode; this non-throwing path never changes the response.
 */
export async function recordAssistantProjectionParity(
  projectId: string,
  legacy: KnowledgePack,
  dependencies: AssistantProjectionParityDependencies,
  activeRuntimeAuthority: ProjectRuntimeAuthority = "legacy",
): Promise<void> {
  let client: PoolClient | null = null;
  const comparedAt = new Date().toISOString();
  try {
    client = await dependencies.connect();
    const persisted = await dependencies.getPersisted(client, projectId);
    if (!persisted) throw new Error("assistant_projection_unavailable");
    const report = dependencies.compare({ projectId, legacy, canonicalProjection: persisted.projection, comparedAt });
    await dependencies.upsert(client, { projectId, comparedAt, runtimeVersion: legacy.version, assistantProjectionVersion: report.assistantProjectionVersion, assistantProjectionSchemaVersion: report.assistantProjectionSchemaVersion, artifactFingerprint: persisted.businessMemoryFingerprint, status: report.status, mismatchSummary: report.mismatchSummary, categoryBreakdown: report.categories, failureDetails: null, activeRuntimeAuthority });
  } catch (error) {
    // Canonical comparison and its durable telemetry are deliberately non-blocking.
    try { if (client) await dependencies.upsert(client, { projectId, comparedAt, runtimeVersion: legacy.version, assistantProjectionVersion: null, assistantProjectionSchemaVersion: null, artifactFingerprint: null, status: "COMPARISON_FAILURE", mismatchSummary: { total: 0, major: 0, minor: 0 }, categoryBreakdown: {}, failureDetails: { error: error instanceof Error ? error.message : "unknown_error" }, activeRuntimeAuthority }); } catch { /* telemetry persistence failure must not affect chat */ }
  } finally { client?.release(); }
}

/** Records a legacy comparison-load failure without affecting runtime serving. */
export async function recordAssistantProjectionParityComparisonFailure(
  projectId: string,
  dependencies: AssistantProjectionParityDependencies,
  activeRuntimeAuthority: ProjectRuntimeAuthority,
  failureCode: "legacy_comparison_load_failed",
): Promise<void> {
  let client: PoolClient | null = null;
  try {
    client = await dependencies.connect();
    const persisted = await dependencies.getPersisted(client, projectId);
    await dependencies.upsert(client, {
      projectId,
      comparedAt: new Date().toISOString(),
      // No legacy pack was loaded. Zero is the explicit non-version sentinel
      // required by the established NOT NULL legacy_runtime_version column.
      runtimeVersion: 0,
      assistantProjectionVersion: persisted?.projectionVersion ?? null,
      assistantProjectionSchemaVersion: persisted?.schemaVersion ?? null,
      artifactFingerprint: persisted?.businessMemoryFingerprint ?? null,
      status: "COMPARISON_FAILURE",
      mismatchSummary: { total: 0, major: 0, minor: 0 },
      categoryBreakdown: {},
      failureDetails: { code: failureCode },
      activeRuntimeAuthority,
    });
  } catch {
    // Durable parity telemetry must not control chat success.
  } finally {
    client?.release();
  }
}
