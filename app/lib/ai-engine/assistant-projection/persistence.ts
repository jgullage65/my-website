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
const identityStatuses = new Set<AssistantProjection["identity"]["status"]>([
  "resolved", "missing", "ambiguous",
]);
const businessMemoryFingerprintPattern = /^business_memory_[a-f0-9]{24}$/;
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

function persistedVersion(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) throw new AssistantProjectionPersistenceError(code);
  return value;
}

function validFingerprint(value: unknown, code: string): string {
  const text = requiredText(value, code);
  if (!businessMemoryFingerprintPattern.test(text)) throw new AssistantProjectionPersistenceError(code);
  return text;
}

function object(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AssistantProjectionPersistenceError(code);
  }
  return value as Record<string, unknown>;
}

function projectionObject(value: unknown, code: string, allowHistoricalVersion = false): AssistantProjection {
  const projection = object(value, code);
  if (!requiredProjectionFields.every((field) => Object.prototype.hasOwnProperty.call(projection, field))) {
    throw new AssistantProjectionPersistenceError(code);
  }
  requiredText(projection.projectId, code);
  validFingerprint(projection.businessMemoryFingerprint, code);
  if (allowHistoricalVersion) {
    persistedVersion(projection.projectionVersion, code);
    persistedVersion(projection.schemaVersion, code);
  } else {
    version(projection.projectionVersion, ASSISTANT_PROJECTION_VERSION, code);
    version(projection.schemaVersion, ASSISTANT_PROJECTION_SCHEMA_VERSION, code);
  }
  const identity = object(projection.identity, code);
  if (typeof identity.status !== "string" || !identityStatuses.has(identity.status as AssistantProjection["identity"]["status"])) {
    throw new AssistantProjectionPersistenceError(code);
  }
  object(projection.assistant, code);
  for (const field of ["services", "pricing", "policies", "faqs", "restrictions", "relationships", "sources", "evidence", "missingInformation"] as const) {
    if (!Array.isArray(projection[field])) throw new AssistantProjectionPersistenceError(code);
  }
  return projection as AssistantProjection;
}

/** Reject metadata/payload divergence before a single SQL write is issued. */
export function validatePersistedAssistantProjectionWrite(input: UpsertPersistedAssistantProjectionInput): void {
  const projection = projectionObject(input.projection, "assistant_projection_invalid_payload");
  if (requiredText(input.projectId, "assistant_projection_invalid_project_id") !== requiredText(projection.projectId, "assistant_projection_invalid_payload_project_id")) throw new AssistantProjectionPersistenceError("assistant_projection_project_id_mismatch");
  if (validFingerprint(input.businessMemoryFingerprint, "assistant_projection_invalid_fingerprint") !== validFingerprint(projection.businessMemoryFingerprint, "assistant_projection_invalid_payload_fingerprint")) throw new AssistantProjectionPersistenceError("assistant_projection_fingerprint_mismatch");
  if (version(input.projectionVersion, ASSISTANT_PROJECTION_VERSION, "assistant_projection_invalid_projection_version") !== version(projection.projectionVersion, ASSISTANT_PROJECTION_VERSION, "assistant_projection_invalid_payload_projection_version")) throw new AssistantProjectionPersistenceError("assistant_projection_projection_version_mismatch");
  if (version(input.schemaVersion, ASSISTANT_PROJECTION_SCHEMA_VERSION, "assistant_projection_invalid_schema_version") !== version(projection.schemaVersion, ASSISTANT_PROJECTION_SCHEMA_VERSION, "assistant_projection_invalid_payload_schema_version")) throw new AssistantProjectionPersistenceError("assistant_projection_schema_version_mismatch");
  if (input.generatedAt !== undefined) timestamp(input.generatedAt, "assistant_projection_invalid_generated_at");
}

/** Focused persisted-boundary validation; full DTO semantics remain owned by the generator. */
export function parsePersistedAssistantProjectionRecord(row: DatabaseRow): PersistedAssistantProjectionRecord {
  const projectId = requiredText(row.project_id, "assistant_projection_invalid_row_project_id");
  const fingerprint = validFingerprint(row.business_memory_fingerprint, "assistant_projection_invalid_row_fingerprint");
  const projectionVersion = persistedVersion(row.projection_version, "assistant_projection_invalid_row_projection_version");
  const schemaVersion = persistedVersion(row.schema_version, "assistant_projection_invalid_row_schema_version");
  const invalidationState = requiredText(row.invalidation_state, "assistant_projection_invalid_row_invalidation_state") as AssistantProjectionInvalidationState;
  if (!invalidationStates.has(invalidationState)) throw new AssistantProjectionPersistenceError("assistant_projection_invalid_row_invalidation_state");
  const projection = projectionObject(row.projection_json, "assistant_projection_invalid_projection_json", projectionVersion !== ASSISTANT_PROJECTION_VERSION || schemaVersion !== ASSISTANT_PROJECTION_SCHEMA_VERSION);
  if (requiredText(projection.projectId, "assistant_projection_invalid_payload_project_id") !== projectId) throw new AssistantProjectionPersistenceError("assistant_projection_row_project_id_mismatch");
  if (validFingerprint(projection.businessMemoryFingerprint, "assistant_projection_invalid_payload_fingerprint") !== fingerprint) throw new AssistantProjectionPersistenceError("assistant_projection_row_fingerprint_mismatch");
  if (persistedVersion(projection.projectionVersion, "assistant_projection_invalid_payload_projection_version") !== projectionVersion) throw new AssistantProjectionPersistenceError("assistant_projection_row_projection_version_mismatch");
  if (persistedVersion(projection.schemaVersion, "assistant_projection_invalid_payload_schema_version") !== schemaVersion) throw new AssistantProjectionPersistenceError("assistant_projection_row_schema_version_mismatch");
  return { projectId, businessMemoryFingerprint: fingerprint, projectionVersion, schemaVersion, generatedAt: timestamp(row.generated_at, "assistant_projection_invalid_row_generated_at"), invalidationState, projection, createdAt: timestamp(row.created_at, "assistant_projection_invalid_row_created_at"), updatedAt: timestamp(row.updated_at, "assistant_projection_invalid_row_updated_at") };
}

/**
 * Internal server-only, project-ID persistence primitive. It does not authenticate
 * or authorize callers; owner-scoped services/routes must resolve an owned project first.
 * No runtime or API consumer is introduced at this persistence boundary.
 */
export async function getPersistedAssistantProjection(client: QueryClient, projectId: string): Promise<PersistedAssistantProjectionRecord | null> {
  const result = await client.query("SELECT project_id,business_memory_fingerprint,projection_version,schema_version,generated_at,invalidation_state,projection_json,created_at,updated_at FROM ai_builder_assistant_projections WHERE project_id=$1", [projectId]);
  const row = (result.rows as DatabaseRow[])[0];
  return row ? parsePersistedAssistantProjectionRecord(row) : null;
}

/**
 * Locks the owning project before reading the artifact.  Locking the project,
 * rather than only an existing artifact row, also serializes first creation.
 * Call this inside the caller's database transaction.
 */
export async function getPersistedAssistantProjectionForUpdate(client: QueryClient, projectId: string): Promise<PersistedAssistantProjectionRecord | null> {
  await client.query("SELECT id FROM ai_builder_projects WHERE id=$1 FOR UPDATE", [projectId]);
  return getPersistedAssistantProjection(client, projectId);
}

/** Internal server-only primitive that atomically replaces a project's valid current artifact. */
export async function upsertPersistedAssistantProjection(client: QueryClient, input: UpsertPersistedAssistantProjectionInput): Promise<PersistedAssistantProjectionRecord> {
  validatePersistedAssistantProjectionWrite(input);
  const generatedAt = input.generatedAt !== undefined ? timestamp(input.generatedAt, "assistant_projection_invalid_generated_at") : new Date().toISOString();
  const result = await client.query(
    "INSERT INTO ai_builder_assistant_projections (project_id,business_memory_fingerprint,projection_version,schema_version,generated_at,invalidation_state,projection_json,created_at,updated_at) VALUES ($1,$2,$3,$4,$5::timestamptz,$6,$7::jsonb,NOW(),NOW()) ON CONFLICT (project_id) DO UPDATE SET business_memory_fingerprint=EXCLUDED.business_memory_fingerprint,projection_version=EXCLUDED.projection_version,schema_version=EXCLUDED.schema_version,generated_at=EXCLUDED.generated_at,invalidation_state=EXCLUDED.invalidation_state,projection_json=EXCLUDED.projection_json,updated_at=NOW() RETURNING project_id,business_memory_fingerprint,projection_version,schema_version,generated_at,invalidation_state,projection_json,created_at,updated_at",
    [input.projectId, input.businessMemoryFingerprint, input.projectionVersion, input.schemaVersion, generatedAt, "valid", JSON.stringify(input.projection)],
  );
  return parsePersistedAssistantProjectionRecord((result.rows as DatabaseRow[])[0]);
}

/** Internal server-only primitive that changes only independently-queryable invalidation metadata. */
export async function updateAssistantProjectionInvalidationState(client: QueryClient, projectId: string, invalidationState: AssistantProjectionInvalidationState): Promise<PersistedAssistantProjectionRecord | null> {
  if (!invalidationStates.has(invalidationState)) throw new AssistantProjectionPersistenceError("assistant_projection_invalid_invalidation_state");
  const result = await client.query(
    "UPDATE ai_builder_assistant_projections SET invalidation_state=$2,updated_at=NOW() WHERE project_id=$1 RETURNING project_id,business_memory_fingerprint,projection_version,schema_version,generated_at,invalidation_state,projection_json,created_at,updated_at",
    [projectId, invalidationState],
  );
  const row = (result.rows as DatabaseRow[])[0];
  return row ? parsePersistedAssistantProjectionRecord(row) : null;
}
