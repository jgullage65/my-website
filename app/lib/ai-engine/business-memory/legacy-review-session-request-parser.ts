import {
  AI_BUILDER_SESSION_STATUSES,
  BUSINESS_CONTEXT_CATEGORIES,
  BUSINESS_CONTEXT_STATUSES,
  type AiBuilderSession,
} from "@/app/lib/ai-engine/contracts";
import { AI_BUILDER_PROVENANCE_CLASSIFICATIONS } from "@/app/lib/ai-engine/provenance";

export const LEGACY_REVIEW_SESSION_LIMITS = {
  identifierLength: 256,
  shortTextLength: 2_000,
  longTextLength: 100_000,
  collectionItems: 2_000,
  auxiliaryItems: 500,
  nestedStringItems: 500,
} as const;

const SESSION_FIELDS = ["id", "status", "intakeBlocks", "assistantConfiguration", "contextEntries", "faqEntries", "conflicts", "missingInformation", "contextCounts", "buildProgress", "createdAt", "updatedAt", "expiresAt", "governanceRevision"] as const;
const CONTEXT_FIELDS = ["id", "sessionId", "category", "title", "content", "confidence", "confidenceScore", "status", "source", "metadata", "createdAt", "updatedAt"] as const;
const FAQ_FIELDS = ["id", "sessionId", "question", "answer", "confidence", "confidenceScore", "sourceEntryIds", "status", "metadata", "createdAt", "updatedAt"] as const;
const METADATA_FIELDS = ["generated", "userEdited", "conflictingEntryIds", "tags", "provenanceClassification", "predecessorProvenanceClassification", "originalProvenanceClassification", "upstreamSourceEntryIds", "mixedSourceProvenance"] as const;
const CONFIDENCES = ["high", "medium", "low"] as const;
const SOURCE_TYPES = ["manual_intake", "generated_qa", "website", "user_edit"] as const;
const BUILD_STAGES = ["reading_business", "extracting_facts", "generating_qa", "detecting_conflicts", "building_memory", "preparing_demo", "complete"] as const;

export class LegacyReviewSessionRequestParseError extends Error {
  readonly code = "invalid_legacy_review_session";
  constructor(message = "The legacy review session payload is invalid.") { super(message); }
}

function invalid(message: string): never { throw new LegacyReviewSessionRequestParseError(message); }
function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) invalid(`${label} must be an object.`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) invalid(`${label} must be a plain object.`);
  return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, fields: readonly string[], label: string) {
  if (Object.keys(value).some((key) => !fields.includes(key))) invalid(`${label} contains an unexpected field.`);
}
function required(value: Record<string, unknown>, fields: readonly string[], label: string) {
  if (fields.some((field) => !Object.prototype.hasOwnProperty.call(value, field))) invalid(`${label} is incomplete.`);
}
function string(value: unknown, label: string, max: number = LEGACY_REVIEW_SESSION_LIMITS.shortTextLength): asserts value is string {
  if (typeof value !== "string" || value.length > max) invalid(`${label} must be a string within the transport limit.`);
}
function identifier(value: unknown, label: string): asserts value is string {
  string(value, label, LEGACY_REVIEW_SESSION_LIMITS.identifierLength);
  if (!value.trim()) invalid(`${label} must be non-empty.`);
}
function boolean(value: unknown, label: string): asserts value is boolean { if (typeof value !== "boolean") invalid(`${label} must be a boolean.`); }
function finite(value: unknown, label: string): asserts value is number { if (typeof value !== "number" || !Number.isFinite(value)) invalid(`${label} must be a finite number.`); }
function nonNegativeInteger(value: unknown, label: string) { if (!Number.isSafeInteger(value) || (value as number) < 0) invalid(`${label} must be a non-negative safe integer.`); }
function enumeration(value: unknown, values: readonly string[], label: string) { if (typeof value !== "string" || !values.includes(value)) invalid(`${label} is invalid.`); }
function timestamp(value: unknown, label: string) {
  string(value, label, 100);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) invalid(`${label} must be a valid timestamp string.`);
}
function array(value: unknown, label: string, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) invalid(`${label} must be an array within the transport limit.`);
  return value;
}
function stringArray(value: unknown, label: string): void {
  array(value, label, LEGACY_REVIEW_SESSION_LIMITS.nestedStringItems).forEach((item, index) => string(item, `${label}[${index}]`));
}

function metadata(value: unknown, label: string, partial: boolean) {
  const item = object(value, label);
  exact(item, METADATA_FIELDS, label);
  if (!partial) required(item, ["generated", "userEdited", "conflictingEntryIds", "tags"], label);
  for (const field of ["generated", "userEdited", "mixedSourceProvenance"] as const) if (item[field] !== undefined) boolean(item[field], `${label}.${field}`);
  for (const field of ["conflictingEntryIds", "tags", "upstreamSourceEntryIds"] as const) if (item[field] !== undefined) stringArray(item[field], `${label}.${field}`);
  for (const field of ["provenanceClassification", "predecessorProvenanceClassification", "originalProvenanceClassification"] as const) if (item[field] !== undefined) enumeration(item[field], AI_BUILDER_PROVENANCE_CLASSIFICATIONS, `${label}.${field}`);
}

function contextEntry(value: unknown, sessionId: string, ids: Set<string>, index: number) {
  const label = `session.contextEntries[${index}]`;
  const item = object(value, label); exact(item, CONTEXT_FIELDS, label); required(item, CONTEXT_FIELDS, label);
  identifier(item.id, `${label}.id`); identifier(item.sessionId, `${label}.sessionId`);
  if (item.sessionId !== sessionId) invalid(`${label}.sessionId must match session.id.`);
  if (ids.has(item.id)) invalid("Context entry IDs must be unique."); ids.add(item.id);
  enumeration(item.category, BUSINESS_CONTEXT_CATEGORIES, `${label}.category`);
  string(item.title, `${label}.title`); string(item.content, `${label}.content`, LEGACY_REVIEW_SESSION_LIMITS.longTextLength);
  enumeration(item.confidence, CONFIDENCES, `${label}.confidence`); finite(item.confidenceScore, `${label}.confidenceScore`);
  enumeration(item.status, BUSINESS_CONTEXT_STATUSES, `${label}.status`);
  const source = object(item.source, `${label}.source`); exact(source, ["intakeBlockId", "excerpt", "sourceType", "sourceUrl"], `${label}.source`); required(source, ["intakeBlockId", "excerpt", "sourceType"], `${label}.source`);
  string(source.intakeBlockId, `${label}.source.intakeBlockId`); string(source.excerpt, `${label}.source.excerpt`, LEGACY_REVIEW_SESSION_LIMITS.longTextLength); enumeration(source.sourceType, SOURCE_TYPES, `${label}.source.sourceType`);
  if (source.sourceUrl !== undefined && source.sourceUrl !== null) string(source.sourceUrl, `${label}.source.sourceUrl`, LEGACY_REVIEW_SESSION_LIMITS.longTextLength);
  metadata(item.metadata, `${label}.metadata`, false); timestamp(item.createdAt, `${label}.createdAt`); timestamp(item.updatedAt, `${label}.updatedAt`);
}

function faqEntry(value: unknown, sessionId: string, ids: Set<string>, index: number) {
  const label = `session.faqEntries[${index}]`;
  const item = object(value, label); exact(item, FAQ_FIELDS, label); required(item, FAQ_FIELDS.filter((field) => field !== "metadata"), label);
  identifier(item.id, `${label}.id`); identifier(item.sessionId, `${label}.sessionId`);
  if (item.sessionId !== sessionId) invalid(`${label}.sessionId must match session.id.`);
  if (ids.has(item.id)) invalid("FAQ entry IDs must be unique."); ids.add(item.id);
  string(item.question, `${label}.question`); string(item.answer, `${label}.answer`, LEGACY_REVIEW_SESSION_LIMITS.longTextLength);
  enumeration(item.confidence, CONFIDENCES, `${label}.confidence`); finite(item.confidenceScore, `${label}.confidenceScore`); stringArray(item.sourceEntryIds, `${label}.sourceEntryIds`); enumeration(item.status, BUSINESS_CONTEXT_STATUSES, `${label}.status`);
  if (item.metadata !== undefined) metadata(item.metadata, `${label}.metadata`, true);
  timestamp(item.createdAt, `${label}.createdAt`); timestamp(item.updatedAt, `${label}.updatedAt`);
}

function validateSession(value: unknown, projectId: string): AiBuilderSession {
  const session = object(value, "session"); exact(session, SESSION_FIELDS, "session"); required(session, SESSION_FIELDS.filter((field) => field !== "governanceRevision"), "session");
  identifier(session.id, "session.id"); if (session.id !== projectId) invalid("The saved session must match the requested project.");
  enumeration(session.status, AI_BUILDER_SESSION_STATUSES, "session.status");
  array(session.intakeBlocks, "session.intakeBlocks", LEGACY_REVIEW_SESSION_LIMITS.auxiliaryItems).forEach((value, index) => { const label = `session.intakeBlocks[${index}]`; const item = object(value, label); exact(item, ["id", "label", "content", "createdAt", "updatedAt"], label); required(item, ["id", "label", "content", "createdAt", "updatedAt"], label); identifier(item.id, `${label}.id`); string(item.label, `${label}.label`); string(item.content, `${label}.content`, LEGACY_REVIEW_SESSION_LIMITS.longTextLength); timestamp(item.createdAt, `${label}.createdAt`); timestamp(item.updatedAt, `${label}.updatedAt`); });
  const assistant = object(session.assistantConfiguration, "session.assistantConfiguration"); exact(assistant, ["name", "purpose", "tone", "responseStyle", "primaryAudience", "escalationInstructions"], "session.assistantConfiguration"); required(assistant, ["name", "purpose", "tone", "responseStyle", "primaryAudience", "escalationInstructions"], "session.assistantConfiguration");
  for (const field of ["name", "purpose", "tone", "responseStyle"] as const) string(assistant[field], `session.assistantConfiguration.${field}`); if (assistant.primaryAudience !== null) string(assistant.primaryAudience, "session.assistantConfiguration.primaryAudience"); stringArray(assistant.escalationInstructions, "session.assistantConfiguration.escalationInstructions");
  const contexts = array(session.contextEntries, "session.contextEntries", LEGACY_REVIEW_SESSION_LIMITS.collectionItems); const contextIds = new Set<string>(); contexts.forEach((item, index) => contextEntry(item, session.id as string, contextIds, index));
  const faqs = array(session.faqEntries, "session.faqEntries", LEGACY_REVIEW_SESSION_LIMITS.collectionItems); const faqIds = new Set<string>(); faqs.forEach((item, index) => faqEntry(item, session.id as string, faqIds, index));
  array(session.conflicts, "session.conflicts", LEGACY_REVIEW_SESSION_LIMITS.auxiliaryItems).forEach((value, index) => { const label = `session.conflicts[${index}]`; const item = object(value, label); exact(item, ["id", "topic", "firstStatement", "secondStatement", "sourceExcerpts", "suggestedQuestion", "resolved", "resolution"], label); required(item, ["id", "topic", "firstStatement", "secondStatement", "sourceExcerpts", "suggestedQuestion", "resolved"], label); identifier(item.id, `${label}.id`); for (const field of ["topic", "firstStatement", "secondStatement", "suggestedQuestion"] as const) string(item[field], `${label}.${field}`, LEGACY_REVIEW_SESSION_LIMITS.longTextLength); stringArray(item.sourceExcerpts, `${label}.sourceExcerpts`); boolean(item.resolved, `${label}.resolved`); if (item.resolution !== undefined && item.resolution !== null) string(item.resolution, `${label}.resolution`, LEGACY_REVIEW_SESSION_LIMITS.longTextLength); });
  array(session.missingInformation, "session.missingInformation", LEGACY_REVIEW_SESSION_LIMITS.auxiliaryItems).forEach((value, index) => { const label = `session.missingInformation[${index}]`; const item = object(value, label); exact(item, ["id", "topic", "reason", "suggestedQuestion", "resolved"], label); required(item, ["id", "topic", "reason", "suggestedQuestion", "resolved"], label); identifier(item.id, `${label}.id`); for (const field of ["topic", "reason", "suggestedQuestion"] as const) string(item[field], `${label}.${field}`, LEGACY_REVIEW_SESSION_LIMITS.longTextLength); boolean(item.resolved, `${label}.resolved`); });
  const counts = object(session.contextCounts, "session.contextCounts"); exact(counts, ["total", "approved", "proposed", "archived", "byCategory"], "session.contextCounts"); required(counts, ["total", "approved", "proposed", "archived", "byCategory"], "session.contextCounts"); for (const field of ["total", "approved", "proposed", "archived"] as const) nonNegativeInteger(counts[field], `session.contextCounts.${field}`); const byCategory = object(counts.byCategory, "session.contextCounts.byCategory"); exact(byCategory, BUSINESS_CONTEXT_CATEGORIES, "session.contextCounts.byCategory"); for (const [category, count] of Object.entries(byCategory)) nonNegativeInteger(count, `session.contextCounts.byCategory.${category}`);
  array(session.buildProgress, "session.buildProgress", LEGACY_REVIEW_SESSION_LIMITS.auxiliaryItems).forEach((value, index) => { const label = `session.buildProgress[${index}]`; const item = object(value, label); exact(item, ["stage", "message", "completed", "count", "createdAt"], label); required(item, ["stage", "message", "completed", "createdAt"], label); enumeration(item.stage, BUILD_STAGES, `${label}.stage`); string(item.message, `${label}.message`); boolean(item.completed, `${label}.completed`); if (item.count !== undefined && item.count !== null) nonNegativeInteger(item.count, `${label}.count`); timestamp(item.createdAt, `${label}.createdAt`); });
  timestamp(session.createdAt, "session.createdAt"); timestamp(session.updatedAt, "session.updatedAt"); if (session.expiresAt !== null) timestamp(session.expiresAt, "session.expiresAt"); if (session.governanceRevision !== undefined) nonNegativeInteger(session.governanceRevision, "session.governanceRevision");
  return session as unknown as AiBuilderSession;
}

export function parseLegacyReviewSessionRequest(payload: unknown, projectId: string): { session: AiBuilderSession } {
  const body = object(payload, "The request body"); exact(body, ["session"], "The request body"); required(body, ["session"], "The request body");
  return { session: validateSession(body.session, projectId) };
}
