import "server-only";

import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
import type { PersistedWebsiteKnowledge } from "@/app/lib/ai-engine/knowledge/websiteKnowledge";
import {
  candidateClaimIdentity,
  manualCompatibilityMetadata,
  manualEvidenceIdentity,
  manualSnapshotPayload,
  sourceIdentity,
  sourceSnapshotIdentity,
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

async function resolveCandidateClaim(params: { projectId: string; snapshotStorageId: string; claimIdentity: string; claimType: string; category: string; title: string; normalizedContent: string; confidence: string; confidenceScore: number; status: string; metadata: object; createdAt: string; updatedAt: string; evidenceIds: string[] }): Promise<void> {
  if (!params.evidenceIds.length) return;
  const sql = getSql();
  const rows = await sql`INSERT INTO ai_builder_canonical_candidate_claims (claim_identity, project_id, source_snapshot_id, claim_type, category, title, normalized_content, confidence, confidence_score, status, metadata, created_at, updated_at) VALUES (${params.claimIdentity}, ${params.projectId}, ${params.snapshotStorageId}, ${params.claimType}, ${params.category}, ${params.title}, ${params.normalizedContent}, ${params.confidence}, ${params.confidenceScore}, ${params.status}, ${JSON.stringify(params.metadata)}::jsonb, ${params.createdAt}::timestamptz, ${params.updatedAt}::timestamptz) ON CONFLICT (claim_identity) DO UPDATE SET claim_identity = EXCLUDED.claim_identity RETURNING id, project_id, source_snapshot_id` as Array<{ id: string; project_id: string; source_snapshot_id: string }>;
  const row = rows[0];
  if (!row || row.project_id !== params.projectId || row.source_snapshot_id !== params.snapshotStorageId) throw new Error(`canonical_candidate_claim_provenance_integrity_violation:${params.claimIdentity}`);
  await Promise.all(params.evidenceIds.map((evidenceId) => sql`INSERT INTO ai_builder_canonical_candidate_claim_evidence (candidate_claim_id, evidence_id) VALUES (${row.id}, ${evidenceId}) ON CONFLICT DO NOTHING`));
}

async function writeCandidateClaims(input: CanonicalProvenanceInput, manual: ProvenanceWrite, website: ProvenanceWrite | null): Promise<void> {
  const contextEvidence = new Map<string, { snapshotStorageId: string; evidenceId: string }>();
  for (const entry of input.session.contextEntries) {
    const evidenceId = entry.source.sourceType === "manual_intake" ? manual.evidenceIds.get(entry.source.intakeBlockId) : undefined;
    if (evidenceId) contextEvidence.set(entry.id, { snapshotStorageId: manual.snapshotStorageId, evidenceId });
  }
  await Promise.all(input.session.contextEntries.flatMap((entry) => {
    const provenance = contextEvidence.get(entry.id);
    if (!provenance) return [];
    const normalizedContent = entry.content.trim();
    return [resolveCandidateClaim({ projectId: input.projectId, snapshotStorageId: provenance.snapshotStorageId, claimIdentity: candidateClaimIdentity(provenance.snapshotStorageId, "context_entry", `${entry.category}\u0000${entry.title}`, normalizedContent), claimType: "context_entry", category: entry.category, title: entry.title, normalizedContent, confidence: entry.confidence, confidenceScore: entry.confidenceScore, status: entry.status, metadata: { legacyProjectId: input.projectId, legacyContextEntryId: entry.id, sourceType: entry.source.sourceType, generated: entry.metadata.generated }, createdAt: entry.createdAt, updatedAt: entry.updatedAt, evidenceIds: [provenance.evidenceId] })];
  }));
  await Promise.all(input.session.faqEntries.flatMap((entry) => {
    const provenance = entry.sourceEntryIds.map((id) => contextEvidence.get(id)).filter((value): value is { snapshotStorageId: string; evidenceId: string } => Boolean(value));
    const snapshotStorageId = provenance[0]?.snapshotStorageId;
    if (!snapshotStorageId || provenance.some((item) => item.snapshotStorageId !== snapshotStorageId)) return [];
    const normalizedContent = `${entry.question}\n${entry.answer}`;
    return [resolveCandidateClaim({ projectId: input.projectId, snapshotStorageId, claimIdentity: candidateClaimIdentity(snapshotStorageId, "faq", entry.question, normalizedContent), claimType: "faq", category: "faq", title: entry.question, normalizedContent, confidence: entry.confidence, confidenceScore: entry.confidenceScore, status: entry.status, metadata: { legacyProjectId: input.projectId, legacyFaqEntryId: entry.id, legacySourceEntryIds: entry.sourceEntryIds }, createdAt: entry.createdAt, updatedAt: entry.updatedAt, evidenceIds: Array.from(new Set(provenance.map((item) => item.evidenceId))) })];
  }));
  const websiteKnowledge = input.websiteKnowledge;
  if (!website || !websiteKnowledge) return;
  await Promise.all(websiteKnowledge.knowledge.facts.map((fact) => {
    const evidenceIds = fact.evidence.map((evidence) => website.evidenceIds.get(websiteEvidenceIdentity(website.snapshotCanonicalIdentity, fact, evidence))).filter((id): id is string => Boolean(id));
    return resolveCandidateClaim({ projectId: input.projectId, snapshotStorageId: website.snapshotStorageId, claimIdentity: candidateClaimIdentity(website.snapshotStorageId, "website_fact", `${fact.category}\u0000${fact.title}`, fact.value), claimType: "website_fact", category: fact.category, title: fact.title, normalizedContent: fact.value, confidence: fact.confidence, confidenceScore: fact.confidence === "high" ? 0.9 : fact.confidence === "medium" ? 0.6 : 0.3, status: "proposed", metadata: { legacyProjectId: input.projectId, legacyWebsiteKnowledgeDocumentVersion: websiteKnowledge.document_version }, createdAt: websiteKnowledge.imported_at ?? input.session.createdAt, updatedAt: websiteKnowledge.imported_at ?? input.session.updatedAt, evidenceIds });
  }));
}

export async function writeCanonicalProvenanceShadow(input: CanonicalProvenanceInput): Promise<void> {
  // Ordered resolution lets a retry safely complete a partially failed prior write.
  const manual = await writeManualSource(input);
  const website = await writeWebsiteSource(input);
  await writeCandidateClaims(input, manual, website);
}
