import type { AssistantProjection, AssistantProjectionTextKnowledgeItem } from "./contracts";

/** A projection is a runtime artifact, so invalid authority must fail closed. */
export class AssistantProjectionRuntimeValidationError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "AssistantProjectionRuntimeValidationError";
    this.code = code;
  }
}

const authoritativeStates = new Set(["approved", "corrected"]);
const textCollections = ["services", "pricing", "policies", "faqs"] as const;

function fail(code: string): never { throw new AssistantProjectionRuntimeValidationError(code); }

function validateItem(item: unknown, collection: string, sourceIds: Set<string>, evidenceIds: Set<string>): asserts item is AssistantProjectionTextKnowledgeItem {
  if (!item || typeof item !== "object") fail("assistant_projection_runtime_invalid_knowledge");
  const value = item as Record<string, unknown>;
  if (!authoritativeStates.has(value.reviewState as string)) fail("assistant_projection_runtime_non_authoritative_knowledge");
  if (typeof value.id !== "string" || !value.id || typeof value.entityId !== "string" || !value.entityId || typeof value.assertionId !== "string" || !value.assertionId || typeof value.title !== "string" || !value.title || typeof value.value !== "string" || !value.value) fail("assistant_projection_runtime_invalid_knowledge");
  if (collection === "faqs" && (typeof value.question !== "string" || !value.question || typeof value.answer !== "string" || !value.answer)) fail("assistant_projection_runtime_invalid_faq");
  if (!Array.isArray(value.sourceIds) || !Array.isArray(value.evidenceIds) || value.sourceIds.some((id) => typeof id !== "string" || !sourceIds.has(id)) || value.evidenceIds.some((id) => typeof id !== "string" || !evidenceIds.has(id))) fail("assistant_projection_runtime_invalid_provenance_reference");
}

/**
 * Validates the persisted DTO before it can cross the runtime boundary. This is
 * deliberately validation, not retrieval filtering: invalid authority is never
 * silently omitted or adapted into an answer.
 */
export function validateAssistantProjectionRuntime(projection: AssistantProjection): void {
  const sourceIds = new Set(projection.sources.map((source) => source.id));
  const evidenceIds = new Set(projection.evidence.map((evidence) => evidence.id));
  if (projection.evidence.some((evidence) => !sourceIds.has(evidence.canonicalSourceId))) fail("assistant_projection_runtime_invalid_evidence_source");
  for (const collection of textCollections) for (const item of projection[collection]) validateItem(item, collection, sourceIds, evidenceIds);
  // Conflict suppression means an unresolved conflict was serialized into the
  // runtime DTO. Generation must reject it instead of making it retrievable.
  if (projection.restrictions.some((restriction) => restriction.type === "conflict_suppression")) fail("assistant_projection_runtime_unresolved_conflict");
}
