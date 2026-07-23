import type { PoolClient } from "@neondatabase/serverless";
import type { KnowledgePack } from "../knowledge/contracts";
import { compareAssistantProjectionParity } from "./parity";
import { getPersistedAssistantProjection, upsertAssistantProjectionParityReport } from "./persistence";

export type AssistantProjectionParityDependencies = {
  connect: () => Promise<PoolClient>;
  getPersisted: typeof getPersistedAssistantProjection;
  compare: typeof compareAssistantProjectionParity;
  upsert: typeof upsertAssistantProjectionParityReport;
};

/**
 * Phase 9A observability only. Its caller starts this alongside legacy chat
 * work, then awaits this non-throwing promise before a successful response is
 * returned. Trusted Knowledge remains the sole runtime authority.
 */
export async function recordAssistantProjectionParity(
  projectId: string,
  legacy: KnowledgePack,
  dependencies: AssistantProjectionParityDependencies,
): Promise<void> {
  let client: PoolClient | null = null;
  const comparedAt = new Date().toISOString();
  try {
    client = await dependencies.connect();
    const persisted = await dependencies.getPersisted(client, projectId);
    if (!persisted) throw new Error("assistant_projection_unavailable");
    const report = dependencies.compare({ projectId, legacy, canonicalProjection: persisted.projection, comparedAt });
    await dependencies.upsert(client, { projectId, comparedAt, runtimeVersion: legacy.version, assistantProjectionVersion: report.assistantProjectionVersion, assistantProjectionSchemaVersion: report.assistantProjectionSchemaVersion, status: report.status, mismatchSummary: report.mismatchSummary, categoryBreakdown: report.categories, failureDetails: null });
  } catch (error) {
    // Canonical comparison and its durable telemetry are deliberately non-blocking.
    try { if (client) await dependencies.upsert(client, { projectId, comparedAt, runtimeVersion: legacy.version, assistantProjectionVersion: null, assistantProjectionSchemaVersion: null, status: "COMPARISON_FAILURE", mismatchSummary: { total: 0, major: 0, minor: 0 }, categoryBreakdown: {}, failureDetails: { error: error instanceof Error ? error.message : "unknown_error" } }); } catch { /* telemetry persistence failure must not affect chat */ }
  } finally { client?.release(); }
}
