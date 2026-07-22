import "server-only";

import type { PoolClient } from "@neondatabase/serverless";
import { isAiBuilderProvenanceClassification, type AiBuilderProvenanceClassification } from "@/app/lib/ai-engine/provenance";
import type { KnowledgeFact, KnowledgeFaq, KnowledgePack, KnowledgeProvenance } from "./contracts";
import { BUSINESS_CONTEXT_CATEGORIES, type BusinessContextCategory, type ContextConfidence } from "@/app/lib/ai-engine/contracts/business";

export const REVIEW_STATES = ["proposed", "approved", "corrected", "archived"] as const;
type ReviewState = (typeof REVIEW_STATES)[number];
type SourceKind = "context_entry" | "faq";
type QueryClient = Pick<PoolClient, "query">;

export class TrustedKnowledgeProjectionError extends Error {
  readonly code: "invalid_trusted_projection_source_state" | "trusted_knowledge_projection_invalid_source" | "trusted_knowledge_projection_reconciliation_failed" | "trusted_knowledge_projection_stale";
  readonly details?: Record<string, unknown>;
  constructor(code: TrustedKnowledgeProjectionError["code"], message: string, details?: Record<string, unknown>) { super(message); this.code = code; this.details = details; }
}

type ContextSource = { intakeBlockId: string; excerpt: string; sourceType: string; sourceUrl?: string | null };
type ParsedContextProjectionSource = {
  id: string; category: BusinessContextCategory; title: string; content: string;
  confidence: ContextConfidence; confidenceScore: number; status: ReviewState;
  source: ContextSource; metadata: Record<string, unknown>; createdAt: string; updatedAt: string;
};
type ParsedFaqProjectionSource = {
  id: string; question: string; answer: string; confidence: ContextConfidence;
  confidenceScore: number; sourceEntryIds: string[]; status: ReviewState;
  metadata: Record<string, unknown>; createdAt: string; updatedAt: string;
};
type ContextRow = { id: unknown; category: unknown; title: unknown; content: unknown; confidence: unknown; confidence_score: unknown; status: unknown; source: unknown; metadata: unknown; created_at: unknown; updated_at: unknown };
type FaqRow = { id: unknown; question: unknown; answer: unknown; confidence: unknown; confidence_score: unknown; source_entry_ids: unknown; status: unknown; metadata: unknown; created_at: unknown; updated_at: unknown };
export type TrustedKnowledgeProjectionRow = { source_item_id: unknown; source_item_kind: unknown; review_state: unknown; content: unknown; provenance: unknown; source_entry_ids: unknown; governance_revision: unknown };

function fail(code: TrustedKnowledgeProjectionError["code"], message: string, details?: Record<string, unknown>): never { throw new TrustedKnowledgeProjectionError(code, message, details); }
function parseId(value: unknown, kind: SourceKind): string { if (typeof value !== "string" || !value.trim()) return fail("trusted_knowledge_projection_invalid_source", "Trusted Knowledge source ID is invalid.", { kind, sourceItemId: value }); return value; }
function parseReviewState(value: unknown, kind: SourceKind, id: unknown): ReviewState { if (typeof value === "string" && (REVIEW_STATES as readonly string[]).includes(value)) return value as ReviewState; return fail("invalid_trusted_projection_source_state", "Trusted Knowledge source has an invalid review state.", { kind, sourceItemId: id, status: value }); }
function object(value: unknown, field: string, kind: SourceKind, id: string, nullable = false): Record<string, unknown> { if (value == null && nullable) return {}; if (!value || typeof value !== "object" || Array.isArray(value)) return fail("trusted_knowledge_projection_invalid_source", `Trusted Knowledge ${field} is invalid.`, { kind, sourceItemId: id, field, value }); return value as Record<string, unknown>; }
function text(value: unknown, field: string, kind: SourceKind, id: string): string { if (typeof value !== "string" || !value.trim()) return fail("trusted_knowledge_projection_invalid_source", `Trusted Knowledge ${field} is invalid.`, { kind, sourceItemId: id, field, value }); return value; }
function stringArray(value: unknown, field: string, kind: SourceKind, id: string): string[] { if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim()) || new Set(value).size !== value.length) return fail("trusted_knowledge_projection_invalid_source", `Trusted Knowledge ${field} is invalid.`, { kind, sourceItemId: id, field }); return value; }
function iso(value: unknown, field: string, kind: SourceKind, id: string): string { if (value instanceof Date) return value.toISOString(); if (typeof value === "string" && value) return value; return fail("trusted_knowledge_projection_invalid_source", `Trusted Knowledge ${field} is invalid.`, { kind, sourceItemId: id, field }); }
function number(value: unknown, field: string, kind: SourceKind, id: string): number { const result = Number(value); if (!Number.isFinite(result) || result < 0 || result > 1) return fail("trusted_knowledge_projection_invalid_source", `Trusted Knowledge ${field} is invalid.`, { kind, sourceItemId: id, field, value }); return result; }
function category(value: unknown, id: string): BusinessContextCategory { if (typeof value !== "string" || !(BUSINESS_CONTEXT_CATEGORIES as readonly string[]).includes(value)) return fail("trusted_knowledge_projection_invalid_source", "Trusted Knowledge category is invalid.", { kind: "context_entry", sourceItemId: id, field: "category", value }); return value as BusinessContextCategory; }
function confidence(value: unknown, kind: SourceKind, id: string): ContextConfidence { if (value !== "high" && value !== "medium" && value !== "low") return fail("trusted_knowledge_projection_invalid_source", "Trusted Knowledge confidence is invalid.", { kind, sourceItemId: id, field: "confidence", value }); return value; }
function parseSource(value: unknown, id: string): ContextSource { const parsed = object(value, "source", "context_entry", id); const sourceType = text(parsed.sourceType, "source.sourceType", "context_entry", id); if (!["manual_intake", "generated_qa", "website", "user_edit"].includes(sourceType)) fail("trusted_knowledge_projection_invalid_source", "Trusted Knowledge source type is invalid.", { kind: "context_entry", sourceItemId: id, field: "source.sourceType" }); const sourceUrl = parsed.sourceUrl; if (sourceUrl !== undefined && sourceUrl !== null && (typeof sourceUrl !== "string" || !sourceUrl.trim())) fail("trusted_knowledge_projection_invalid_source", "Trusted Knowledge source URL is invalid.", { kind: "context_entry", sourceItemId: id, field: "source.sourceUrl" }); if (sourceType === "website" && (typeof sourceUrl !== "string" || !sourceUrl.trim())) fail("trusted_knowledge_projection_invalid_source", "Website Trusted Knowledge requires a source URL.", { kind: "context_entry", sourceItemId: id, field: "source.sourceUrl" }); return { ...parsed, intakeBlockId: text(parsed.intakeBlockId, "source.intakeBlockId", "context_entry", id), excerpt: text(parsed.excerpt, "source.excerpt", "context_entry", id), sourceType, sourceUrl: sourceUrl as string | null | undefined }; }
function optionalObject(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function active(state: ReviewState): state is "approved" | "corrected" { return state === "approved" || state === "corrected"; }

async function loadCanonicalProjectionSources(client: QueryClient, projectId: string): Promise<{ contexts: ContextRow[]; faqs: FaqRow[] }> {
  const [contexts, faqs] = await Promise.all([client.query("SELECT id, category, title, content, confidence, confidence_score, status, source, metadata, created_at, updated_at FROM ai_builder_context_entries WHERE project_id = $1 ORDER BY id", [projectId]), client.query("SELECT id, question, answer, confidence, confidence_score, source_entry_ids, status, metadata, created_at, updated_at FROM ai_builder_faq_entries WHERE project_id = $1 ORDER BY id", [projectId])]);
  return { contexts: contexts.rows as ContextRow[], faqs: faqs.rows as FaqRow[] };
}

function parseContextProjectionSource(row: ContextRow): ParsedContextProjectionSource {
  const id = parseId(row.id, "context_entry");
  return { id, category: category(row.category, id), title: text(row.title, "title", "context_entry", id), content: text(row.content, "content", "context_entry", id), confidence: confidence(row.confidence, "context_entry", id), confidenceScore: number(row.confidence_score, "confidenceScore", "context_entry", id), status: parseReviewState(row.status, "context_entry", id), source: parseSource(row.source, id), metadata: object(row.metadata, "metadata", "context_entry", id, true), createdAt: iso(row.created_at, "createdAt", "context_entry", id), updatedAt: iso(row.updated_at, "updatedAt", "context_entry", id) };
}
function parseFaqProjectionSource(row: FaqRow): ParsedFaqProjectionSource {
  const id = parseId(row.id, "faq");
  return { id, question: text(row.question, "question", "faq", id), answer: text(row.answer, "answer", "faq", id), confidence: confidence(row.confidence, "faq", id), confidenceScore: number(row.confidence_score, "confidenceScore", "faq", id), sourceEntryIds: stringArray(row.source_entry_ids, "sourceEntryIds", "faq", id), status: parseReviewState(row.status, "faq", id), metadata: object(row.metadata, "metadata", "faq", id, true), createdAt: iso(row.created_at, "createdAt", "faq", id), updatedAt: iso(row.updated_at, "updatedAt", "faq", id) };
}
async function upsertContextProjectionRow(client: QueryClient, projectId: string, source: ParsedContextProjectionSource, governanceRevision: number): Promise<string> {
  await client.query(`INSERT INTO ai_builder_trusted_knowledge_projection (project_id, source_item_id, source_item_kind, review_state, active, content, provenance, source_entry_ids, governance_revision, created_at, updated_at) VALUES ($1,$2,'context_entry',$3,$4,$5::jsonb,$6::jsonb,'[]'::jsonb,$7,$8::timestamptz,$9::timestamptz) ON CONFLICT (project_id, source_item_kind, source_item_id) DO UPDATE SET review_state=EXCLUDED.review_state,active=EXCLUDED.active,content=EXCLUDED.content,provenance=EXCLUDED.provenance,governance_revision=EXCLUDED.governance_revision,updated_at=EXCLUDED.updated_at`, [projectId, source.id, source.status, active(source.status), JSON.stringify({ category: source.category, title: source.title, content: source.content, confidence: source.confidence, confidenceScore: source.confidenceScore, source: source.source, metadata: source.metadata }), JSON.stringify(source.metadata), governanceRevision, source.createdAt, source.updatedAt]);
  return `context_entry:${source.id}`;
}
async function upsertFaqProjectionRow(client: QueryClient, projectId: string, source: ParsedFaqProjectionSource, governanceRevision: number): Promise<string> {
  await client.query(`INSERT INTO ai_builder_trusted_knowledge_projection (project_id, source_item_id, source_item_kind, review_state, active, content, provenance, source_entry_ids, governance_revision, created_at, updated_at) VALUES ($1,$2,'faq',$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9::timestamptz,$10::timestamptz) ON CONFLICT (project_id, source_item_kind, source_item_id) DO UPDATE SET review_state=EXCLUDED.review_state,active=EXCLUDED.active,content=EXCLUDED.content,provenance=EXCLUDED.provenance,source_entry_ids=EXCLUDED.source_entry_ids,governance_revision=EXCLUDED.governance_revision,updated_at=EXCLUDED.updated_at`, [projectId, source.id, source.status, active(source.status), JSON.stringify({ question: source.question, answer: source.answer, confidence: source.confidence, confidenceScore: source.confidenceScore, metadata: source.metadata }), JSON.stringify(source.metadata), JSON.stringify(source.sourceEntryIds), governanceRevision, source.createdAt, source.updatedAt]);
  return `faq:${source.id}`;
}
async function upsertContextProjectionRows(client: QueryClient, projectId: string, sources: ParsedContextProjectionSource[], governanceRevision: number): Promise<string[]> { return Promise.all(sources.map((source) => upsertContextProjectionRow(client, projectId, source, governanceRevision))); }
async function upsertFaqProjectionRows(client: QueryClient, projectId: string, sources: ParsedFaqProjectionSource[], governanceRevision: number): Promise<string[]> { return Promise.all(sources.map((source) => upsertFaqProjectionRow(client, projectId, source, governanceRevision))); }

async function deactivateMissingProjectionRows(client: QueryClient, projectId: string, sourceKeys: string[], governanceRevision: number): Promise<void> { if (sourceKeys.length) await client.query("UPDATE ai_builder_trusted_knowledge_projection SET active=FALSE, governance_revision=$2, updated_at=NOW() WHERE project_id=$1 AND (source_item_kind || ':' || source_item_id) <> ALL($3::text[])", [projectId, governanceRevision, sourceKeys]); else await client.query("UPDATE ai_builder_trusted_knowledge_projection SET active=FALSE, governance_revision=$2, updated_at=NOW() WHERE project_id=$1", [projectId, governanceRevision]); }
async function updateProjectionRevision(client: QueryClient, projectId: string, governanceRevision: number): Promise<void> { await client.query("UPDATE ai_builder_projects SET trusted_knowledge_revision=$2 WHERE id=$1", [projectId, governanceRevision]); }

/** Reconciles derived Trusted Knowledge without mutating canonical review authority. Caller owns the transaction. */
export async function reconcileTrustedKnowledgeProjectionForProject(
  client: QueryClient,
  projectId: string,
  governanceRevision: number,
): Promise<void> {
  try {
    const sources = await loadCanonicalProjectionSources(client, projectId);
    const contexts = sources.contexts.map(parseContextProjectionSource);
    const faqs = sources.faqs.map(parseFaqProjectionSource);
    const contextKeys = await upsertContextProjectionRows(client, projectId, contexts, governanceRevision);
    const faqKeys = await upsertFaqProjectionRows(client, projectId, faqs, governanceRevision);
    await deactivateMissingProjectionRows(client, projectId, [...contextKeys, ...faqKeys], governanceRevision);
    await updateProjectionRevision(client, projectId, governanceRevision);
  } catch (error) {
    if (error instanceof TrustedKnowledgeProjectionError) throw error;
    throw new TrustedKnowledgeProjectionError("trusted_knowledge_projection_reconciliation_failed", "Trusted Knowledge reconciliation failed.", { projectId });
  }
}
export const rebuildTrustedKnowledgeProjection = reconcileTrustedKnowledgeProjectionForProject;

function nullableClassification(value: unknown): AiBuilderProvenanceClassification | null { return isAiBuilderProvenanceClassification(value) ? value : null; }
function nullableString(value: unknown): string | null { return typeof value === "string" && value ? value : null; }
function provenance(value: unknown): KnowledgeProvenance { const metadata = optionalObject(value); const correction = optionalObject(metadata.correction); const actor = optionalObject(correction.actor); return { classification: nullableClassification(metadata.provenanceClassification), predecessorClassification: nullableClassification(metadata.predecessorProvenanceClassification), originalClassification: nullableClassification(metadata.originalProvenanceClassification), correctedByClerkUserId: nullableString(actor.clerkUserId), correctedByDisplayName: nullableString(actor.displayName), correctedByEmail: nullableString(actor.email), correctedAt: nullableString(correction.correctedAt) }; }
function runtimeState(value: unknown): "approved" | "corrected" { const state = parseReviewState(value, "context_entry", "runtime"); if (!active(state)) return fail("trusted_knowledge_projection_invalid_source", "Inactive Trusted Knowledge was supplied to runtime mapping.", { reviewState: state }); return state; }

/** Maps active persisted Trusted Knowledge to the existing retrieval contract; provenance remains citation/diagnostic metadata only. */
export function buildKnowledgePackFromTrustedRows(input: { projectId: string; assistantConfiguration: { name: string; purpose: string; tone: string; primaryAudience: string | null }; rows: TrustedKnowledgeProjectionRow[] }): KnowledgePack {
  const facts: KnowledgeFact[] = []; const faq: KnowledgeFaq[] = []; const behaviorRules: KnowledgeFact[] = []; const prohibitedClaims: KnowledgeFact[] = [];
  for (const row of input.rows) { const kind = row.source_item_kind; if (kind !== "faq" && kind !== "context_entry") fail("trusted_knowledge_projection_invalid_source", "Trusted Knowledge source kind is invalid.", { sourceItemKind: kind }); const id = parseId(row.source_item_id, kind); const state = runtimeState(row.review_state); const content = object(row.content, "content", kind, id); const runtimeProvenance = provenance(row.provenance); const revision = Number(row.governance_revision); if (!Number.isSafeInteger(revision) || revision < 0) fail("trusted_knowledge_projection_invalid_source", "Trusted Knowledge governance revision is invalid.", { kind, sourceItemId: id, field: "governanceRevision" }); if (kind === "faq") { faq.push({ id: `knowledge_${id}`, question: text(content.question, "question", "faq", id), answer: text(content.answer, "answer", "faq", id), confidence: confidence(content.confidence, "faq", id), confidenceScore: number(content.confidenceScore, "confidenceScore", "faq", id), sourceEntryIds: stringArray(row.source_entry_ids, "sourceEntryIds", "faq", id), provenance: runtimeProvenance, reviewState: state, governanceRevision: revision }); continue; } const source = parseSource(content.source, id); const metadata = object(content.metadata, "metadata", "context_entry", id, true); const fact: KnowledgeFact = { id: `knowledge_${id}`, category: category(content.category, id), title: text(content.title, "title", "context_entry", id), content: text(content.content, "content", "context_entry", id), confidence: confidence(content.confidence, "context_entry", id), confidenceScore: number(content.confidenceScore, "confidenceScore", "context_entry", id), sourceEntryId: id, sourceExcerpt: source.excerpt, sourceType: source.sourceType, sourceUrl: typeof source.sourceUrl === "string" ? source.sourceUrl : null, tags: Array.isArray(metadata.tags) ? metadata.tags.filter((tag): tag is string => typeof tag === "string") : [], provenance: runtimeProvenance, reviewState: state, governanceRevision: revision }; if (fact.category === "behavior_rule") behaviorRules.push(fact); else if (fact.category === "prohibited_claim") prohibitedClaims.push(fact); else facts.push(fact); }
  const sort = <T extends { id: string }>(items: T[]) => items.sort((a, b) => a.id.localeCompare(b.id)); return { sessionId: input.projectId, assistantName: input.assistantConfiguration.name || "Business AI Assistant", assistantPurpose: input.assistantConfiguration.purpose || "Answer questions using approved business knowledge.", assistantTone: input.assistantConfiguration.tone || "Professional and helpful", primaryAudience: input.assistantConfiguration.primaryAudience, facts: sort(facts), faq: sort(faq), behaviorRules: sort(behaviorRules), prohibitedClaims: sort(prohibitedClaims), builtAt: new Date().toISOString(), version: 1 };
}
