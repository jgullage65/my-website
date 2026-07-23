import "server-only";

import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "@neondatabase/serverless";
import { ensureAiBuilderSchema } from "@/app/lib/db/ai-builder-schema";

export const OPERATIONAL_EVENT_TYPES = ["review_command_failed","governance_transaction_failed","business_memory_rebuild_started","business_memory_rebuild_succeeded","business_memory_rebuild_failed","assistant_projection_rebuild_started","assistant_projection_rebuild_succeeded","assistant_projection_rebuild_failed","reconciliation_started","reconciliation_no_op","reconciliation_repaired","reconciliation_blocked","reconciliation_failed","drift_detected","drift_resolved","drift_unresolved","retry_scheduled","retry_started","retry_succeeded","retry_failed","dead_letter_entered","dead_letter_reopened","stale_running_recovered","migration_started","migration_checkpointed","migration_succeeded","migration_failed","runtime_cutover_succeeded","runtime_cutover_rejected","runtime_authority_mismatch"] as const;
export type OperationalEventType = typeof OPERATIONAL_EVENT_TYPES[number];
export type OperationalCategory = "review_governance" | "business_memory" | "assistant_projection" | "reconciliation" | "drift" | "retry_recovery" | "migration" | "runtime_cutover";
export type OperationalSeverity = "info" | "warning" | "error" | "critical";
export type OperationalOutcome = "started" | "succeeded" | "failed" | "blocked" | "no_op" | "detected" | "resolved" | "rejected" | "scheduled";
type QueryClient = Pick<PoolClient, "query">;

const categories = new Set<OperationalCategory>(["review_governance","business_memory","assistant_projection","reconciliation","drift","retry_recovery","migration","runtime_cutover"]);
const severities = new Set<OperationalSeverity>(["info","warning","error","critical"]);
const outcomes = new Set<OperationalOutcome>(["started","succeeded","failed","blocked","no_op","detected","resolved","rejected","scheduled"]);
const unsafeKey = /(?:content|prompt|token|secret|password|stack|row|payload|knowledge)/i;
const MAX_METADATA_BYTES = 4096;
const truncate = (value: string, size: number) => value.length <= size ? value : value.slice(0, size);

export type OperationalEventInput = {
  projectId: string; eventType: OperationalEventType; category: OperationalCategory; severity: OperationalSeverity; outcome: OperationalOutcome; sourceComponent: string;
  correlationId?: string; commandId?: string; synchronizationJobId?: string; synchronizationAttemptId?: string; migrationRunId?: string;
  trustedKnowledgeRevision?: number; businessMemoryRevision?: number; assistantProjectionFingerprint?: string; expectedValue?: string; observedValue?: string;
  errorCode?: string; errorMessage?: string; metadata?: Record<string, unknown>; occurredAt?: Date;
};

/** Rejects data-shaped metadata rather than attempting to redact private knowledge. */
export function sanitizeOperationalMetadata(metadata: Record<string, unknown> = {}): Record<string, unknown> {
  const visit = (value: unknown, depth: number): unknown => {
    if (depth > 3) throw new Error("operational_event_metadata_too_deep");
    if (value === null || typeof value === "boolean" || typeof value === "number") return value;
    if (typeof value === "string") return truncate(value, 256);
    if (Array.isArray(value)) { if (value.length > 20) throw new Error("operational_event_metadata_array_too_large"); return value.map(item => visit(item, depth + 1)); }
    if (!value || typeof value !== "object") throw new Error("operational_event_metadata_invalid_value");
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) { if (unsafeKey.test(key)) throw new Error("operational_event_metadata_unsafe_key"); out[key] = visit(item, depth + 1); }
    return out;
  };
  const safe = visit(metadata, 0) as Record<string, unknown>;
  if (Buffer.byteLength(JSON.stringify(safe), "utf8") > MAX_METADATA_BYTES) throw new Error("operational_event_metadata_too_large");
  return safe;
}

export function safeOperationalError(error: unknown): { errorCode: string; errorMessage: string } {
  const candidate = error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : "operational_error";
  const message = error instanceof Error ? error.message : "Operational operation failed.";
  return { errorCode: truncate(candidate.replace(/[^a-zA-Z0-9_.:-]/g, "_"), 128), errorMessage: truncate(message.replace(/[\r\n\t]+/g, " "), 512) };
}

export async function writeOperationalEvent(client: QueryClient, input: OperationalEventInput): Promise<string> {
  if (!OPERATIONAL_EVENT_TYPES.includes(input.eventType) || !categories.has(input.category) || !severities.has(input.severity) || !outcomes.has(input.outcome)) throw new Error("invalid_operational_event_contract");
  const metadata = sanitizeOperationalMetadata(input.metadata);
  const id = randomUUID();
  await client.query(`INSERT INTO ai_builder_operational_events (id,project_id,event_type,category,severity,outcome,source_component,correlation_id,command_id,synchronization_job_id,synchronization_attempt_id,migration_run_id,trusted_knowledge_revision,business_memory_revision,assistant_projection_fingerprint,expected_value,observed_value,error_code,error_message,metadata,occurred_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,$21::timestamptz)`, [id,input.projectId,input.eventType,input.category,input.severity,input.outcome,truncate(input.sourceComponent,128),input.correlationId ?? null,input.commandId ?? null,input.synchronizationJobId ?? null,input.synchronizationAttemptId ?? null,input.migrationRunId ?? null,input.trustedKnowledgeRevision ?? null,input.businessMemoryRevision ?? null,input.assistantProjectionFingerprint ?? null,input.expectedValue ? truncate(input.expectedValue,256) : null,input.observedValue ? truncate(input.observedValue,256) : null,input.errorCode ? truncate(input.errorCode,128) : null,input.errorMessage ? truncate(input.errorMessage,512) : null,JSON.stringify(metadata),(input.occurredAt ?? new Date()).toISOString()]);
  return id;
}

let pool: Pool | null = null;
/** Failure telemetry is deliberately best-effort and never masks the business error. */
export async function writeOperationalFailureAfterRollback(input: OperationalEventInput, originalError?: unknown): Promise<void> {
  try { await ensureAiBuilderSchema(); const client = await (pool ??= new Pool({ connectionString: process.env.DATABASE_URL })).connect(); try { await client.query("BEGIN"); await writeOperationalEvent(client, input); await client.query("COMMIT"); } finally { client.release(); } }
  catch (telemetryError) { if (originalError && typeof originalError === "object") (originalError as Error & { telemetryPersistenceError?: unknown }).telemetryPersistenceError = telemetryError; else console.error("operational telemetry persistence failed", telemetryError); }
}

export async function recentOperationalEvents(client: QueryClient, where: "project" | "type" | "job" | "command" | "migration", value: string, limit = 50) {
  const column = { project: "project_id", type: "event_type", job: "synchronization_job_id", command: "command_id", migration: "migration_run_id" }[where];
  return (await client.query(`SELECT * FROM ai_builder_operational_events WHERE ${column}=$1 ORDER BY occurred_at DESC,id DESC LIMIT $2`, [value, Math.max(1, Math.min(limit, 200))])).rows;
}
export const recentEventsForProject = (client: QueryClient, projectId: string, limit?: number) => recentOperationalEvents(client, "project", projectId, limit);
export const eventsByType = (client: QueryClient, type: OperationalEventType, limit?: number) => recentOperationalEvents(client, "type", type, limit);
export const eventsForSynchronizationJob = (client: QueryClient, jobId: string, limit?: number) => recentOperationalEvents(client, "job", jobId, limit);
export const eventsForCommand = (client: QueryClient, commandId: string, limit?: number) => recentOperationalEvents(client, "command", commandId, limit);
export const eventsForMigrationRun = (client: QueryClient, runId: string, limit?: number) => recentOperationalEvents(client, "migration", runId, limit);
export async function unresolvedDriftEvents(client: QueryClient, projectId: string, limit = 50) { return (await client.query("SELECT * FROM ai_builder_operational_events WHERE project_id=$1 AND event_type IN ('drift_detected','drift_unresolved','reconciliation_blocked') ORDER BY occurred_at DESC,id DESC LIMIT $2", [projectId, Math.max(1, Math.min(limit, 200))])).rows; }
export async function recentDeadLetterEntries(client: QueryClient, projectId: string, limit = 50) { return (await client.query("SELECT * FROM ai_builder_operational_events WHERE project_id=$1 AND event_type IN ('dead_letter_entered','dead_letter_reopened') ORDER BY occurred_at DESC,id DESC LIMIT $2", [projectId, Math.max(1, Math.min(limit, 200))])).rows; }
export async function runtimeAuthorityMismatches(client: QueryClient, projectId: string, limit = 50) { return (await client.query("SELECT * FROM ai_builder_operational_events WHERE project_id=$1 AND event_type='runtime_authority_mismatch' ORDER BY occurred_at DESC,id DESC LIMIT $2", [projectId, Math.max(1, Math.min(limit, 200))])).rows; }
