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
const textCollections = ["services", "products", "pricing", "policies", "faqs"] as const;

function fail(code: string): never { throw new AssistantProjectionRuntimeValidationError(code); }

function validProvenance(value: unknown): boolean {
  if (value === undefined) return true; if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return ["classification", "predecessorClassification", "originalClassification", "correctedByClerkUserId", "correctedByDisplayName", "correctedByEmail", "correctedAt"].every(key => p[key] === null || typeof p[key] === "string");
}
function validateItem(item: unknown, collection: string, sourceIds: Set<string>, evidenceIds: Set<string>): asserts item is AssistantProjectionTextKnowledgeItem {
  if (!item || typeof item !== "object") fail("assistant_projection_runtime_invalid_knowledge");
  const value = item as Record<string, unknown>;
  if (!authoritativeStates.has(value.reviewState as string)) fail("assistant_projection_runtime_non_authoritative_knowledge");
  if (typeof value.id !== "string" || !value.id || typeof value.entityId !== "string" || !value.entityId || typeof value.assertionId !== "string" || !value.assertionId || typeof value.title !== "string" || !value.title || typeof value.value !== "string" || !value.value) fail("assistant_projection_runtime_invalid_knowledge");
  if (collection === "faqs" && (typeof value.question !== "string" || !value.question || typeof value.answer !== "string" || !value.answer)) fail("assistant_projection_runtime_invalid_faq");
  if (!validProvenance(value.provenance) || (value.predecessorAssertionId !== undefined && value.predecessorAssertionId !== null && (typeof value.predecessorAssertionId !== "string" || !value.predecessorAssertionId))) fail("assistant_projection_runtime_invalid_provenance");
  if (!Array.isArray(value.sourceIds) || !Array.isArray(value.evidenceIds) || value.sourceIds.some((id) => typeof id !== "string" || !sourceIds.has(id)) || value.evidenceIds.some((id) => typeof id !== "string" || !evidenceIds.has(id))) fail("assistant_projection_runtime_invalid_provenance_reference");
}

/**
 * Validates the persisted DTO before it can cross the runtime boundary. This is
 * deliberately validation, not retrieval filtering: invalid authority is never
 * silently omitted or adapted into an answer.
 */
export function validateAssistantProjectionRuntime(projection: AssistantProjection): void {
  if (!Array.isArray(projection.products)) fail("assistant_projection_runtime_invalid_products");
  const sourceIds = new Set(projection.sources.map((source) => source.id));
  const evidenceIds = new Set(projection.evidence.map((evidence) => evidence.id));
  if (projection.evidence.some((evidence) => !sourceIds.has(evidence.canonicalSourceId))) fail("assistant_projection_runtime_invalid_evidence_source");
  for (const collection of textCollections) for (const item of projection[collection]) {
    validateItem(item, collection, sourceIds, evidenceIds);
    // v2 artifacts must carry the field, including an explicit null. v1 is
    // retained only for historical parsing and is rejected by cutover/version checks.
    if (projection.projectionVersion >= 2 && !Object.prototype.hasOwnProperty.call(item, "predecessorAssertionId")) fail("assistant_projection_runtime_missing_predecessor_assertion_id");
  }
  const authoritativeAssertions = new Set(textCollections.flatMap(collection => projection[collection].map(item => item.assertionId)));
  const projectedEntities = new Set(textCollections.flatMap(collection => projection[collection].map(item => item.entityId)));
  for (const relationship of projection.relationships) {
    if (!relationship || typeof relationship !== "object") fail("assistant_projection_runtime_invalid_relationship");
    const value = relationship as Record<string, unknown>;
    if (typeof value.id !== "string" || !value.id || typeof value.type !== "string" || !value.type || typeof value.sourceEntityId !== "string" || !projectedEntities.has(value.sourceEntityId) || typeof value.targetEntityId !== "string" || !projectedEntities.has(value.targetEntityId) || typeof value.sourceAssertionId !== "string" || !authoritativeAssertions.has(value.sourceAssertionId) || typeof value.targetAssertionId !== "string" || !authoritativeAssertions.has(value.targetAssertionId) || !authoritativeStates.has(value.reviewState as string) || !Array.isArray(value.sourceEntryIds) || value.sourceEntryIds.some(id => typeof id !== "string" || !id) || !Array.isArray(value.sourceIds) || value.sourceIds.some(id => typeof id !== "string" || !sourceIds.has(id)) || !Array.isArray(value.evidenceIds) || value.evidenceIds.some(id => typeof id !== "string" || !evidenceIds.has(id))) fail("assistant_projection_runtime_invalid_relationship");
  }
  for (const restriction of projection.restrictions) {
    if (!restriction || typeof restriction !== "object" || !["behavior_rule", "prohibited_claim"].includes(restriction.type) || !authoritativeStates.has(restriction.reviewState) || !Array.isArray(restriction.sourceIds) || restriction.sourceIds.some(id => !sourceIds.has(id)) || !Array.isArray(restriction.evidenceIds) || restriction.evidenceIds.some(id => !evidenceIds.has(id)) || !validProvenance(restriction.provenance) || (restriction.predecessorAssertionId !== undefined && restriction.predecessorAssertionId !== null && typeof restriction.predecessorAssertionId !== "string")) fail("assistant_projection_runtime_invalid_restriction");
  }
  // Conflict suppression means an unresolved conflict was serialized into the
  // runtime DTO. Generation must reject it instead of making it retrievable.
  if (projection.restrictions.some((restriction) => restriction.type === "conflict_suppression")) fail("assistant_projection_runtime_unresolved_conflict");
}
