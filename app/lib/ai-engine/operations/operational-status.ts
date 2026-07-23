import "server-only";
import type { PoolClient } from "@neondatabase/serverless";
type QueryClient = Pick<PoolClient, "query">;
/** Computed read model: no mutable status document is maintained. */
export async function getOperationalStatus(client: QueryClient, projectId: string) {
  const [project, memory, projection, jobs, latestFailure, latestEvent, migration] = await Promise.all([
    client.query("SELECT runtime_authority,migration_state,migration_run_id,migration_revision FROM ai_builder_projects WHERE id=$1", [projectId]),
    client.query("SELECT revision,trusted_knowledge_revision,state_fingerprint FROM ai_builder_business_memory WHERE project_id=$1", [projectId]),
    client.query("SELECT business_memory_fingerprint,invalidation_state,projection_version,schema_version FROM ai_builder_assistant_projections WHERE project_id=$1", [projectId]),
    client.query("SELECT status,count(*)::int AS count FROM ai_builder_downstream_synchronization_jobs WHERE project_id=$1 GROUP BY status", [projectId]),
    client.query("SELECT event_type,error_code,error_message,occurred_at FROM ai_builder_operational_events WHERE project_id=$1 AND event_type IN ('review_command_failed','governance_transaction_failed') ORDER BY occurred_at DESC,id DESC LIMIT 1", [projectId]),
    client.query("SELECT occurred_at FROM ai_builder_operational_events WHERE project_id=$1 ORDER BY occurred_at DESC,id DESC LIMIT 1", [projectId]),
    client.query("SELECT event_type,occurred_at,metadata FROM ai_builder_operational_events WHERE project_id=$1 AND event_type IN ('drift_detected','drift_unresolved','drift_resolved','reconciliation_blocked') ORDER BY occurred_at DESC,id DESC LIMIT 1", [projectId]),
  ]);
  const p = project.rows[0] ?? null, artifact = projection.rows[0] ?? null;
  return { projectId, latestReviewOrGovernanceFailure: latestFailure.rows[0] ?? null, synchronizationJobCounts: Object.fromEntries(jobs.rows.map((row: any) => [row.status, Number(row.count)])), latestRetryOrDeadLetter: jobs.rows.filter((row: any) => row.status === "retry_scheduled" || row.status === "dead_letter"), migration: p && { state: p.migration_state, runId: p.migration_run_id, revision: p.migration_revision }, businessMemory: memory.rows[0] ?? null, projection: artifact && { fingerprint: artifact.business_memory_fingerprint, valid: artifact.invalidation_state === "valid", version: artifact.projection_version, schemaVersion: artifact.schema_version }, unresolvedDrift: migration.rows[0] ?? null, runtimeAuthority: p?.runtime_authority ?? null, cutoverEligible: Boolean(artifact?.invalidation_state === "valid" && p?.runtime_authority !== "canonical"), latestOperationalEventAt: latestEvent.rows[0]?.occurred_at ?? null };
}
