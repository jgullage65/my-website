import "server-only";

import type { PoolClient } from "@neondatabase/serverless";
import {
  ASSISTANT_PROJECTION_SCHEMA_VERSION,
  ASSISTANT_PROJECTION_VERSION,
  type AssistantProjection,
  type AssistantProjectionInvalidationState,
  type PersistedAssistantProjectionRecord,
} from "./contracts";

type DatabaseRow = Record<string, unknown>;
type QueryClient = Pick<PoolClient, "query">;

const invalidationStates = new Set<AssistantProjectionInvalidationState>([
  "valid", "invalidated", "rebuilding", "failed",
]);
const requiredProjectionFields = [
  "projectId", "businessMemoryFingerprint", "projectionVersion", "schemaVersion",
  "identity", "assistant", "services", "pricing", "policies", "faqs",
  "restrictions", "relationships", "sources", "evidence", "missingInformation",
] as const;

export class AssistantProjectionPersistenceError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "AssistantProjectionPersistenceError";
    this.code = code;
  }
}

export type UpsertPersistedAssistantProjectionInput = {
  projectId: string;
  businessMemoryFingerprint: string;
  projectionVersion: typeof ASSISTANT_PROJECTION_VERSION;
  schemaVersion: typeof ASSISTANT_PROJECTION_SCHEMA_VERSION;
  projection: AssistantProjection;
  /** The persistence operation supplies this when a caller does not. */
  generatedAt?: string;
  invalidationState?: AssistantProjectionInvalidationState;
};

function requiredText(value: unknown, code: string): string {
  if (typeof value !== "string" || !value) throw new AssistantProjectionPersistenceError(code);
  return value;
}

function timestamp(value: unknown, code: string): string {
  const text = requiredText(value, code);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new AssistantProjectionPersistenceError(code);
  return date.toISOString();
}

function version(value: unknown, expected: number, code: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value !== expected) {
    throw new AssistantProjectionPersistenceError(code);
  }
  return value;
}

function projectionObject(value: unknown, code: string): AssistantProjection {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AssistantProjectionPersistenceError(code);
  }
  if (!requiredProjectionFields.every((field) => Object.prototype.hasOwnProperty.call(value, field))) {
    throw new AssistantProjectionPersistenceError(code);
  }
  return value as AssistantProjection;
}

/** Reject metadata/payload divergence before a single SQL write is issued. */
export function validatePersistedAssistantProjectionWrite(input: UpsertPersistedAssistantProjectionInput): void {
  const projection = projectionObject(input.projection, "assistant_projection_invalid_payload");
  if (requiredText(input.projectId, "assistant_projection_invalid_project_id") !== requiredText(projection.projectId, "assistant_projection_invalid_payload_project_id")) throw new AssistantProjectionPersistenceError("assistant_projection_project_id_mismatch");
  if (requiredText(input.businessMemoryFingerprint, "assistant_projection_invalid_fingerprint") !== requiredText(projection.businessMemoryFingerprint, "assistant_projection_invalid_payload_fingerprint")) throw new AssistantProjectionPersistenceError("assistant_projection_fingerprint_mismatch");
  if (version(input.projectionVersion, ASSISTANT_PROJECTION_VERSION, "assistant_projection_invalid_projection_version") !== version(projection.projectionVersion, ASSISTANT_PROJECTION_VERSION, "assistant_projection_invalid_payload_projection_version")) throw new AssistantProjectionPersistenceError("assistant_projection_projection_version_mismatch");
  if (version(input.schemaVersion, ASSISTANT_PROJECTION_SCHEMA_VERSION, "assistant_projection_invalid_schema_version") !== version(projection.schemaVersion, ASSISTANT_PROJECTION_SCHEMA_VERSION, "assistant_projection_invalid_payload_schema_version")) throw new AssistantProjectionPersistenceError("assistant_projection_schema_version_mismatch");
  if (input.generatedAt !== undefined) timestamp(input.generatedAt, "assistant_projection_invalid_generated_at");
  if (input.invalidationState !== undefined && !invalidationStates.has(input.invalidationState)) throw new AssistantProjectionPersistenceError("assistant_projection_invalid_invalidation_state");
}

/** Focused boundary validation; full DTO semantics remain owned by the generator. */
export function parsePersistedAssistantProjectionRecord(row: DatabaseRow): PersistedAssistantProjectionRecord {
  const projectId = requiredText(row.project_id, "assistant_projection_invalid_row_project_id");
  const fingerprint = requiredText(row.business_memory_fingerprint, "assistant_projection_invalid_row_fingerprint");
  const projectionVersion = version(row.projection_version, ASSISTANT_PROJECTION_VERSION, "assistant_projection_invalid_row_projection_version") as typeof ASSISTANT_PROJECTION_VERSION;
  const schemaVersion = version(row.schema_version, ASSISTANT_PROJECTION_SCHEMA_VERSION, "assistant_projection_invalid_row_schema_version") as typeof ASSISTANT_PROJECTION_SCHEMA_VERSION;
  const invalidationState = requiredText(row.invalidation_state, "assistant_projection_invalid_row_invalidation_state") as AssistantProjectionInvalidationState;
  if (!invalidationStates.has(invalidationState)) throw new AssistantProjectionPersistenceError("assistant_projection_invalid_row_invalidation_state");
  const projection = projectionObject(row.projection_json, "assistant_projection_invalid_projection_json");
  if (requiredText(projection.projectId, "assistant_projection_invalid_payload_project_id") !== projectId) throw new AssistantProjectionPersistenceError("assistant_projection_row_project_id_mismatch");
  if (requiredText(projection.businessMemoryFingerprint, "assistant_projection_invalid_payload_fingerprint") !== fingerprint) throw new AssistantProjectionPersistenceError("assistant_projection_row_fingerprint_mismatch");
  if (version(projection.projectionVersion, ASSISTANT_PROJECTION_VERSION, "assistant_projection_invalid_payload_projection_version") !== projectionVersion) throw new AssistantProjectionPersistenceError("assistant_projection_row_projection_version_mismatch");
  if (version(projection.schemaVersion, ASSISTANT_PROJECTION_SCHEMA_VERSION, "assistant_projection_invalid_payload_schema_version") !== schemaVersion) throw new AssistantProjectionPersistenceError("assistant_projection_row_schema_version_mismatch");
  return { projectId, businessMemoryFingerprint: fingerprint, projectionVersion, schemaVersion, generatedAt: timestamp(row.generated_at, "assistant_projection_invalid_row_generated_at"), invalidationState, projection, createdAt: timestamp(row.created_at, "assistant_projection_invalid_row_created_at"), updatedAt: timestamp(row.updated_at, "assistant_projection_invalid_row_updated_at") };
}

/** Reads the one current artifact for a project; callers enforce project ownership at their service boundary. */
export async function getPersistedAssistantProjection(client: QueryClient, projectId: string): Promise<PersistedAssistantProjectionRecord | null> {
  const result = await client.query("SELECT project_id,business_memory_fingerprint,projection_version,schema_version,generated_at,invalidation_state,projection_json,created_at,updated_at FROM ai_builder_assistant_projections WHERE project_id=$1", [projectId]);
  const row = (result.rows as DatabaseRow[])[0];
  return row ? parsePersistedAssistantProjectionRecord(row) : null;
}

/** Atomically replaces all artifact metadata and JSON for the project's one current row. */
export async function upsertPersistedAssistantProjection(client: QueryClient, input: UpsertPersistedAssistantProjectionInput): Promise<PersistedAssistantProjectionRecord> {
  validatePersistedAssistantProjectionWrite(input);
  const generatedAt = input.generatedAt ? timestamp(input.generatedAt, "assistant_projection_invalid_generated_at") : new Date().toISOString();
  const state = input.invalidationState ?? "valid";
  const result = await client.query(
    "INSERT INTO ai_builder_assistant_projections (project_id,business_memory_fingerprint,projection_version,schema_version,generated_at,invalidation_state,projection_json,created_at,updated_at) VALUES ($1,$2,$3,$4,$5::timestamptz,$6,$7::jsonb,NOW(),NOW()) ON CONFLICT (project_id) DO UPDATE SET business_memory_fingerprint=EXCLUDED.business_memory_fingerprint,projection_version=EXCLUDED.projection_version,schema_version=EXCLUDED.schema_version,generated_at=EXCLUDED.generated_at,invalidation_state=EXCLUDED.invalidation_state,projection_json=EXCLUDED.projection_json,updated_at=NOW() RETURNING project_id,business_memory_fingerprint,projection_version,schema_version,generated_at,invalidation_state,projection_json,created_at,updated_at",
    [input.projectId, input.businessMemoryFingerprint, input.projectionVersion, input.schemaVersion, generatedAt, state, JSON.stringify(input.projection)],
  );
  return parsePersistedAssistantProjectionRecord((result.rows as DatabaseRow[])[0]);
}

/** Changes only independently-queryable invalidation metadata for an existing artifact. */
export async function updateAssistantProjectionInvalidationState(client: QueryClient, projectId: string, invalidationState: AssistantProjectionInvalidationState): Promise<PersistedAssistantProjectionRecord | null> {
  if (!invalidationStates.has(invalidationState)) throw new AssistantProjectionPersistenceError("assistant_projection_invalid_invalidation_state");
  const result = await client.query(
    "UPDATE ai_builder_assistant_projections SET invalidation_state=$2,updated_at=NOW() WHERE project_id=$1 RETURNING project_id,business_memory_fingerprint,projection_version,schema_version,generated_at,invalidation_state,projection_json,created_at,updated_at",
    [projectId, invalidationState],
  );
  const row = (result.rows as DatabaseRow[])[0];
  return row ? parsePersistedAssistantProjectionRecord(row) : null;
}
