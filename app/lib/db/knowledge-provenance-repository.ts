import "server-only";

import type { KnowledgeItemKind, KnowledgeProvenanceReadModel } from "@/app/lib/ai-engine/provenance/knowledgeProvenanceReadModel";
import { buildKnowledgeProvenanceReadModel } from "@/app/lib/ai-engine/provenance/knowledgeProvenanceReadModel";
import { getAiBuilderProject } from "./ai-builder-repository";
import { getSql } from "./client";

type DatabaseRow = Record<string, unknown>;

export type KnowledgeReviewHistoryEntry = {
  reviewIdentity: string;
  action: "approve" | "correction" | "archive" | "restore" | "reject";
  actor: Record<string, unknown>;
  metadata: Record<string, unknown>;
  reviewedAt: string;
};

export type CanonicalKnowledgeProvenanceDetail = {
  claimIdentity: string | null;
  sourceIdentity: string | null;
  snapshotIdentity: string | null;
  evidenceIdentities: string[];
  reviewHistory: KnowledgeReviewHistoryEntry[];
  currentTrustedRevision: number | null;
  currentTrustedLifecycle: "active" | "archived" | "rejected" | null;
};

export type KnowledgeProvenanceDetail = {
  item: KnowledgeProvenanceReadModel;
  canonical: CanonicalKnowledgeProvenanceDetail;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function iso(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

export async function getKnowledgeProvenanceDetail(input: {
  projectId: string;
  itemKind: KnowledgeItemKind;
  itemId: string;
}): Promise<KnowledgeProvenanceDetail | null> {
  const project = await getAiBuilderProject(input.projectId);
  if (!project) return null;

  const item = buildKnowledgeProvenanceReadModel({
    session: project.session,
    websiteKnowledge: project.websiteKnowledge,
    itemKind: input.itemKind,
    itemId: input.itemId,
  });
  if (!item) return null;

  const sql = getSql();
  const legacyMetadataKey = input.itemKind === "context_entry"
    ? "legacyContextEntryId"
    : "legacyFaqEntryId";

  const claimRows = await sql`
    SELECT
      claim.id,
      claim.claim_identity,
      snapshot.snapshot_identity,
      source.canonical_identity AS source_identity
    FROM ai_builder_canonical_candidate_claims claim
    LEFT JOIN ai_builder_canonical_source_snapshots snapshot
      ON snapshot.id = claim.source_snapshot_id
    LEFT JOIN ai_builder_canonical_sources source
      ON source.id = snapshot.source_id
    WHERE claim.project_id = ${input.projectId}
      AND claim.metadata ->> ${legacyMetadataKey} = ${input.itemId}
    ORDER BY claim.updated_at DESC, claim.id DESC
    LIMIT 1
  ` as DatabaseRow[];

  const claim = claimRows[0];
  if (!claim) {
    return {
      item,
      canonical: {
        claimIdentity: null,
        sourceIdentity: null,
        snapshotIdentity: null,
        evidenceIdentities: [],
        reviewHistory: [],
        currentTrustedRevision: null,
        currentTrustedLifecycle: null,
      },
    };
  }

  const candidateClaimId = String(claim.id);
  const [evidenceRows, reviewRows, trustedRows] = await Promise.all([
    sql`
      SELECT evidence.evidence_identity
      FROM ai_builder_canonical_candidate_claim_evidence link
      INNER JOIN ai_builder_canonical_evidence evidence
        ON evidence.id = link.evidence_id
      WHERE link.candidate_claim_id = ${candidateClaimId}
      ORDER BY evidence.evidence_identity
    `,
    sql`
      SELECT review_identity, action, actor, metadata, reviewed_at
      FROM ai_builder_canonical_claim_reviews
      WHERE project_id = ${input.projectId}
        AND candidate_claim_id = ${candidateClaimId}
      ORDER BY reviewed_at ASC, created_at ASC, id ASC
    `,
    sql`
      SELECT revision, lifecycle
      FROM ai_builder_canonical_trusted_knowledge
      WHERE project_id = ${input.projectId}
        AND legacy_kind = ${input.itemKind}
        AND legacy_entry_id = ${input.itemId}
      ORDER BY revision DESC, created_at DESC
      LIMIT 1
    `,
  ]) as [DatabaseRow[], DatabaseRow[], DatabaseRow[]];

  const trusted = trustedRows[0];
  const lifecycle = trusted?.lifecycle;

  return {
    item,
    canonical: {
      claimIdentity: String(claim.claim_identity),
      sourceIdentity: claim.source_identity ? String(claim.source_identity) : null,
      snapshotIdentity: claim.snapshot_identity ? String(claim.snapshot_identity) : null,
      evidenceIdentities: evidenceRows.map((row) => String(row.evidence_identity)),
      reviewHistory: reviewRows.map((row) => ({
        reviewIdentity: String(row.review_identity),
        action: String(row.action) as KnowledgeReviewHistoryEntry["action"],
        actor: record(row.actor),
        metadata: record(row.metadata),
        reviewedAt: iso(row.reviewed_at),
      })),
      currentTrustedRevision:
        typeof trusted?.revision === "number" ? trusted.revision : trusted?.revision ? Number(trusted.revision) : null,
      currentTrustedLifecycle:
        lifecycle === "active" || lifecycle === "archived" || lifecycle === "rejected"
          ? lifecycle
          : null,
    },
  };
}
