import "server-only";

import type { NeonQueryFunctionInTransaction, NeonQueryInTransaction, PoolClient } from "@neondatabase/serverless";

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


type TransactionSql = NeonQueryFunctionInTransaction<boolean, boolean>;

/**
 * Builds the canonical provenance compatibility projection for the same Neon
 * batch as initial project creation. Each dependent statement resolves its
 * parent by immutable identity, so no separately-opened transaction or
 * returned generated id is required.
 */
export function buildCanonicalProvenanceShadowQueries(sql: TransactionSql, input: CanonicalProvenanceInput): NeonQueryInTransaction[] {
  const queries: NeonQueryInTransaction[] = [];
  const addSource = (kind: "manual" | "website", identity: string, url: string | null, metadata: object, createdAt: string) => {
    queries.push(sql`INSERT INTO ai_builder_canonical_sources (project_id, kind, canonical_identity, url, metadata, created_at) VALUES (${input.projectId}, ${kind}, ${identity}, ${url}, ${JSON.stringify(metadata)}::jsonb, ${createdAt}::timestamptz) ON CONFLICT (canonical_identity) DO UPDATE SET canonical_identity = EXCLUDED.canonical_identity`);
    queries.push(sql`SELECT CASE WHEN EXISTS (SELECT 1 FROM ai_builder_canonical_sources WHERE canonical_identity = ${identity} AND project_id = ${input.projectId} AND kind = ${kind}) THEN 1 ELSE CAST('AI_BUILDER_CANONICAL_PROVENANCE_OWNERSHIP_COLLISION:' || pg_backend_pid() AS INTEGER) END AS canonical_ownership_verified`);
  };
  const addSnapshot = (sourceIdentityValue: string, identity: string, kind: string, payload: unknown, metadata: object, capturedAt: string) => {
    queries.push(sql`INSERT INTO ai_builder_canonical_source_snapshots (source_id, snapshot_identity, snapshot_kind, payload, metadata, captured_at) VALUES ((SELECT id FROM ai_builder_canonical_sources WHERE canonical_identity = ${sourceIdentityValue}), ${identity}, ${kind}, ${JSON.stringify(payload)}::jsonb, ${JSON.stringify(metadata)}::jsonb, ${capturedAt}::timestamptz) ON CONFLICT (snapshot_identity) DO UPDATE SET snapshot_identity = EXCLUDED.snapshot_identity`);
    queries.push(sql`SELECT CASE WHEN EXISTS (SELECT 1 FROM ai_builder_canonical_source_snapshots snapshot JOIN ai_builder_canonical_sources source ON source.id = snapshot.source_id WHERE snapshot.snapshot_identity = ${identity} AND source.canonical_identity = ${sourceIdentityValue}) THEN 1 ELSE CAST('AI_BUILDER_CANONICAL_PROVENANCE_OWNERSHIP_COLLISION:' || pg_backend_pid() AS INTEGER) END AS canonical_ownership_verified`);
  };
  const addEvidence = (sourceIdentityValue: string, snapshotIdentityValue: string, identity: string, content: string, url: string | null, metadata: object, capturedAt: string) => {
    queries.push(sql`INSERT INTO ai_builder_canonical_evidence (source_id, source_snapshot_id, evidence_identity, content, url, metadata, captured_at) VALUES ((SELECT id FROM ai_builder_canonical_sources WHERE canonical_identity = ${sourceIdentityValue}), (SELECT id FROM ai_builder_canonical_source_snapshots WHERE snapshot_identity = ${snapshotIdentityValue}), ${identity}, ${content}, ${url}, ${JSON.stringify(metadata)}::jsonb, ${capturedAt}::timestamptz) ON CONFLICT (evidence_identity) DO UPDATE SET evidence_identity = EXCLUDED.evidence_identity`);
    queries.push(sql`SELECT CASE WHEN EXISTS (SELECT 1 FROM ai_builder_canonical_evidence evidence JOIN ai_builder_canonical_sources source ON source.id = evidence.source_id JOIN ai_builder_canonical_source_snapshots snapshot ON snapshot.id = evidence.source_snapshot_id WHERE evidence.evidence_identity = ${identity} AND source.canonical_identity = ${sourceIdentityValue} AND snapshot.snapshot_identity = ${snapshotIdentityValue}) THEN 1 ELSE CAST('AI_BUILDER_CANONICAL_PROVENANCE_OWNERSHIP_COLLISION:' || pg_backend_pid() AS INTEGER) END AS canonical_ownership_verified`);
  };
  const addClaim = (snapshotIdentityValue: string, identity: string, type: string, category: string, title: string, content: string, confidence: string, score: number, status: string, metadata: object, createdAt: string, updatedAt: string, evidenceIdentities: string[]) => {
    if (!evidenceIdentities.length) return;
    queries.push(sql`INSERT INTO ai_builder_canonical_candidate_claims (claim_identity, project_id, source_snapshot_id, claim_type, category, title, normalized_content, confidence, confidence_score, status, metadata, created_at, updated_at) VALUES (${identity}, ${input.projectId}, (SELECT id FROM ai_builder_canonical_source_snapshots WHERE snapshot_identity = ${snapshotIdentityValue}), ${type}, ${category}, ${title}, ${content}, ${confidence}, ${score}, ${status}, ${JSON.stringify(metadata)}::jsonb, ${createdAt}::timestamptz, ${updatedAt}::timestamptz) ON CONFLICT (claim_identity) DO UPDATE SET claim_identity = EXCLUDED.claim_identity`);
    queries.push(sql`SELECT CASE WHEN EXISTS (SELECT 1 FROM ai_builder_canonical_candidate_claims claim JOIN ai_builder_canonical_source_snapshots snapshot ON snapshot.id = claim.source_snapshot_id WHERE claim.claim_identity = ${identity} AND claim.project_id = ${input.projectId} AND snapshot.snapshot_identity = ${snapshotIdentityValue}) THEN 1 ELSE CAST('AI_BUILDER_CANONICAL_PROVENANCE_OWNERSHIP_COLLISION:' || pg_backend_pid() AS INTEGER) END AS canonical_ownership_verified`);
    for (const evidenceIdentity of evidenceIdentities) queries.push(sql`INSERT INTO ai_builder_canonical_candidate_claim_evidence (candidate_claim_id, evidence_id) VALUES ((SELECT id FROM ai_builder_canonical_candidate_claims WHERE claim_identity = ${identity}), (SELECT id FROM ai_builder_canonical_evidence WHERE evidence_identity = ${evidenceIdentity})) ON CONFLICT DO NOTHING`);
  };

  const manualSource = sourceIdentity(input.projectId, "manual");
  const manualPayload = manualSnapshotPayload(input.session.intakeBlocks);
  const manualSnapshot = sourceSnapshotIdentity(input.projectId, "manual", manualPayload);
  const manualMetadata = manualCompatibilityMetadata(input.projectId);
  addSource("manual", manualSource, null, manualMetadata, input.session.createdAt);
  addSnapshot(manualSource, manualSnapshot, "intake_submission", manualPayload, manualMetadata, input.session.createdAt);
  const manualEvidence = new Map<string, string>();
  for (const block of input.session.intakeBlocks) {
    const identity = manualEvidenceIdentity(manualSnapshot, block);
    manualEvidence.set(block.id, identity);
    addEvidence(manualSource, manualSnapshot, identity, block.content, null, { ...manualCompatibilityMetadata(input.projectId, block.id), label: block.label }, block.createdAt);
  }
  for (const entry of input.session.contextEntries) {
    const evidence = entry.source.sourceType === "manual_intake" ? manualEvidence.get(entry.source.intakeBlockId) : undefined;
    if (evidence) addClaim(manualSnapshot, candidateClaimIdentity(manualSnapshot, "context_entry", `${entry.category}\u0000${entry.title}`, entry.content.trim()), "context_entry", entry.category, entry.title, entry.content.trim(), entry.confidence, entry.confidenceScore, entry.status, { legacyProjectId: input.projectId, legacyContextEntryId: entry.id, sourceType: entry.source.sourceType, generated: entry.metadata.generated }, entry.createdAt, entry.updatedAt, [evidence]);
  }
  for (const entry of input.session.faqEntries) {
    const evidence = entry.sourceEntryIds.map((id) => manualEvidence.get(id)).filter((value): value is string => Boolean(value));
    if (evidence.length) addClaim(manualSnapshot, candidateClaimIdentity(manualSnapshot, "faq", entry.question, `${entry.question}\n${entry.answer}`), "faq", "faq", entry.question, `${entry.question}\n${entry.answer}`, entry.confidence, entry.confidenceScore, entry.status, { legacyProjectId: input.projectId, legacyFaqEntryId: entry.id, legacySourceEntryIds: entry.sourceEntryIds }, entry.createdAt, entry.updatedAt, Array.from(new Set(evidence)));
  }
  if (input.websiteKnowledge) {
    const knowledge = input.websiteKnowledge;
    const websiteSource = sourceIdentity(input.projectId, "website");
    const websitePayload = websiteSnapshotPayload(knowledge);
    const websiteSnapshot = sourceSnapshotIdentity(input.projectId, "website", websitePayload);
    const capturedAt = knowledge.imported_at ?? input.session.createdAt;
    const metadata = websiteCompatibilityMetadata(input.projectId, knowledge);
    addSource("website", websiteSource, knowledge.resolved_url ?? knowledge.requested_url ?? input.website, metadata, capturedAt);
    addSnapshot(websiteSource, websiteSnapshot, "website_import", websitePayload, metadata, capturedAt);
    for (const fact of knowledge.knowledge.facts) {
      const evidence = fact.evidence.map((item) => {
        const identity = websiteEvidenceIdentity(websiteSnapshot, fact, item);
        addEvidence(websiteSource, websiteSnapshot, identity, item.excerpt, item.url, { ...metadata, category: fact.category, title: fact.title, value: fact.value, confidence: fact.confidence }, capturedAt);
        return identity;
      });
      addClaim(websiteSnapshot, candidateClaimIdentity(websiteSnapshot, "website_fact", `${fact.category}\u0000${fact.title}`, fact.value), "website_fact", fact.category, fact.title, fact.value, fact.confidence, fact.confidence === "high" ? 0.9 : fact.confidence === "medium" ? 0.6 : 0.3, "proposed", { legacyProjectId: input.projectId, legacyWebsiteKnowledgeDocumentVersion: knowledge.document_version }, knowledge.imported_at ?? input.session.createdAt, knowledge.imported_at ?? input.session.updatedAt, evidence);
    }
  }
  return queries;
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

export type GovernanceWriteResult = { transitionCount: number; reviewCount: number; trustedKnowledgeCount: number };

/** Writes one immutable governance event at a time on the caller's connection. */
export async function writeCanonicalGovernanceShadow(
  input: { projectId: string; transitions: LegacyReviewTransition[]; actor: CanonicalActor },
  tx: PoolClient,
): Promise<GovernanceWriteResult> {
  let reviewCount = 0;
  let trustedKnowledgeCount = 0;
  for (const transition of input.transitions) {
    const key = transition.entry.kind === "context_entry" ? "legacyContextEntryId" : "legacyFaqEntryId";
    const content = transition.entry.content.trim();
    const matching = await tx.query(`SELECT id, claim_identity FROM ai_builder_canonical_candidate_claims WHERE project_id = $1 AND metadata ->> $2 = $3 AND normalized_content = $4 ORDER BY created_at DESC, id DESC LIMIT 1`, [input.projectId, key, transition.entry.id, content]);
    let candidate = matching.rows[0] as { id: string; claim_identity: string } | undefined;

    if (transition.action === "correction") {
      const predecessorRows = await tx.query(`SELECT id, source_snapshot_id, claim_type, category, title, confidence, confidence_score, metadata, created_at FROM ai_builder_canonical_candidate_claims WHERE project_id = $1 AND metadata ->> $2 = $3 AND normalized_content <> $4 ${candidate ? "AND id <> $5" : ""} ORDER BY created_at DESC, id DESC LIMIT 1`, candidate ? [input.projectId, key, transition.entry.id, content, candidate.id] : [input.projectId, key, transition.entry.id, content]);
      const predecessor = predecessorRows.rows[0] as { id: string; source_snapshot_id: string; claim_type: string; category: string; title: string; confidence: string; confidence_score: number; metadata: object } | undefined;
      if (!predecessor) throw new Error(`canonical_governance_candidate_missing:${transition.entry.kind}:${transition.entry.id}`);
      if (!candidate) {
        const identity = candidateClaimIdentity(predecessor.source_snapshot_id, predecessor.claim_type, `${transition.entry.kind}\u0000${transition.entry.id}`, content);
        const created = await tx.query(`INSERT INTO ai_builder_canonical_candidate_claims (claim_identity, project_id, source_snapshot_id, claim_type, category, title, normalized_content, confidence, confidence_score, status, metadata, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'corrected',$10::jsonb,$11::timestamptz,$11::timestamptz) ON CONFLICT (claim_identity) DO UPDATE SET claim_identity = EXCLUDED.claim_identity RETURNING id, claim_identity`, [identity, input.projectId, predecessor.source_snapshot_id, predecessor.claim_type, predecessor.category, predecessor.title, content, predecessor.confidence, predecessor.confidence_score, JSON.stringify(predecessor.metadata), transition.entry.updatedAt]);
        candidate = created.rows[0] as { id: string; claim_identity: string } | undefined;
      }
      if (!candidate) throw new Error(`canonical_governance_candidate_missing:${transition.entry.kind}:${transition.entry.id}`);
      await tx.query(`INSERT INTO ai_builder_canonical_candidate_claim_evidence (candidate_claim_id, evidence_id) SELECT $1, evidence_id FROM ai_builder_canonical_candidate_claim_evidence WHERE candidate_claim_id = $2 ON CONFLICT DO NOTHING`, [candidate.id, predecessor.id]);
      const evidence = await tx.query(`SELECT (SELECT count(*) FROM ai_builder_canonical_candidate_claim_evidence WHERE candidate_claim_id = $1) AS corrected, (SELECT count(*) FROM ai_builder_canonical_candidate_claim_evidence WHERE candidate_claim_id = $2) AS predecessor`, [candidate.id, predecessor.id]);
      const counts = evidence.rows[0] as { corrected: string; predecessor: string } | undefined;
      if (counts && Number(counts.corrected) < Number(counts.predecessor)) throw new Error(`canonical_correction_evidence_inheritance_failed:${transition.entry.kind}:${transition.entry.id}`);
    }
    if (!candidate) throw new Error(`canonical_governance_candidate_missing:${transition.entry.kind}:${transition.entry.id}`);

    const reviewIdentity = claimReviewIdentity(input.projectId, transition.entry.kind, transition.entry.id, candidate.claim_identity, transition.action, transition.entry.updatedAt);
    const review = await tx.query(`INSERT INTO ai_builder_canonical_claim_reviews (review_identity, project_id, candidate_claim_id, action, actor, metadata, legacy_references, reviewed_at, created_at) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::timestamptz,$8::timestamptz) ON CONFLICT (review_identity) DO UPDATE SET review_identity = EXCLUDED.review_identity RETURNING id, review_identity`, [reviewIdentity, input.projectId, candidate.id, transition.action, JSON.stringify(input.actor), JSON.stringify({ migrationSlice: 4 }), JSON.stringify({ legacyProjectId: input.projectId, legacyKind: transition.entry.kind, legacyEntryId: transition.entry.id }), transition.entry.updatedAt]);
    const reviewRow = review.rows[0] as { id: string } | undefined;
    if (!reviewRow) throw new Error(`canonical_governance_review_resolution_failed:${transition.entry.kind}:${transition.entry.id}`);
    reviewCount += 1;
    if (transition.action === "reject") continue;

    const latest = await tx.query(`SELECT id, revision FROM ai_builder_canonical_trusted_knowledge WHERE project_id = $1 AND legacy_kind = $2 AND legacy_entry_id = $3 ORDER BY revision DESC LIMIT 1 FOR UPDATE`, [input.projectId, transition.entry.kind, transition.entry.id]);
    const previous = latest.rows[0] as { id: string; revision: number } | undefined;
    if (transition.action === "archive" && !previous) throw new Error(`canonical_governance_archive_without_trusted_knowledge:${transition.entry.kind}:${transition.entry.id}`);
    const trustedIdentity = trustedKnowledgeIdentity(input.projectId, transition.entry.kind, transition.entry.id, reviewIdentity);
    const trusted = await tx.query(`INSERT INTO ai_builder_canonical_trusted_knowledge (trusted_knowledge_identity, project_id, candidate_claim_id, claim_review_id, previous_trusted_knowledge_id, legacy_kind, legacy_entry_id, revision, lifecycle, metadata, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::timestamptz) ON CONFLICT (trusted_knowledge_identity) DO UPDATE SET trusted_knowledge_identity = EXCLUDED.trusted_knowledge_identity RETURNING id`, [trustedIdentity, input.projectId, candidate.id, reviewRow.id, previous?.id ?? null, transition.entry.kind, transition.entry.id, (previous?.revision ?? 0) + 1, transition.action === "archive" ? "archived" : "active", JSON.stringify({ migrationSlice: 4, reviewAction: transition.action }), transition.entry.updatedAt]);
    if (!trusted.rows[0]) throw new Error(`canonical_governance_trusted_knowledge_resolution_failed:${transition.entry.kind}:${transition.entry.id}`);
    trustedKnowledgeCount += 1;
  }
  if (reviewCount !== input.transitions.length || trustedKnowledgeCount !== input.transitions.filter((item) => item.action !== "reject").length) throw new Error("canonical_governance_write_count_mismatch");
  return { transitionCount: input.transitions.length, reviewCount, trustedKnowledgeCount };
}

export async function writeCanonicalProvenanceShadow(input: CanonicalProvenanceInput): Promise<void> {
  // Ordered resolution lets a retry safely complete a partially failed prior write.
  const manual = await writeManualSource(input);
  const website = await writeWebsiteSource(input);
  const candidates = await writeCandidateClaims(input, manual, website);
  void candidates;
}
