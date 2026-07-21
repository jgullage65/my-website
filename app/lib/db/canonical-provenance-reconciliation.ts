import "server-only";

import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
import type { PersistedWebsiteKnowledge } from "@/app/lib/ai-engine/knowledge/websiteKnowledge";
import { websiteFactIdentity } from "@/app/lib/ai-engine/knowledge/websiteKnowledge";
import { ensureAiBuilderSchema } from "./ai-builder-schema";
import { getSql } from "./client";
import { getAiBuilderProjectWithDependencies } from "./ai-builder-repository";
import { buildCanonicalProvenanceShadowQueries } from "./canonical-provenance-shadow";
import { candidateClaimIdentity, manualCompatibilityMetadata, manualEvidenceIdentity, manualSnapshotPayload, sourceIdentity, sourceSnapshotIdentity, websiteCompatibilityMetadata, websiteEvidenceIdentity, websiteSnapshotPayload } from "./canonical-provenance-identities";

export type CanonicalRecordType = "source" | "snapshot" | "evidence" | "candidate_claim" | "candidate_evidence_link" | "claim_review" | "trusted_knowledge";
export type ExpectedCanonicalRecord = { type: CanonicalRecordType; identity: string; owner: string; fields: Record<string, unknown>; repairable: boolean };
export type CanonicalProjectionInput = { projectId: string; session: AiBuilderSession; website: string | null; websiteKnowledge: PersistedWebsiteKnowledge | null };

const stable = <T>(items: T[], identity: (item: T) => string) => [...items].sort((a, b) => identity(a).localeCompare(identity(b)));
const unique = (items: string[]) => Array.from(new Set(items)).sort();
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value as object).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

/**
 * The deterministic, authoritative-data-only projection of reconstructible
 * shadow rows. Governance rows are deliberately excluded: a current review
 * state cannot reproduce its append-only event history.
 */
export function buildExpectedCanonicalProjection(input: CanonicalProjectionInput): ExpectedCanonicalRecord[] {
  const records: ExpectedCanonicalRecord[] = [];
  const add = (record: ExpectedCanonicalRecord) => records.push(record);
  const manualSource = sourceIdentity(input.projectId, "manual");
  const manualPayload = manualSnapshotPayload(input.session.intakeBlocks);
  const manualSnapshot = sourceSnapshotIdentity(input.projectId, "manual", manualPayload);
  const manualMetadata = manualCompatibilityMetadata(input.projectId);
  add({ type: "source", identity: manualSource, owner: input.projectId, fields: { kind: "manual", url: null, metadata: manualMetadata, createdAt: input.session.createdAt }, repairable: true });
  add({ type: "snapshot", identity: manualSnapshot, owner: manualSource, fields: { kind: "intake_submission", payload: manualPayload, metadata: manualMetadata, capturedAt: input.session.createdAt }, repairable: true });
  const context = new Map<string, { snapshot: string; evidence: string[] }>();
  for (const block of stable(input.session.intakeBlocks, (item) => item.id)) {
    const identity = manualEvidenceIdentity(manualSnapshot, block);
    add({ type: "evidence", identity, owner: manualSnapshot, fields: { source: manualSource, content: block.content, url: null, metadata: { ...manualCompatibilityMetadata(input.projectId, block.id), label: block.label }, capturedAt: block.createdAt }, repairable: true });
  }
  for (const entry of input.session.contextEntries) if (entry.source.sourceType === "manual_intake") {
    const evidence = input.session.intakeBlocks.find((block) => block.id === entry.source.intakeBlockId);
    if (evidence) context.set(entry.id, { snapshot: manualSnapshot, evidence: [manualEvidenceIdentity(manualSnapshot, evidence)] });
  }
  if (input.websiteKnowledge) {
    const knowledge = input.websiteKnowledge;
    const source = sourceIdentity(input.projectId, "website");
    const payload = websiteSnapshotPayload(knowledge);
    const snapshot = sourceSnapshotIdentity(input.projectId, "website", payload);
    const capturedAt = knowledge.imported_at ?? input.session.createdAt;
    const metadata = websiteCompatibilityMetadata(input.projectId, knowledge);
    add({ type: "source", identity: source, owner: input.projectId, fields: { kind: "website", url: knowledge.resolved_url ?? knowledge.requested_url ?? input.website, metadata, createdAt: capturedAt }, repairable: true });
    add({ type: "snapshot", identity: snapshot, owner: source, fields: { kind: "website_import", payload, metadata, capturedAt }, repairable: true });
    for (const fact of stable(knowledge.knowledge.facts, websiteFactIdentity)) {
      const evidence = stable(fact.evidence, (item) => `${item.url}\u0000${item.excerpt}`).map((item) => {
        const identity = websiteEvidenceIdentity(snapshot, fact, item);
        add({ type: "evidence", identity, owner: snapshot, fields: { source, content: item.excerpt, url: item.url, metadata: { ...metadata, category: fact.category, title: fact.title, value: fact.value, confidence: fact.confidence }, capturedAt }, repairable: true });
        return identity;
      });
      addClaim(snapshot, "website_fact", fact.category, fact.title, fact.value, fact.confidence, fact.confidence === "high" ? .9 : fact.confidence === "medium" ? .6 : .3, "proposed", { legacyProjectId: input.projectId, legacyWebsiteKnowledgeDocumentVersion: knowledge.document_version }, knowledge.imported_at ?? input.session.createdAt, knowledge.imported_at ?? input.session.updatedAt, evidence);
      for (const entry of input.session.contextEntries) if (entry.source.sourceType === "website" && (entry.id === websiteFactIdentity(fact) || fact.evidence.some((item) => item.url === entry.source.sourceUrl && item.excerpt === entry.source.excerpt))) context.set(entry.id, { snapshot, evidence });
    }
  }
  function addClaim(snapshot: string, claimType: string, category: string, title: string, content: string, confidence: string, score: number, status: string, metadata: Record<string, unknown>, createdAt: string, updatedAt: string, evidence: string[]) {
    const links = unique(evidence); if (!links.length) return;
    const identity = candidateClaimIdentity(snapshot, claimType, claimType === "faq" ? title : `${category}\u0000${title}`, content);
    add({ type: "candidate_claim", identity, owner: input.projectId, fields: { snapshot, claimType, category, title, content, confidence, score, status, metadata, createdAt, updatedAt }, repairable: true });
    for (const evidenceIdentity of links) add({ type: "candidate_evidence_link", identity: `${identity}\u0000${evidenceIdentity}`, owner: identity, fields: { candidateClaim: identity, evidence: evidenceIdentity }, repairable: true });
  }
  for (const entry of stable(input.session.contextEntries, (item) => item.id)) { const p = context.get(entry.id); if (p) addClaim(p.snapshot, "context_entry", entry.category, entry.title, entry.content.trim(), entry.confidence, entry.confidenceScore, entry.status, { legacyProjectId: input.projectId, legacyContextEntryId: entry.id, sourceType: entry.source.sourceType, generated: entry.metadata.generated, provenanceClassification: entry.metadata.provenanceClassification, predecessorProvenanceClassification: entry.metadata.predecessorProvenanceClassification, originalProvenanceClassification: entry.metadata.originalProvenanceClassification }, entry.createdAt, entry.updatedAt, p.evidence); }
  for (const entry of stable(input.session.faqEntries, (item) => item.id)) { const p = entry.sourceEntryIds.map((id) => context.get(id)); if (p.length === entry.sourceEntryIds.length && p.every(Boolean) && p[0] && p.every((item) => item!.snapshot === p[0]!.snapshot)) addClaim(p[0]!.snapshot, "faq", "faq", entry.question, `${entry.question}\n${entry.answer}`, entry.confidence, entry.confidenceScore, entry.status, { legacyProjectId: input.projectId, legacyFaqEntryId: entry.id, legacySourceEntryIds: unique(entry.sourceEntryIds), provenanceClassification: entry.metadata?.provenanceClassification, predecessorProvenanceClassification: entry.metadata?.predecessorProvenanceClassification, originalProvenanceClassification: entry.metadata?.originalProvenanceClassification }, entry.createdAt, entry.updatedAt, p.flatMap((item) => item!.evidence)); }
  return records.sort((a, b) => a.type.localeCompare(b.type) || a.identity.localeCompare(b.identity));
}

export type ReconciliationReadiness = "ready" | "repair_required" | "historical_gap" | "integrity_failure";
export type ReconciliationReport = { expectedCounts: Record<CanonicalRecordType, number>; actualCounts: Record<CanonicalRecordType, number>; missing: ExpectedCanonicalRecord[]; mismatched: Array<{ expected: ExpectedCanonicalRecord; actual: ExpectedCanonicalRecord }>; unexpected: Array<{ record: ExpectedCanonicalRecord; classification: "historical" | "repairable_stale_projection" | "ownership_integrity_problem" | "unknown" }>; repaired: string[]; repairFailures: string[]; integrityFailures: string[]; readiness: ReconciliationReadiness };
export function reconcileCanonicalProjection(expected: ExpectedCanonicalRecord[], actual: ExpectedCanonicalRecord[], projectId?: string): ReconciliationReport {
  const types: CanonicalRecordType[] = ["source", "snapshot", "evidence", "candidate_claim", "candidate_evidence_link", "claim_review", "trusted_knowledge"];
  const counts = (items: ExpectedCanonicalRecord[]) => Object.fromEntries(types.map((type) => [type, items.filter((item) => item.type === type).length])) as Record<CanonicalRecordType, number>;
  const rowsByKey = new Map<string, ExpectedCanonicalRecord[]>();
  for (const item of actual) { const key = `${item.type}:${item.identity}`; rowsByKey.set(key, [...(rowsByKey.get(key) ?? []), item]); }
  const actualByKey = new Map(Array.from(rowsByKey.entries()).filter(([, rows]) => rows.length === 1).map(([key, rows]) => [key, rows[0]!])) as Map<string, ExpectedCanonicalRecord>;
  const expectedKeys = new Set(expected.map((item) => `${item.type}:${item.identity}`));
  const missing = expected.filter((item) => !actualByKey.has(`${item.type}:${item.identity}`));
  const mismatched = expected.flatMap((item) => { const found = actualByKey.get(`${item.type}:${item.identity}`); return found && (found.owner !== item.owner || canonical(found.fields) !== canonical(item.fields)) ? [{ expected: item, actual: found }] : []; });
  const duplicateFailures = Array.from(rowsByKey.entries()).filter(([, rows]) => rows.length > 1).map(([key, rows]) => `duplicate_identity:${key}:owners=${Array.from(new Set(rows.map((row) => row.owner))).sort().join(",")}`);
  const integrityFailures = [...mismatched.filter((item) => item.expected.owner !== item.actual.owner).map((item) => `ownership:${item.expected.type}:${item.expected.identity}`), ...duplicateFailures];
  const owner = projectId ?? expected[0]?.owner;
  const unexpected = actual.filter((item) => !expectedKeys.has(`${item.type}:${item.identity}`)).map((record) => {
    const metadata = record.fields.metadata as Record<string, unknown> | undefined;
    const provenStale = record.owner === owner && record.type !== "claim_review" && record.type !== "trusted_knowledge" && metadata?.legacyProjectId === projectId;
    return { record, classification: (record.owner !== owner ? "ownership_integrity_problem" : provenStale ? "repairable_stale_projection" : (record.type === "claim_review" || record.type === "trusted_knowledge") ? "historical" : "unknown") as "historical" | "repairable_stale_projection" | "ownership_integrity_problem" | "unknown" };
  });
  integrityFailures.push(...unexpected.filter((item) => item.classification === "ownership_integrity_problem").map((item) => `ownership:unexpected:${item.record.type}:${item.record.identity}`));
  const readiness: ReconciliationReadiness = integrityFailures.length ? "integrity_failure" : missing.length || mismatched.length || unexpected.some((item) => item.classification === "repairable_stale_projection") ? "repair_required" : unexpected.some((item) => item.classification === "historical" || item.classification === "unknown") ? "historical_gap" : "ready";
  return { expectedCounts: counts(expected), actualCounts: counts(actual), missing, mismatched, unexpected, repaired: [], repairFailures: [], integrityFailures, readiness };
}

/** Concrete Neon reader for all canonical tables. It never uses shadow rows as projection input. */
export async function loadActualCanonicalProvenance(projectId: string): Promise<ExpectedCanonicalRecord[]> {
  const sql = getSql();
  const [sources, snapshots, evidence, claims, links, reviews, trusted] = await Promise.all([
    sql`SELECT id, canonical_identity, project_id, kind, url, metadata, created_at FROM ai_builder_canonical_sources WHERE project_id=${projectId}`,
    sql`SELECT snapshot.id, snapshot.snapshot_identity, source.canonical_identity source_identity, source.project_id, snapshot.snapshot_kind, snapshot.payload, snapshot.metadata, snapshot.captured_at FROM ai_builder_canonical_source_snapshots snapshot LEFT JOIN ai_builder_canonical_sources source ON source.id=snapshot.source_id WHERE source.project_id=${projectId}`,
    sql`SELECT evidence.id, evidence.evidence_identity, source.project_id, snapshot.snapshot_identity, source.canonical_identity source_identity, evidence.content, evidence.url, evidence.metadata, evidence.captured_at FROM ai_builder_canonical_evidence evidence LEFT JOIN ai_builder_canonical_sources source ON source.id=evidence.source_id LEFT JOIN ai_builder_canonical_source_snapshots snapshot ON snapshot.id=evidence.source_snapshot_id WHERE source.project_id=${projectId}`,
    sql`SELECT claim.id, claim.claim_identity, claim.project_id, snapshot.snapshot_identity, claim.claim_type, claim.category, claim.title, claim.normalized_content, claim.confidence, claim.confidence_score, claim.status, claim.metadata, claim.created_at, claim.updated_at FROM ai_builder_canonical_candidate_claims claim LEFT JOIN ai_builder_canonical_source_snapshots snapshot ON snapshot.id=claim.source_snapshot_id WHERE claim.project_id=${projectId}`,
    sql`SELECT claim.claim_identity, evidence.evidence_identity, claim.project_id FROM ai_builder_canonical_candidate_claim_evidence link LEFT JOIN ai_builder_canonical_candidate_claims claim ON claim.id=link.candidate_claim_id LEFT JOIN ai_builder_canonical_evidence evidence ON evidence.id=link.evidence_id WHERE claim.project_id=${projectId}`,
    sql`SELECT review.review_identity, review.project_id, claim.claim_identity, review.action, review.actor, review.metadata, review.legacy_references, review.reviewed_at FROM ai_builder_canonical_claim_reviews review LEFT JOIN ai_builder_canonical_candidate_claims claim ON claim.id=review.candidate_claim_id WHERE review.project_id=${projectId}`,
    sql`SELECT trusted.trusted_knowledge_identity, trusted.project_id, claim.claim_identity, review.review_identity, trusted.previous_trusted_knowledge_id, trusted.legacy_kind, trusted.legacy_entry_id, trusted.revision, trusted.lifecycle, trusted.metadata, trusted.created_at FROM ai_builder_canonical_trusted_knowledge trusted LEFT JOIN ai_builder_canonical_candidate_claims claim ON claim.id=trusted.candidate_claim_id LEFT JOIN ai_builder_canonical_claim_reviews review ON review.id=trusted.claim_review_id WHERE trusted.project_id=${projectId}`,
  ]) as Array<Array<Record<string, unknown>>>;
  return [
    ...sources.map((r) => ({ type: "source" as const, identity: String(r.canonical_identity), owner: String(r.project_id), fields: { kind: r.kind, url: r.url, metadata: r.metadata, createdAt: new Date(String(r.created_at)).toISOString() }, repairable: true })),
    ...snapshots.map((r) => ({ type: "snapshot" as const, identity: String(r.snapshot_identity), owner: String(r.source_identity), fields: { kind: r.snapshot_kind, payload: r.payload, metadata: r.metadata, capturedAt: new Date(String(r.captured_at)).toISOString() }, repairable: true })),
    ...evidence.map((r) => ({ type: "evidence" as const, identity: String(r.evidence_identity), owner: String(r.snapshot_identity), fields: { source: r.source_identity, content: r.content, url: r.url, metadata: r.metadata, capturedAt: new Date(String(r.captured_at)).toISOString() }, repairable: true })),
    ...claims.map((r) => ({ type: "candidate_claim" as const, identity: String(r.claim_identity), owner: String(r.project_id), fields: { snapshot: r.snapshot_identity, claimType: r.claim_type, category: r.category, title: r.title, content: r.normalized_content, confidence: r.confidence, score: Number(r.confidence_score), status: r.status, metadata: r.metadata, createdAt: new Date(String(r.created_at)).toISOString(), updatedAt: new Date(String(r.updated_at)).toISOString() }, repairable: true })),
    ...links.map((r) => ({ type: "candidate_evidence_link" as const, identity: `${r.claim_identity}\u0000${r.evidence_identity}`, owner: String(r.claim_identity), fields: { candidateClaim: r.claim_identity, evidence: r.evidence_identity }, repairable: true })),
    ...reviews.map((r) => ({ type: "claim_review" as const, identity: String(r.review_identity), owner: String(r.project_id), fields: { candidate: r.claim_identity, action: r.action, actor: r.actor, metadata: r.metadata, legacyReferences: r.legacy_references, reviewedAt: r.reviewed_at }, repairable: false })),
    ...trusted.map((r) => ({ type: "trusted_knowledge" as const, identity: String(r.trusted_knowledge_identity), owner: String(r.project_id), fields: { candidate: r.claim_identity, review: r.review_identity, previous: r.previous_trusted_knowledge_id, legacyKind: r.legacy_kind, legacyEntryId: r.legacy_entry_id, revision: r.revision, lifecycle: r.lifecycle, metadata: r.metadata, createdAt: r.created_at }, repairable: false })),
  ];
}

async function loadAuthorizedCanonicalProject(projectId: string, clerkUserId: string) {
  if (!clerkUserId) throw new Error("canonical_project_not_found_or_not_owned");
  return getAiBuilderProjectWithDependencies(projectId, { identity: { userId: clerkUserId, displayName: "Canonical reconciliation", email: null }, ensureSchema: ensureAiBuilderSchema, sql: getSql() });
}

export async function inspectCanonicalProvenanceProject(projectId: string, clerkUserId: string): Promise<ReconciliationReport> {
  await ensureAiBuilderSchema(); const project = await loadAuthorizedCanonicalProject(projectId, clerkUserId); if (!project) throw new Error("canonical_project_not_found_or_not_owned");
  return reconcileCanonicalProjection(buildExpectedCanonicalProjection({ projectId, session: project.session, website: project.website, websiteKnowledge: project.websiteKnowledge }), await loadActualCanonicalProvenance(projectId), projectId);
}

/** Repairs only the deterministic projection with the legacy project as input. */
export async function repairCanonicalProvenanceProject(projectId: string, clerkUserId: string): Promise<ReconciliationReport> {
  await ensureAiBuilderSchema(); const project = await loadAuthorizedCanonicalProject(projectId, clerkUserId); if (!project) throw new Error("canonical_project_not_found_or_not_owned");
  const input = { projectId, session: project.session, website: project.website, websiteKnowledge: project.websiteKnowledge };
  const before = reconcileCanonicalProjection(buildExpectedCanonicalProjection(input), await loadActualCanonicalProvenance(projectId), projectId);
  if (before.integrityFailures.length || before.mismatched.length || !before.missing.length) return before;
  const sql = getSql();
  try {
    await sql.transaction((tx) => buildCanonicalProvenanceShadowQueries(tx, input));
    const after = reconcileCanonicalProjection(buildExpectedCanonicalProjection(input), await loadActualCanonicalProvenance(projectId), projectId);
    if (after.missing.length || after.integrityFailures.length) throw new Error("canonical_repair_post_verification_failed");
    return { ...after, repaired: before.missing.filter((item) => item.repairable).map((item) => item.identity) };
  } catch (error) { return { ...before, repairFailures: [error instanceof Error ? error.message : String(error)] }; }
}

/** One bounded operational batch; callers persist `nextCursor` before continuing. */
export async function backfillCanonicalProvenanceDatabase(clerkUserId: string, options: { dryRun?: boolean; repair?: boolean; batchSize?: number; cursor?: string | null } = {}): Promise<{ reports: Array<{ projectId: string; report: ReconciliationReport } | { projectId: string; error: string }>; nextCursor: string | null }> {
  await ensureAiBuilderSchema(); const sql = getSql(); const size = Math.max(1, Math.min(500, options.batchSize ?? 50)); const cursor = options.cursor ?? "";
  const rows = await sql`SELECT id FROM ai_builder_projects WHERE id > ${cursor} AND clerk_user_id=${clerkUserId} AND archived_at IS NULL ORDER BY id LIMIT ${size}` as Array<{ id: string }>;
  const reports: Array<{ projectId: string; report: ReconciliationReport } | { projectId: string; error: string }> = [];
  for (const row of rows) try { reports.push({ projectId: row.id, report: options.repair && !options.dryRun ? await repairCanonicalProvenanceProject(row.id, clerkUserId) : await inspectCanonicalProvenanceProject(row.id, clerkUserId) }); } catch (error) { reports.push({ projectId: row.id, error: error instanceof Error ? error.message : String(error) }); }
  return { reports, nextCursor: rows.length === size ? rows[rows.length - 1]!.id : null };
}

/** Storage adapter keeps reconciliation usable by jobs without making shadow data authoritative. */
export type CanonicalReconciliationStore<Tx> = {
  readActual(projectId: string): Promise<ExpectedCanonicalRecord[]>;
  transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T>;
  insertExpected(tx: Tx, record: ExpectedCanonicalRecord): Promise<void>;
};

export async function repairCanonicalProjection<Tx>(input: CanonicalProjectionInput, store: CanonicalReconciliationStore<Tx>, dryRun = false): Promise<ReconciliationReport> {
  const expected = buildExpectedCanonicalProjection(input);
  const before = reconcileCanonicalProjection(expected, await store.readActual(input.projectId), input.projectId);
  if (dryRun || !before.missing.some((record) => record.repairable) || before.integrityFailures.length || before.mismatched.length) return before;
  try {
    const repaired = await store.transaction(async (tx) => {
      const writable = before.missing.filter((record) => record.repairable);
      for (const record of writable) await store.insertExpected(tx, record);
      return writable.map((record) => record.identity);
    });
    const after = reconcileCanonicalProjection(expected, await store.readActual(input.projectId), input.projectId);
    // A successful commit is not enough: identity-level verification is the
    // completion criterion for repair.
    if (after.missing.length) throw new Error("canonical_repair_incomplete");
    return { ...after, repaired };
  } catch (error) {
    return { ...before, repairFailures: [error instanceof Error ? error.message : String(error)] };
  }
}

export type CanonicalBackfillOptions = { dryRun?: boolean; batchSize?: number; cursor?: string | null };
export type CanonicalBackfillResult = { reports: Array<{ projectId: string; report: ReconciliationReport }>; nextCursor: string | null };
export async function backfillCanonicalProjects<Tx>(projects: CanonicalProjectionInput[], store: CanonicalReconciliationStore<Tx>, options: CanonicalBackfillOptions = {}): Promise<CanonicalBackfillResult> {
  const limit = Math.max(1, options.batchSize ?? 50);
  const ordered = [...projects].sort((a, b) => a.projectId.localeCompare(b.projectId)).filter((project) => !options.cursor || project.projectId > options.cursor).slice(0, limit);
  const reports: CanonicalBackfillResult["reports"] = [];
  for (const project of ordered) {
    // Isolate a failure to its project; a batch is never one shared transaction.
    reports.push({ projectId: project.projectId, report: await repairCanonicalProjection(project, store, options.dryRun) });
  }
  return { reports, nextCursor: ordered.length === limit ? ordered[ordered.length - 1]!.projectId : null };
}
