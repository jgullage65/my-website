import "server-only";

import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
import type { PersistedWebsiteKnowledge } from "@/app/lib/ai-engine/knowledge/websiteKnowledge";
import {
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

async function resolveEvidence(params: { sourceStorageId: string; snapshotStorageId: string; canonicalIdentity: string; content: string; url: string | null; metadata: object; capturedAt: string }): Promise<void> {
  const sql = getSql();
  const rows = await sql`INSERT INTO ai_builder_canonical_evidence (source_id, source_snapshot_id, evidence_identity, content, url, metadata, captured_at) VALUES (${params.sourceStorageId}, ${params.snapshotStorageId}, ${params.canonicalIdentity}, ${params.content}, ${params.url}, ${JSON.stringify(params.metadata)}::jsonb, ${params.capturedAt}::timestamptz) ON CONFLICT (evidence_identity) DO UPDATE SET evidence_identity = EXCLUDED.evidence_identity RETURNING id, source_id, source_snapshot_id` as EvidenceStorageRow[];
  const row = rows[0];
  if (!row) throw new Error("canonical_evidence_resolution_failed");
  if (row.source_id !== params.sourceStorageId || row.source_snapshot_id !== params.snapshotStorageId) {
    throw new Error(`canonical_evidence_graph_ownership_integrity_violation:${params.canonicalIdentity}`);
  }
}

async function writeManualSource(input: CanonicalProvenanceInput): Promise<void> {
  const { projectId, session } = input;
  const sourceCanonicalIdentity = sourceIdentity(projectId, "manual");
  const payload = manualSnapshotPayload(session.intakeBlocks);
  const snapshotCanonicalIdentity = sourceSnapshotIdentity(projectId, "manual", payload);
  const metadata = manualCompatibilityMetadata(projectId);
  const sourceStorageId = await resolveSource({ projectId, kind: "manual", canonicalIdentity: sourceCanonicalIdentity, url: null, metadata, createdAt: session.createdAt });
  const snapshotStorageId = await resolveSnapshot({ sourceStorageId, canonicalIdentity: snapshotCanonicalIdentity, kind: "intake_submission", payload, metadata, capturedAt: session.createdAt });
  await Promise.all(session.intakeBlocks.map((block) => resolveEvidence({ sourceStorageId, snapshotStorageId, canonicalIdentity: manualEvidenceIdentity(snapshotCanonicalIdentity, block), content: block.content, url: null, metadata: { ...manualCompatibilityMetadata(projectId, block.id), label: block.label }, capturedAt: block.createdAt })));
}

async function writeWebsiteSource(input: CanonicalProvenanceInput): Promise<void> {
  const { projectId, session, website, websiteKnowledge } = input;
  if (!websiteKnowledge) return;
  const sourceCanonicalIdentity = sourceIdentity(projectId, "website");
  const payload = websiteSnapshotPayload(websiteKnowledge);
  const snapshotCanonicalIdentity = sourceSnapshotIdentity(projectId, "website", payload);
  const capturedAt = websiteKnowledge.imported_at ?? session.createdAt;
  const metadata = websiteCompatibilityMetadata(projectId, websiteKnowledge);
  const sourceStorageId = await resolveSource({ projectId, kind: "website", canonicalIdentity: sourceCanonicalIdentity, url: websiteKnowledge.resolved_url ?? websiteKnowledge.requested_url ?? website, metadata, createdAt: capturedAt });
  const snapshotStorageId = await resolveSnapshot({ sourceStorageId, canonicalIdentity: snapshotCanonicalIdentity, kind: "website_import", payload, metadata, capturedAt });
  await Promise.all(websiteKnowledge.knowledge.facts.flatMap((fact) => fact.evidence.map((evidence) => resolveEvidence({ sourceStorageId, snapshotStorageId, canonicalIdentity: websiteEvidenceIdentity(snapshotCanonicalIdentity, fact, evidence), content: evidence.excerpt, url: evidence.url, metadata: { ...metadata, category: fact.category, title: fact.title, value: fact.value, confidence: fact.confidence }, capturedAt }))));
}

export async function writeCanonicalProvenanceShadow(input: CanonicalProvenanceInput): Promise<void> {
  // Ordered resolution lets a retry safely complete a partially failed prior write.
  await writeManualSource(input);
  await writeWebsiteSource(input);
}
