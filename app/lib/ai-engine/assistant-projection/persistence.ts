import "server-only";

import type { PoolClient } from "@neondatabase/serverless";
import type { BusinessMemory } from "../business-memory/contracts";
import type { ProjectRuntimeAuthority } from "../runtime-authority/projectRuntimeAuthority";
import {
  ASSISTANT_PROJECTION_SCHEMA_VERSION,
  ASSISTANT_PROJECTION_VERSION,
  type AssistantProjection,
  type AssistantProjectionInvalidationState,
  type PersistedAssistantProjectionRecord,
} from "./contracts";
import { AssistantProjectionRuntimeValidationError, validateAssistantProjectionRuntime } from "./validation";

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
  // Runtime writes validate these against the current constants below. Keeping
  // the input numeric lets the generated DTO retain its historical-read type.
  projectionVersion: number;
  schemaVersion: number;
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
  try { validateAssistantProjectionRuntime(projection as AssistantProjection); }
  catch (cause) { if (cause instanceof AssistantProjectionRuntimeValidationError) throw new AssistantProjectionPersistenceError(`${code}_${cause.code}`); throw cause; }
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
  const result = await client.query("SELECT project_id,business_memory_fingerprint,projection_version,schema_version,generated_at,invalidation_state,projection_json,created_at,updated_at FROM ai_builder_assistant_projections WHERE project_id=$1 FOR UPDATE", [projectId]);
  const row = (result.rows as DatabaseRow[])[0];
  return row ? parsePersistedAssistantProjectionRecord(row) : null;
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

/**
 * Records a Business Memory content commit without ever taking an active
 * rebuild (or its durable failure) backwards.  The predicate is part of the
 * write, rather than a preceding read, so it remains correct under races.
 */
export async function invalidateAssistantProjectionForBusinessMemoryChange(client: QueryClient, projectId: string): Promise<PersistedAssistantProjectionRecord | null> {
  const result = await client.query(
    "UPDATE ai_builder_assistant_projections SET invalidation_state='invalidated',updated_at=NOW() WHERE project_id=$1 AND invalidation_state='valid' RETURNING project_id,business_memory_fingerprint,projection_version,schema_version,generated_at,invalidation_state,projection_json,created_at,updated_at",
    [projectId],
  );
  const row = (result.rows as DatabaseRow[])[0];
  return row ? parsePersistedAssistantProjectionRecord(row) : null;
}


/** Reads the complete persisted Business Memory document using the caller transaction. */
export async function loadPersistedBusinessMemory(client: QueryClient, projectId: string): Promise<BusinessMemory | null> {
  const rootResult = await client.query("SELECT m.*, p.assistant_configuration FROM ai_builder_business_memory m JOIN ai_builder_projects p ON p.id=m.project_id WHERE m.project_id=$1", [projectId]);
  const root = (rootResult.rows as DatabaseRow[])[0];
  if (!root) return null;
  const memoryId = requiredText(root.id, "business_memory_invalid_row_id");
  const q = (sql: string) => client.query(sql, [memoryId]);
  const [entities, assertions, relationships, sources, evidence, assertionSources, assertionEvidence, conflicts, conflictAssertions, missing] = await Promise.all([
    q("SELECT * FROM ai_builder_business_memory_entities WHERE memory_id=$1 ORDER BY id"), q("SELECT * FROM ai_builder_business_memory_assertions WHERE memory_id=$1 ORDER BY id"), q("SELECT * FROM ai_builder_business_memory_relationships WHERE memory_id=$1 ORDER BY id"), q("SELECT * FROM ai_builder_business_memory_sources WHERE memory_id=$1 ORDER BY id"), q("SELECT * FROM ai_builder_business_memory_evidence WHERE memory_id=$1 ORDER BY id"), q("SELECT l.assertion_id,l.source_id FROM ai_builder_business_memory_assertion_sources l JOIN ai_builder_business_memory_assertions a ON a.id=l.assertion_id WHERE a.memory_id=$1"), q("SELECT l.assertion_id,l.evidence_id FROM ai_builder_business_memory_assertion_evidence l JOIN ai_builder_business_memory_assertions a ON a.id=l.assertion_id WHERE a.memory_id=$1"), q("SELECT * FROM ai_builder_business_memory_conflicts WHERE memory_id=$1 ORDER BY id"), q("SELECT l.conflict_id,l.assertion_id FROM ai_builder_business_memory_conflict_assertions l JOIN ai_builder_business_memory_conflicts c ON c.id=l.conflict_id WHERE c.memory_id=$1"), q("SELECT * FROM ai_builder_business_memory_missing_information WHERE memory_id=$1 ORDER BY id"),
  ]);
  const rows = <T>(result: { rows: unknown[] }) => result.rows as DatabaseRow[];
  const list = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  const sortedUnique = (values: unknown[]): string[] => Array.from(new Set(values.filter((value): value is string => typeof value === "string"))).sort();
  const sourceIds = new Map<string, string[]>(), evidenceIds = new Map<string, string[]>();
  for (const row of rows(assertionSources)) if (typeof row.assertion_id === "string" && typeof row.source_id === "string") sourceIds.set(row.assertion_id, [...(sourceIds.get(row.assertion_id) ?? []), row.source_id]);
  for (const row of rows(assertionEvidence)) if (typeof row.assertion_id === "string" && typeof row.evidence_id === "string") evidenceIds.set(row.assertion_id, [...(evidenceIds.get(row.assertion_id) ?? []), row.evidence_id]);
  const assertionRows = rows(assertions);
  const assertionsById = new Map(assertionRows.filter((row) => typeof row.id === "string").map((row) => [row.id as string, row]));
  const conflictAssertionIds = new Map<string, string[]>();
  for (const row of rows(conflictAssertions)) if (typeof row.conflict_id === "string" && typeof row.assertion_id === "string") conflictAssertionIds.set(row.conflict_id, [...(conflictAssertionIds.get(row.conflict_id) ?? []), row.assertion_id]);
  const config = (root.assistant_configuration && typeof root.assistant_configuration === "object" ? root.assistant_configuration : {}) as DatabaseRow;
  const assistant = { name: typeof config.name === "string" ? config.name : "", purpose: typeof config.purpose === "string" ? config.purpose : "", tone: typeof config.tone === "string" ? config.tone : "", responseStyle: typeof config.responseStyle === "string" ? config.responseStyle : "", primaryAudience: typeof config.primaryAudience === "string" ? config.primaryAudience : null, escalationInstructions: list(config.escalationInstructions), behaviorRules: list(config.behaviorRules), prohibitedClaims: list(config.prohibitedClaims) };
  return { id: memoryId, schemaVersion: 1, projectId, assistant,
    entities: rows(entities).map(row => ({ id: String(row.id), type: String(row.entity_type) as BusinessMemory["entities"][number]["type"], name: String(row.name), aliases: list(row.aliases), tags: list(row.tags), assertionIds: assertionRows.filter(a => a.entity_id === row.id).map(a => String(a.id)), sourceIds: [], evidenceIds: [], createdAt: timestamp(row.created_at, "business_memory_invalid_entity_created_at"), updatedAt: timestamp(row.updated_at, "business_memory_invalid_entity_updated_at") })),
    assertions: assertionRows.map(row => ({ id: String(row.id), entityId: String(row.entity_id), value: String(row.value), confidence: { level: String(row.confidence) as BusinessMemory["assertions"][number]["confidence"]["level"], score: Number(row.confidence_score) }, reviewState: String(row.review_state) as BusinessMemory["assertions"][number]["reviewState"], authority: String(row.authority) as BusinessMemory["assertions"][number]["authority"], sourceIds: sourceIds.get(String(row.id)) ?? [], evidenceIds: evidenceIds.get(String(row.id)) ?? [], tags: list(row.tags), legacyEntryId: row.legacy_entry_id == null ? null : String(row.legacy_entry_id), createdAt: timestamp(row.created_at, "business_memory_invalid_assertion_created_at"), updatedAt: timestamp(row.updated_at, "business_memory_invalid_assertion_updated_at") })),
    relationships: rows(relationships).map(row => ({ id: String(row.id), type: String(row.relationship_type), fromEntityId: String(row.from_entity_id), toEntityId: String(row.to_entity_id), fromAssertionId: String(row.from_assertion_id), toAssertionId: String(row.to_assertion_id), sourceEntryIds: list(row.source_entry_ids), reviewState: String(row.review_state) as BusinessMemory["relationships"][number]["reviewState"], createdAt: timestamp(row.created_at, "business_memory_invalid_relationship_created_at"), updatedAt: timestamp(row.updated_at, "business_memory_invalid_relationship_updated_at") })),
    sources: rows(sources).map(row => ({ id: String(row.id), origin: String(row.origin), sourceEntryId: row.source_entry_id == null ? null : String(row.source_entry_id), intakeBlockId: row.intake_block_id == null ? null : String(row.intake_block_id), url: row.url == null ? null : String(row.url), label: row.label == null ? null : String(row.label), capturedAt: timestamp(row.captured_at, "business_memory_invalid_source_captured_at"), crawlAttemptId: row.crawl_attempt_id == null ? null : String(row.crawl_attempt_id) })), evidence: rows(evidence).map(row => ({ id: String(row.id), sourceId: String(row.source_id), excerpt: String(row.excerpt), url: row.url == null ? null : String(row.url), capturedAt: timestamp(row.captured_at, "business_memory_invalid_evidence_captured_at") })),
    conflicts: rows(conflicts).map(row => { const relatedAssertionIds = sortedUnique(conflictAssertionIds.get(typeof row.id === "string" ? row.id : "") ?? []); const relatedAssertions = relatedAssertionIds.map((id) => assertionsById.get(id)).filter((assertion): assertion is DatabaseRow => Boolean(assertion)); return { id: String(row.id), projectId, topic: String(row.topic), conflictingStatements: list(row.conflicting_statements), relatedEntityIds: sortedUnique(relatedAssertions.map((assertion) => assertion.entity_id)), relatedAssertionIds, sourceIds: sortedUnique(relatedAssertionIds.flatMap((id) => sourceIds.get(id) ?? [])), evidenceIds: sortedUnique(relatedAssertionIds.flatMap((id) => evidenceIds.get(id) ?? [])), suggestedClarificationQuestion: String(row.suggested_question), resolved: Boolean(row.resolved), resolution: row.resolution == null ? null : String(row.resolution), createdAt: timestamp(row.created_at, "business_memory_invalid_conflict_created_at"), updatedAt: timestamp(row.updated_at, "business_memory_invalid_conflict_updated_at") }; }), missingInformation: rows(missing).map(row => ({ id: String(row.id), projectId, topic: String(row.topic), reason: String(row.reason), suggestedQuestion: String(row.suggested_question), /* relatedEntityTypes has no current persistence representation. */ relatedEntityTypes: [], /* relatedEntityIds has no current persistence representation. */ relatedEntityIds: [], /* relatedAssertionIds has no current persistence representation. */ relatedAssertionIds: [], resolved: Boolean(row.resolved), createdAt: timestamp(row.created_at, "business_memory_invalid_missing_created_at"), updatedAt: timestamp(row.updated_at, "business_memory_invalid_missing_updated_at") })), createdAt: timestamp(root.created_at, "business_memory_invalid_created_at"), updatedAt: timestamp(root.updated_at, "business_memory_invalid_updated_at") };
}

/** Guarded post-rollback transition: never marks a replacement artifact failed. */
export async function markAssistantProjectionFailedIfUnchanged(client: QueryClient, input: { projectId: string; expectedFingerprint: string; expectedGeneratedAt: string; expectedUpdatedAt: string; allowedStates: AssistantProjectionInvalidationState[] }): Promise<PersistedAssistantProjectionRecord | null> {
  const result = await client.query("UPDATE ai_builder_assistant_projections SET invalidation_state='failed',updated_at=NOW() WHERE project_id=$1 AND business_memory_fingerprint=$2 AND generated_at=$3::timestamptz AND updated_at=$4::timestamptz AND invalidation_state = ANY($5::text[]) RETURNING project_id,business_memory_fingerprint,projection_version,schema_version,generated_at,invalidation_state,projection_json,created_at,updated_at", [input.projectId, input.expectedFingerprint, input.expectedGeneratedAt, input.expectedUpdatedAt, input.allowedStates]);
  const row = (result.rows as DatabaseRow[])[0]; return row ? parsePersistedAssistantProjectionRecord(row) : null;
}

export type AssistantProjectionParityPersistenceInput = {
  projectId: string;
  comparedAt: string;
  runtimeVersion: number;
  assistantProjectionVersion: number | null;
  assistantProjectionSchemaVersion: number | null;
  status: "MATCH" | "MINOR_DIFFERENCE" | "MAJOR_DIFFERENCE" | "COMPARISON_FAILURE";
  mismatchSummary: unknown;
  categoryBreakdown: unknown;
  failureDetails: unknown | null;
  activeRuntimeAuthority: ProjectRuntimeAuthority;
  /** Exact immutable source fingerprint of the projection compared. */
  artifactFingerprint: string | null;
};

/** Stores only the latest comparison per project; this observability record never affects runtime authority. */
export async function upsertAssistantProjectionParityReport(client: QueryClient, input: AssistantProjectionParityPersistenceInput): Promise<void> {
  await client.query(
    "INSERT INTO ai_builder_assistant_projection_parity_reports (project_id,compared_at,legacy_runtime_version,assistant_projection_version,assistant_projection_schema_version,artifact_fingerprint,status,mismatch_summary,category_breakdown,failure_details,active_runtime_authority,updated_at) VALUES ($1,$2::timestamptz,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11,NOW()) ON CONFLICT (project_id) DO UPDATE SET compared_at=EXCLUDED.compared_at,legacy_runtime_version=EXCLUDED.legacy_runtime_version,assistant_projection_version=EXCLUDED.assistant_projection_version,assistant_projection_schema_version=EXCLUDED.assistant_projection_schema_version,artifact_fingerprint=EXCLUDED.artifact_fingerprint,status=EXCLUDED.status,mismatch_summary=EXCLUDED.mismatch_summary,category_breakdown=EXCLUDED.category_breakdown,failure_details=EXCLUDED.failure_details,active_runtime_authority=EXCLUDED.active_runtime_authority,updated_at=NOW()",
    [input.projectId, input.comparedAt, input.runtimeVersion, input.assistantProjectionVersion, input.assistantProjectionSchemaVersion, input.artifactFingerprint, input.status, JSON.stringify(input.mismatchSummary), JSON.stringify(input.categoryBreakdown), input.failureDetails === null ? null : JSON.stringify(input.failureDetails), input.activeRuntimeAuthority],
  );
}
