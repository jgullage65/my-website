import { createHash } from "node:crypto";

import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
import type { PersistedWebsiteKnowledge } from "@/app/lib/ai-engine/knowledge/websiteKnowledge";

export type CanonicalSourceKind = "manual" | "website" | "conversation";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function canonicalJson(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(value: JsonValue): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function canonicalId(...parts: string[]): string {
  return `canonical:${parts.join(":")}`;
}

export function sourceIdentity(projectId: string, kind: Exclude<CanonicalSourceKind, "conversation">): string;
export function sourceIdentity(projectId: string, kind: "conversation", threadId: string, messageId: string): string;
/**
 * Conversation observations are immutable chat-message sources, rather than a
 * project-wide source. This prevents evidence from separate messages sharing
 * a source while retaining deterministic replay for one persisted message.
 */
export function sourceIdentity(projectId: string, kind: CanonicalSourceKind, threadId?: string, messageId?: string): string {
  if (kind === "conversation") {
    if (!threadId || !messageId) throw new Error("conversation_source_identity_requires_thread_and_message");
    return canonicalId("source", projectId, kind, threadId, messageId);
  }
  return canonicalId("source", projectId, kind);
}

export function sourceSnapshotIdentity(projectId: string, kind: CanonicalSourceKind, payload: JsonValue): string {
  return canonicalId("snapshot", projectId, kind, fingerprint(payload));
}

export function manualSnapshotPayload(blocks: AiBuilderSession["intakeBlocks"]): JsonValue {
  return blocks.map((block) => ({ id: block.id, label: block.label, content: block.content })).sort((left, right) => left.id.localeCompare(right.id));
}

export function websiteSnapshotPayload(knowledge: PersistedWebsiteKnowledge): JsonValue {
  return {
    ...knowledge,
    pages: knowledge.pages.slice().sort((left, right) => left.url.localeCompare(right.url)),
    warnings: knowledge.warnings.slice().sort(),
    knowledge: {
      ...knowledge.knowledge,
      facts: knowledge.knowledge.facts.map((fact) => ({
        ...fact,
        evidence: fact.evidence.slice().sort((left, right) => `${left.url}\u0000${left.excerpt}`.localeCompare(`${right.url}\u0000${right.excerpt}`)),
      })).sort((left, right) => `${left.category}\u0000${left.title}\u0000${left.value}\u0000${left.confidence}`.localeCompare(`${right.category}\u0000${right.title}\u0000${right.value}\u0000${right.confidence}`)),
      unresolvedQuestions: knowledge.knowledge.unresolvedQuestions.slice().sort(),
    },
  };
}

export function conversationSnapshotPayload(input: { projectId: string; threadId: string; messageId: string; role: string; content: string }): JsonValue {
  return { projectId: input.projectId, threadId: input.threadId, messageId: input.messageId, role: input.role, content: input.content };
}

export function conversationEvidenceIdentity(snapshotId: string, statement: string): string {
  return canonicalId("evidence", snapshotId, fingerprint({ statement }));
}

export function manualEvidenceIdentity(snapshotId: string, block: AiBuilderSession["intakeBlocks"][number]): string {
  return canonicalId("evidence", snapshotId, fingerprint({ legacyIntakeBlockId: block.id, label: block.label, content: block.content }));
}

export function websiteEvidenceIdentity(snapshotId: string, fact: PersistedWebsiteKnowledge["knowledge"]["facts"][number], evidence: PersistedWebsiteKnowledge["knowledge"]["facts"][number]["evidence"][number]): string {
  return canonicalId("evidence", snapshotId, fingerprint({ category: fact.category, title: fact.title, value: fact.value, confidence: fact.confidence, url: evidence.url, excerpt: evidence.excerpt }));
}

export function manualCompatibilityMetadata(projectId: string, legacyIntakeBlockId?: string): { legacyProjectId: string; legacyIntakeBlockId?: string } {
  return legacyIntakeBlockId ? { legacyProjectId: projectId, legacyIntakeBlockId } : { legacyProjectId: projectId };
}

export function websiteCompatibilityMetadata(projectId: string, knowledge: PersistedWebsiteKnowledge): { legacyProjectId: string; legacyCrawlAttemptId: string | null; legacyWebsiteKnowledgeDocumentVersion: number } {
  return { legacyProjectId: projectId, legacyCrawlAttemptId: knowledge.current_crawl_attempt_id, legacyWebsiteKnowledgeDocumentVersion: knowledge.document_version };
}


export function candidateClaimIdentity(snapshotId: string, claimType: string, claimKey: string, normalizedContent: string): string {
  return canonicalId("candidate_claim", snapshotId, claimType, fingerprint({ claimKey, normalizedContent }));
}


export type CanonicalClaimReviewAction = "approve" | "correction" | "archive" | "restore" | "reject";

/** A review event is idempotent for one legacy review mutation, never a mutable state key. */
export function claimReviewIdentity(projectId: string, legacyKind: "context_entry" | "faq", legacyEntryId: string, candidateClaimIdentity: string, action: CanonicalClaimReviewAction, reviewedAt: string): string {
  return canonicalId("claim_review", projectId, legacyKind, legacyEntryId, action, fingerprint({ candidateClaimIdentity, reviewedAt }));
}

/** Trusted Knowledge revisions are immutable and are anchored to their governing review. */
export function trustedKnowledgeIdentity(projectId: string, legacyKind: "context_entry" | "faq", legacyEntryId: string, reviewIdentity: string): string {
  return canonicalId("trusted_knowledge", projectId, legacyKind, legacyEntryId, fingerprint({ reviewIdentity }));
}
