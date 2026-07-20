import "server-only";

import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
import type { PersistedWebsiteKnowledge } from "@/app/lib/ai-engine/knowledge/websiteKnowledge";
import {
  candidateClaimIdentity,
  claimReviewIdentity,
  manualCompatibilityMetadata,
  manualEvidenceIdentity,
  manualSnapshotPayload,
  sourceIdentity,
  sourceSnapshotIdentity,
  trustedKnowledgeIdentity,
  websiteCompatibilityMetadata,
  websiteEvidenceIdentity,
  websiteSnapshotPayload,
} from "./canonical-provenance-identities";
import { getSql } from "./client";

/** Slice 2 compatibility adapter. Canonical rows are write-only provenance. */
type CanonicalProvenanceInput = { projectId: string; session: AiBuilderSession; website: string | null; websiteKnowledge: PersistedWebsiteKnowledge | null };
type SourceStorageRow = { id: string; project_id: string; kind: string };
type SnapshotStorageRow = { id: string; source_id: string };
type EvidenceStorageRow = { id: string; source_id: string; source_snapshot_id: string };
type ProvenanceWrite = { snapshotStorageId: string; snapshotCanonicalIdentity: string; evidenceIds: Map<string, string> };
type CandidateClaimReference = { id: string; identity: string; legacyKind: "context_entry" | "faq"; legacyEntryId: string; status: string; updatedAt: string };
type CanonicalActor = { clerkUserId: string; displayName: string | null; email: string | null };

async function resolveSource(params: { projectId: string; kind: "manual" | "website"; canonicalIdentity: string; url: string | null; metadata: object; createdAt: string }): Promise<string> {
  const sql = getSql();
  const rows = await sql`INSERT INTO ai_builder_canonical_sources (project_id, kind, canonical_identity, url, metadata, created_at) VALUES (${params.projectId}, ${params.kind}, ${params.canonicalIdentity}, ${params.url}, ${JSON.stringify(params.metadata)}::jsonb, ${params.createdAt}::timestamptz) ON CONFLICT (canonical_identity) DO UPDATE SET canonical_identity = EXCLUDED.canonical_identity RETURNING id, project_id, kind` as SourceStorageRow[];
  const row = rows[0];
  if (!row) throw new Error("canonical_source_resolution_failed");
  if (row.project_id !== params.projectId || row.kind !== params.kind) {
    throw new Error(`canonical_source_ownership_integrity_violation:${params.canonicalIdentity}`);
  }
  return row.id;
}

async function resolveSnapshot(params: { sourceStorageId: string; canonicalIdentity: string; kind: string; payload: unknown; metadata: object; capturedAt: string }): Promise<string> {
  const sql = getSql();
  const rows = await sql`INSERT INTO ai_builder_canonical_source_snapshots (source_id, snapshot_identity, snapshot_kind, payload, metadata, captured_at) VALUES (${params.sourceStorageId}, ${params.canonicalIdentity}, ${params.kind}, ${JSON.stringify(params.payload)}::jsonb, ${JSON.stringify(params.metadata)}::jsonb, ${params.capturedAt}::timestamptz) ON CONFLICT (snapshot_identity) DO UPDATE SET snapshot_identity = EXCLUDED.snapshot_identity RETURNING id, source_id` as SnapshotStorageRow[];
  const row = rows[0];
  if (!row) throw new Error("canonical_snapshot_resolution_failed");
  if (row.source_id !== params.sourceStorageId) {
    throw new Error(`canonical_snapshot_source_ownership_integrity_violation:${params.canonicalIdentity}`);
  }
  return row.id;
}

async function resolveEvidence(params: { sourceStorageId: string; snapshotStorageId: string; canonicalIdentity: string; content: string; url: string | null; metadata: object; capturedAt: string }): Promise<string> {
  const sql = getSql();
  const rows = await sql`INSERT INTO ai_builder_canonical_evidence (source_id, source_snapshot_id, evidence_identity, content, url, metadata, captured_at) VALUES (${params.sourceStorageId}, ${params.snapshotStorageId}, ${params.canonicalIdentity}, ${params.content}, ${params.url}, ${JSON.stringify(params.metadata)}::jsonb, ${params.capturedAt}::timestamptz) ON CONFLICT (evidence_identity) DO UPDATE SET evidence_identity = EXCLUDED.evidence_identity RETURNING id, source_id, source_snapshot_id` as EvidenceStorageRow[];
  const row = rows[0];
  if (!row) throw new Error("canonical_evidence_resolution_failed");
  if (row.source_id !== params.sourceStorageId || row.source_snapshot_id !== params.snapshotStorageId) {
    throw new Error(`canonical_evidence_graph_ownership_integrity_violation:${params.canonicalIdentity}`);
  }
  return row.id;
}

async function writeManualSource(input: CanonicalProvenanceInput): Promise<ProvenanceWrite> {
  const { projectId, session } = input;
  const sourceCanonicalIdentity = sourceIdentity(projectId, "manual");
  const payload = manualSnapshotPayload(session.intakeBlocks);
  const snapshotCanonicalIdentity = sourceSnapshotIdentity(projectId, "manual", payload);
  const metadata = manualCompatibilityMetadata(projectId);
  const sourceStorageId = await resolveSource({ projectId, kind: "manual", canonicalIdentity: sourceCanonicalIdentity, url: null, metadata, createdAt: session.createdAt });
  const snapshotStorageId = await resolveSnapshot({ sourceStorageId, canonicalIdentity: snapshotCanonicalIdentity, kind: "intake_submission", payload, metadata, capturedAt: session.createdAt });
  const evidenceIds = new Map<string, string>();
  await Promise.all(session.intakeBlocks.map(async (block) => {
    const evidenceId = await resolveEvidence({ sourceStorageId, snapshotStorageId, canonicalIdentity: manualEvidenceIdentity(snapshotCanonicalIdentity, block), content: block.content, url: null, metadata: { ...manualCompatibilityMetadata(projectId, block.id), label: block.label }, capturedAt: block.createdAt });
    evidenceIds.set(block.id, evidenceId);
  }));
  return { snapshotStorageId, snapshotCanonicalIdentity, evidenceIds };
}

async function writeWebsiteSource(input: CanonicalProvenanceInput): Promise<ProvenanceWrite | null> {
  const { projectId, session, website, websiteKnowledge } = input;
  if (!websiteKnowledge) return null;
  const sourceCanonicalIdentity = sourceIdentity(projectId, "website");
  const payload = websiteSnapshotPayload(websiteKnowledge);
  const snapshotCanonicalIdentity = sourceSnapshotIdentity(projectId, "website", payload);
  const capturedAt = websiteKnowledge.imported_at ?? session.createdAt;
  const metadata = websiteCompatibilityMetadata(projectId, websiteKnowledge);
  const sourceStorageId = await resolveSource({ projectId, kind: "website", canonicalIdentity: sourceCanonicalIdentity, url: websiteKnowledge.resolved_url ?? websiteKnowledge.requested_url ?? website, metadata, createdAt: capturedAt });
  const snapshotStorageId = await resolveSnapshot({ sourceStorageId, canonicalIdentity: snapshotCanonicalIdentity, kind: "website_import", payload, metadata, capturedAt });
  const evidenceIds = new Map<string, string>();
  await Promise.all(websiteKnowledge.knowledge.facts.flatMap((fact) => fact.evidence.map(async (evidence) => {
    const evidenceCanonicalIdentity = websiteEvidenceIdentity(snapshotCanonicalIdentity, fact, evidence);
    const evidenceId = await resolveEvidence({ sourceStorageId, snapshotStorageId, canonicalIdentity: evidenceCanonicalIdentity, content: evidence.excerpt, url: evidence.url, metadata: { ...metadata, category: fact.category, title: fact.title, value: fact.value, confidence: fact.confidence }, capturedAt });
    evidenceIds.set(evidenceCanonicalIdentity, evidenceId);
  })));
  return { snapshotStorageId, snapshotCanonicalIdentity, evidenceIds };
}

async function resolveCandidateClaim(params: { projectId: string; snapshotStorageId: string; claimIdentity: string; claimType: string; category: string; title: string; normalizedContent: string; confidence: string; confidenceScore: number; status: string; metadata: object; createdAt: string; updatedAt: string; evidenceIds: string[] }): Promise<{ id: string; identity: string } | null> {
  if (!params.evidenceIds.length) return null;
  const sql = getSql();
  const rows = await sql`INSERT INTO ai_builder_canonical_candidate_claims (claim_identity, project_id, source_snapshot_id, claim_type, category, title, normalized_content, confidence, confidence_score, status, metadata, created_at, updated_at) VALUES (${params.claimIdentity}, ${params.projectId}, ${params.snapshotStorageId}, ${params.claimType}, ${params.category}, ${params.title}, ${params.normalizedContent}, ${params.confidence}, ${params.confidenceScore}, ${params.status}, ${JSON.stringify(params.metadata)}::jsonb, ${params.createdAt}::timestamptz, ${params.updatedAt}::timestamptz) ON CONFLICT (claim_identity) DO UPDATE SET claim_identity = EXCLUDED.claim_identity RETURNING id, project_id, source_snapshot_id` as Array<{ id: string; project_id: string; source_snapshot_id: string }>;
  const row = rows[0];
  if (!row || row.project_id !== params.projectId || row.source_snapshot_id !== params.snapshotStorageId) throw new Error(`canonical_candidate_claim_provenance_integrity_violation:${params.claimIdentity}`);
  await Promise.all(params.evidenceIds.map((evidenceId) => sql`INSERT INTO ai_builder_canonical_candidate_claim_evidence (candidate_claim_id, evidence_id) VALUES (${row.id}, ${evidenceId}) ON CONFLICT DO NOTHING`));
  return { id: row.id, identity: params.claimIdentity };
}

async function writeCandidateClaims(input: CanonicalProvenanceInput, manual: ProvenanceWrite, website: ProvenanceWrite | null): Promise<CandidateClaimReference[]> {
  const candidates: CandidateClaimReference[] = [];
  const contextEvidence = new Map<string, { snapshotStorageId: string; evidenceId: string }>();
  for (const entry of input.session.contextEntries) {
    const evidenceId = entry.source.sourceType === "manual_intake" ? manual.evidenceIds.get(entry.source.intakeBlockId) : undefined;
    if (evidenceId) contextEvidence.set(entry.id, { snapshotStorageId: manual.snapshotStorageId, evidenceId });
  }
  await Promise.all(input.session.contextEntries.flatMap(async (entry) => {
    const provenance = contextEvidence.get(entry.id);
    if (!provenance) return [];
    const normalizedContent = entry.content.trim();
    const resolved = await resolveCandidateClaim({ projectId: input.projectId, snapshotStorageId: provenance.snapshotStorageId, claimIdentity: candidateClaimIdentity(provenance.snapshotStorageId, "context_entry", `${entry.category}\u0000${entry.title}`, normalizedContent), claimType: "context_entry", category: entry.category, title: entry.title, normalizedContent, confidence: entry.confidence, confidenceScore: entry.confidenceScore, status: entry.status, metadata: { legacyProjectId: input.projectId, legacyContextEntryId: entry.id, sourceType: entry.source.sourceType, generated: entry.metadata.generated }, createdAt: entry.createdAt, updatedAt: entry.updatedAt, evidenceIds: [provenance.evidenceId] });
    if (resolved) candidates.push({ ...resolved, legacyKind: "context_entry", legacyEntryId: entry.id, status: entry.status, updatedAt: entry.updatedAt });
  }));
  await Promise.all(input.session.faqEntries.flatMap(async (entry) => {
    const provenance = entry.sourceEntryIds.map((id) => contextEvidence.get(id)).filter((value): value is { snapshotStorageId: string; evidenceId: string } => Boolean(value));
    const snapshotStorageId = provenance[0]?.snapshotStorageId;
    if (!snapshotStorageId || provenance.some((item) => item.snapshotStorageId !== snapshotStorageId)) return [];
    const normalizedContent = `${entry.question}\n${entry.answer}`;
    const resolved = await resolveCandidateClaim({ projectId: input.projectId, snapshotStorageId, claimIdentity: candidateClaimIdentity(snapshotStorageId, "faq", entry.question, normalizedContent), claimType: "faq", category: "faq", title: entry.question, normalizedContent, confidence: entry.confidence, confidenceScore: entry.confidenceScore, status: entry.status, metadata: { legacyProjectId: input.projectId, legacyFaqEntryId: entry.id, legacySourceEntryIds: entry.sourceEntryIds }, createdAt: entry.createdAt, updatedAt: entry.updatedAt, evidenceIds: Array.from(new Set(provenance.map((item) => item.evidenceId)))});
    if (resolved) candidates.push({ ...resolved, legacyKind: "faq", legacyEntryId: entry.id, status: entry.status, updatedAt: entry.updatedAt });
  }));
  const websiteKnowledge = input.websiteKnowledge;
  if (!website || !websiteKnowledge) return candidates;
  await Promise.all(websiteKnowledge.knowledge.facts.map((fact) => {
    const evidenceIds = fact.evidence.map((evidence) => website.evidenceIds.get(websiteEvidenceIdentity(website.snapshotCanonicalIdentity, fact, evidence))).filter((id): id is string => Boolean(id));
    return resolveCandidateClaim({ projectId: input.projectId, snapshotStorageId: website.snapshotStorageId, claimIdentity: candidateClaimIdentity(website.snapshotStorageId, "website_fact", `${fact.category}\u0000${fact.title}`, fact.value), claimType: "website_fact", category: fact.category, title: fact.title, normalizedContent: fact.value, confidence: fact.confidence, confidenceScore: fact.confidence === "high" ? 0.9 : fact.confidence === "medium" ? 0.6 : 0.3, status: "proposed", metadata: { legacyProjectId: input.projectId, legacyWebsiteKnowledgeDocumentVersion: websiteKnowledge.document_version }, createdAt: websiteKnowledge.imported_at ?? input.session.createdAt, updatedAt: websiteKnowledge.imported_at ?? input.session.updatedAt, evidenceIds });
  }));
  return candidates;
}

export type LegacyReviewEntry = { id: string; status: string; content: string; updatedAt: string; kind: "context_entry" | "faq" };
export type LegacyReviewTransition = { entry: LegacyReviewEntry; action: "approve" | "correction" | "archive" | "restore" | "reject" };

/** Interprets only a persisted legacy review mutation; a current status is not an event. */
export function interpretLegacyReviewDeltas(previous: LegacyReviewEntry[], next: LegacyReviewEntry[]): LegacyReviewTransition[] {
  const before = new Map(previous.map((entry) => [`${entry.kind}:${entry.id}`, entry]));
  return next.flatMap((entry): LegacyReviewTransition[] => {
    const prior = before.get(`${entry.kind}:${entry.id}`);
    if (!prior) return [];
    const priorTrusted = prior.status === "approved" || prior.status === "corrected";
    const nextTrusted = entry.status === "approved" || entry.status === "corrected";
    if (prior.status === "proposed" && entry.status === "approved") return [{ entry, action: "approve" as const }];
    if (prior.status === "proposed" && entry.status === "archived") return [{ entry, action: "reject" as const }];
    if (priorTrusted && entry.status === "archived") return [{ entry, action: "archive" as const }];
    if (prior.status === "archived" && nextTrusted) return [{ entry, action: "restore" as const }];
    if (priorTrusted && nextTrusted && prior.content !== entry.content) return [{ entry, action: "correction" as const }];
    return [];
  });
}

export async function writeCanonicalGovernanceShadow(input: { projectId: string; transitions: LegacyReviewTransition[]; actor: CanonicalActor }, sql: ReturnType<typeof getSql>): Promise<void> {
  for (const transition of input.transitions) {
    const metadataKey = transition.entry.kind === "context_entry" ? "legacyContextEntryId" : "legacyFaqEntryId";
    const candidates = await sql`SELECT id, claim_identity FROM ai_builder_canonical_candidate_claims WHERE project_id = ${input.projectId} AND metadata ->> ${metadataKey} = ${transition.entry.id} AND normalized_content = ${transition.entry.content.trim()} ORDER BY created_at DESC LIMIT 1` as Array<{ id: string; claim_identity: string }>;
    let candidate = candidates[0];
    // A correction is a new immutable observation of the same evidenced
    // legacy entry. Keep the prior source snapshot/evidence; never edit it.
    if (!candidate && transition.action === "correction") {
      const priorCandidates = await sql`SELECT id, claim_identity, source_snapshot_id, claim_type, category, title, confidence, confidence_score, metadata, created_at FROM ai_builder_canonical_candidate_claims WHERE project_id = ${input.projectId} AND metadata ->> ${metadataKey} = ${transition.entry.id} ORDER BY created_at DESC LIMIT 1` as Array<{ id: string; claim_identity: string; source_snapshot_id: string; claim_type: string; category: string; title: string; confidence: string; confidence_score: number; metadata: object; created_at: string }>;
      const prior = priorCandidates[0];
      if (prior) {
        const identity = candidateClaimIdentity(prior.source_snapshot_id, prior.claim_type, `${transition.entry.kind}\u0000${transition.entry.id}`, transition.entry.content.trim());
        const created = await sql`INSERT INTO ai_builder_canonical_candidate_claims (claim_identity, project_id, source_snapshot_id, claim_type, category, title, normalized_content, confidence, confidence_score, status, metadata, created_at, updated_at) VALUES (${identity}, ${input.projectId}, ${prior.source_snapshot_id}, ${prior.claim_type}, ${prior.category}, ${prior.title}, ${transition.entry.content.trim()}, ${prior.confidence}, ${prior.confidence_score}, ${"corrected"}, ${JSON.stringify(prior.metadata)}::jsonb, ${transition.entry.updatedAt}::timestamptz, ${transition.entry.updatedAt}::timestamptz) ON CONFLICT (claim_identity) DO UPDATE SET claim_identity = EXCLUDED.claim_identity RETURNING id, claim_identity` as Array<{ id: string; claim_identity: string }>;
        candidate = created[0];
        if (candidate) await sql`INSERT INTO ai_builder_canonical_candidate_claim_evidence (candidate_claim_id, evidence_id) SELECT ${candidate.id}, evidence_id FROM ai_builder_canonical_candidate_claim_evidence WHERE candidate_claim_id = ${prior.id} ON CONFLICT DO NOTHING`;
      }
    }
    if (!candidate) throw new Error(`canonical_governance_candidate_missing:${transition.entry.kind}:${transition.entry.id}`);
    const reviewIdentity = claimReviewIdentity(input.projectId, transition.entry.kind, transition.entry.id, candidate.claim_identity, transition.action, transition.entry.updatedAt);
    const legacyReferences = JSON.stringify({ legacyProjectId: input.projectId, legacyKind: transition.entry.kind, legacyEntryId: transition.entry.id });
    if (transition.action === "reject") {
      await sql`INSERT INTO ai_builder_canonical_claim_reviews (review_identity, project_id, candidate_claim_id, action, actor, metadata, legacy_references, reviewed_at, created_at) VALUES (${reviewIdentity}, ${input.projectId}, ${candidate.id}, ${transition.action}, ${JSON.stringify(input.actor)}::jsonb, ${JSON.stringify({ migrationSlice: 4 })}::jsonb, ${legacyReferences}::jsonb, ${transition.entry.updatedAt}::timestamptz, ${transition.entry.updatedAt}::timestamptz) ON CONFLICT (review_identity) DO UPDATE SET review_identity = EXCLUDED.review_identity`;
      continue;
    }
    // One CTE atomically resolves the review and the next immutable revision.
    // SERIALIZABLE retries are safe because the review identity is stable.
    const lifecycle = transition.action === "archive" ? "archived" : "active";
    const writeRevision = () => sql.transaction([sql`WITH review AS (INSERT INTO ai_builder_canonical_claim_reviews (review_identity, project_id, candidate_claim_id, action, actor, metadata, legacy_references, reviewed_at, created_at) VALUES (${reviewIdentity}, ${input.projectId}, ${candidate.id}, ${transition.action}, ${JSON.stringify(input.actor)}::jsonb, ${JSON.stringify({ migrationSlice: 4 })}::jsonb, ${legacyReferences}::jsonb, ${transition.entry.updatedAt}::timestamptz, ${transition.entry.updatedAt}::timestamptz) ON CONFLICT (review_identity) DO UPDATE SET review_identity = EXCLUDED.review_identity RETURNING id), latest AS (SELECT id, revision FROM ai_builder_canonical_trusted_knowledge WHERE project_id = ${input.projectId} AND legacy_kind = ${transition.entry.kind} AND legacy_entry_id = ${transition.entry.id} ORDER BY revision DESC LIMIT 1 FOR UPDATE) INSERT INTO ai_builder_canonical_trusted_knowledge (trusted_knowledge_identity, project_id, candidate_claim_id, claim_review_id, previous_trusted_knowledge_id, legacy_kind, legacy_entry_id, revision, lifecycle, metadata, created_at) SELECT ${trustedKnowledgeIdentity(input.projectId, transition.entry.kind, transition.entry.id, reviewIdentity)}, ${input.projectId}, ${candidate.id}, review.id, latest.id, ${transition.entry.kind}, ${transition.entry.id}, COALESCE(latest.revision, 0) + 1, ${lifecycle}, ${JSON.stringify({ migrationSlice: 4, reviewAction: transition.action })}::jsonb, ${transition.entry.updatedAt}::timestamptz FROM review LEFT JOIN latest ON TRUE WHERE ${transition.action} <> 'archive' OR latest.id IS NOT NULL ON CONFLICT (trusted_knowledge_identity) DO UPDATE SET trusted_knowledge_identity = EXCLUDED.trusted_knowledge_identity`], { isolationLevel: "Serializable" });
    for (let attempt = 0; ; attempt += 1) {
      try { await writeRevision(); break; } catch (error) {
        const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
        if (code !== "40001" || attempt === 2) throw error;
      }
    }
  }
}

export async function writeCanonicalProvenanceShadow(input: CanonicalProvenanceInput): Promise<void> {
  // Ordered resolution lets a retry safely complete a partially failed prior write.
  const manual = await writeManualSource(input);
  const website = await writeWebsiteSource(input);
  const candidates = await writeCandidateClaims(input, manual, website);
  void candidates;
}
