import type {
  AiBuilderProvenanceClassification,
} from "../provenance";
import {
  classifyContextProvenance,
  classifyFaqProvenance,
} from "../provenance";
import type {
  AiBuilderSession,
  BusinessContextEntry,
  GeneratedFaqEntry,
} from "../contracts";
import type {
  PersistedWebsiteKnowledge,
  WebsiteKnowledgeEvidence,
  WebsiteKnowledgeFact,
} from "../knowledge/websiteKnowledge";
import {
  websiteFactIdentity,
  websiteFactReviewIdentity,
} from "../knowledge/websiteKnowledge";

export type KnowledgeItemKind = "context_entry" | "faq";
export type ProvenanceAvailability = "exact" | "partial" | "classification_only";

export type KnowledgeEvidenceReadModel = {
  url: string | null;
  pageTitle: string | null;
  excerpt: string;
  sourceDocumentId: string | null;
  sourceBlockId: string | null;
  crawlAttemptId: string | null;
  sourceCoordinates: WebsiteKnowledgeEvidence["sourceCoordinates"] | null;
};

export type KnowledgeProvenanceReadModel = {
  projectId: string;
  itemKind: KnowledgeItemKind;
  itemId: string;
  classification: AiBuilderProvenanceClassification;
  originalClassification: AiBuilderProvenanceClassification | null;
  predecessorClassification: AiBuilderProvenanceClassification | null;
  confidence: "high" | "medium" | "low";
  confidenceScore: number;
  availability: ProvenanceAvailability;
  evidence: KnowledgeEvidenceReadModel[];
  relatedEntryIds: string[];
  importedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function comparableUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/g, "");
    return url.toString();
  } catch {
    return value;
  }
}

function evidenceReadModel(
  evidence: WebsiteKnowledgeEvidence,
  websiteKnowledge: PersistedWebsiteKnowledge | null,
): KnowledgeEvidenceReadModel {
  const document = evidence.sourceDocumentId
    ? websiteKnowledge?.source_documents?.find((item) => item.id === evidence.sourceDocumentId)
    : websiteKnowledge?.source_documents?.find((item) =>
        [item.canonicalUrl, item.actualFetchedUrl]
          .filter((value): value is string => Boolean(value))
          .some((value) => comparableUrl(value) === comparableUrl(evidence.url)),
      );

  const block = evidence.sourceBlockId
    ? websiteKnowledge?.source_blocks?.find((item) => item.id === evidence.sourceBlockId)
    : undefined;

  const page = websiteKnowledge?.pages.find((item) =>
    (document && item.sourceDocumentId === document.id) ||
    comparableUrl(item.url) === comparableUrl(evidence.url),
  );

  return {
    url: (document?.canonicalUrl ?? document?.actualFetchedUrl ?? evidence.url) || null,
    pageTitle: page?.title?.trim() || null,
    excerpt: block?.normalizedText?.trim() || evidence.excerpt,
    sourceDocumentId: evidence.sourceDocumentId ?? document?.id ?? null,
    sourceBlockId: evidence.sourceBlockId ?? block?.id ?? null,
    crawlAttemptId: evidence.crawlAttemptId ?? document?.crawlAttemptId ?? null,
    sourceCoordinates: evidence.sourceCoordinates ?? block?.coordinates ?? null,
  };
}

function availability(evidence: readonly KnowledgeEvidenceReadModel[]): ProvenanceAvailability {
  if (!evidence.length) return "classification_only";
  return evidence.some((item) => item.sourceDocumentId || item.sourceBlockId || item.crawlAttemptId || item.sourceCoordinates)
    ? "exact"
    : "partial";
}

function matchingWebsiteFact(
  projectId: string,
  entry: BusinessContextEntry,
  websiteKnowledge: PersistedWebsiteKnowledge | null,
): WebsiteKnowledgeFact | null {
  if (!websiteKnowledge) return null;
  return websiteKnowledge.knowledge.facts.find((fact) => {
    const ids = [websiteFactReviewIdentity(projectId, fact), websiteFactIdentity(fact)];
    if (ids.includes(entry.id)) return true;
    return fact.title === entry.title && fact.value === entry.content;
  }) ?? null;
}

function metadataClassification(
  value: unknown,
  key: "originalProvenanceClassification" | "predecessorProvenanceClassification",
): AiBuilderProvenanceClassification | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = (value as Record<string, unknown>)[key];
  return candidate === "manual" || candidate === "website" || candidate === "ai_generated" || candidate === "user_corrected"
    ? candidate
    : null;
}

function contextReadModel(
  session: AiBuilderSession,
  entry: BusinessContextEntry,
  websiteKnowledge: PersistedWebsiteKnowledge | null,
): KnowledgeProvenanceReadModel {
  const fact = matchingWebsiteFact(session.id, entry, websiteKnowledge);
  const evidence = fact
    ? fact.evidence.map((item) => evidenceReadModel(item, websiteKnowledge))
    : entry.source.excerpt
      ? [{
          url: entry.source.sourceUrl ?? null,
          pageTitle: websiteKnowledge?.pages.find((page) => page.url === entry.source.sourceUrl)?.title ?? null,
          excerpt: entry.source.excerpt,
          sourceDocumentId: null,
          sourceBlockId: null,
          crawlAttemptId: null,
          sourceCoordinates: null,
        }]
      : [];

  return {
    projectId: session.id,
    itemKind: "context_entry",
    itemId: entry.id,
    classification: classifyContextProvenance(entry),
    originalClassification: metadataClassification(entry.metadata, "originalProvenanceClassification"),
    predecessorClassification: metadataClassification(entry.metadata, "predecessorProvenanceClassification"),
    confidence: entry.confidence,
    confidenceScore: entry.confidenceScore,
    availability: availability(evidence),
    evidence,
    relatedEntryIds: Array.from(new Set(entry.metadata.upstreamSourceEntryIds ?? [])),
    importedAt: websiteKnowledge?.imported_at ?? null,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

function faqReadModel(
  session: AiBuilderSession,
  entry: GeneratedFaqEntry,
  websiteKnowledge: PersistedWebsiteKnowledge | null,
): KnowledgeProvenanceReadModel {
  const supportingEntries = entry.sourceEntryIds
    .map((id) => session.contextEntries.find((item) => item.id === id))
    .filter((item): item is BusinessContextEntry => Boolean(item));
  const evidence = supportingEntries.flatMap((item) => contextReadModel(session, item, websiteKnowledge).evidence);
  const uniqueEvidence = Array.from(
    new Map(evidence.map((item) => [
      [item.url, item.excerpt, item.sourceDocumentId, item.sourceBlockId].join("\u0000"),
      item,
    ])).values(),
  );

  return {
    projectId: session.id,
    itemKind: "faq",
    itemId: entry.id,
    classification: classifyFaqProvenance(entry, session.contextEntries),
    originalClassification: metadataClassification(entry.metadata, "originalProvenanceClassification"),
    predecessorClassification: metadataClassification(entry.metadata, "predecessorProvenanceClassification"),
    confidence: entry.confidence,
    confidenceScore: entry.confidenceScore,
    availability: availability(uniqueEvidence),
    evidence: uniqueEvidence,
    relatedEntryIds: Array.from(new Set(entry.sourceEntryIds)),
    importedAt: websiteKnowledge?.imported_at ?? null,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

export function buildKnowledgeProvenanceReadModel(input: {
  session: AiBuilderSession;
  websiteKnowledge: PersistedWebsiteKnowledge | null;
  itemKind: KnowledgeItemKind;
  itemId: string;
}): KnowledgeProvenanceReadModel | null {
  if (input.itemKind === "context_entry") {
    const entry = input.session.contextEntries.find((item) => item.id === input.itemId);
    return entry ? contextReadModel(input.session, entry, input.websiteKnowledge) : null;
  }

  const entry = input.session.faqEntries.find((item) => item.id === input.itemId);
  return entry ? faqReadModel(input.session, entry, input.websiteKnowledge) : null;
}
