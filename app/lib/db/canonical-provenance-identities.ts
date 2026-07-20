import { createHash } from "node:crypto";

import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
import type { PersistedWebsiteKnowledge } from "@/app/lib/ai-engine/knowledge/websiteKnowledge";

export type CanonicalSourceKind = "manual" | "website";

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

export function sourceIdentity(projectId: string, kind: CanonicalSourceKind): string {
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
