export const WEBSITE_KNOWLEDGE_CATEGORIES = [
  "business_identity", "industry", "product", "service", "customer", "pricing",
  "policy", "process", "faq", "differentiator", "guarantee", "location",
  "contact", "other",
] as const;

export const WEBSITE_KNOWLEDGE_CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;

export const WEBSITE_KNOWLEDGE_COVERAGE_FIELDS = [
  "businessIdentity", "offers", "customers", "pricing", "policies", "processes",
  "faq", "contact", "overall",
] as const;

export type WebsiteKnowledgeEvidence = { url: string; excerpt: string };

export type WebsiteKnowledgeFact = {
  category: (typeof WEBSITE_KNOWLEDGE_CATEGORIES)[number];
  title: string;
  value: string;
  confidence: (typeof WEBSITE_KNOWLEDGE_CONFIDENCE_LEVELS)[number];
  evidence: WebsiteKnowledgeEvidence[];
};

export type WebsiteKnowledgeCoverage = Record<
  (typeof WEBSITE_KNOWLEDGE_COVERAGE_FIELDS)[number],
  number
>;

export type StructuredWebsiteKnowledge = {
  facts: WebsiteKnowledgeFact[];
  coverage: WebsiteKnowledgeCoverage;
  unresolvedQuestions: string[];
};

export type WebsiteKnowledgePage = { url: string; title: string; pageType: string };

export type PersistedWebsiteKnowledge = {
  schema_version: 1;
  document_version: number;
  current_crawl_attempt_id: string | null;
  imported_at: string | null;
  requested_url: string | null;
  resolved_url: string | null;
  pages: WebsiteKnowledgePage[];
  warnings: string[];
  knowledge: StructuredWebsiteKnowledge;
};

import type {
  AiBuilderSession,
  BusinessContextCategory,
  BusinessContextEntry,
  BusinessContextStatus,
  ContextConfidence,
} from "@/app/lib/ai-engine/contracts";

const WEBSITE_FACT_CATEGORIES: Record<
  WebsiteKnowledgeFact["category"],
  BusinessContextCategory
> = {
  business_identity: "business_profile",
  industry: "business_profile",
  product: "service",
  service: "service",
  customer: "audience",
  pricing: "pricing",
  policy: "policy",
  process: "process",
  faq: "faq",
  differentiator: "differentiator",
  guarantee: "policy",
  location: "business_profile",
  contact: "business_profile",
  other: "business_profile",
};

function normalizeFactIdentityValue(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function stableWebsiteFactId(fact: WebsiteKnowledgeFact): string {
  const evidenceUrls = fact.evidence
    .map((evidence) => normalizeFactIdentityValue(evidence.url))
    .filter(Boolean)
    .sort()
    .join("|");
  const identity = [fact.category, fact.title, fact.value, evidenceUrls]
    .map(normalizeFactIdentityValue)
    .join("\u0000");

  let hash = 2166136261;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `website_fact_${(hash >>> 0).toString(16)}`;
}

function confidenceScore(confidence: ContextConfidence): number {
  return confidence === "high" ? 0.9 : confidence === "medium" ? 0.7 : 0.5;
}

function isLegacyWebsiteEntry(entry: BusinessContextEntry): boolean {
  return (
    entry.source.sourceType === "website" ||
    entry.source.intakeBlockId.startsWith("website_")
  );
}

type ApplyStructuredWebsiteKnowledgeOptions = {
  defaultStatus: BusinessContextStatus;
};

/**
 * Replaces intake-model entries derived from flattened website fields with the
 * durable facts saved by the crawler. Existing structured entries are retained
 * verbatim so their reviewed status and user edits survive reopening a project.
 */
export function applyStructuredWebsiteKnowledge(
  session: AiBuilderSession,
  knowledge: StructuredWebsiteKnowledge | null | undefined,
  options: ApplyStructuredWebsiteKnowledgeOptions,
): AiBuilderSession {
  if (!knowledge?.facts.length) return session;

  const existingEntries = new Map(
    session.contextEntries.map((entry) => [entry.id, entry]),
  );
  const structuredIds = new Set(knowledge.facts.map(stableWebsiteFactId));
  const retainedEntries = session.contextEntries.filter(
    (entry) => !isLegacyWebsiteEntry(entry) || structuredIds.has(entry.id),
  );
  const createdAt = session.createdAt;

  const structuredEntries = knowledge.facts.flatMap((fact) => {
    const id = stableWebsiteFactId(fact);
    if (existingEntries.has(id)) return [];

    const evidence = fact.evidence[0];
    return [{
      id,
      sessionId: session.id,
      category: WEBSITE_FACT_CATEGORIES[fact.category],
      title: fact.title,
      content: fact.value,
      confidence: fact.confidence,
      confidenceScore: confidenceScore(fact.confidence),
      status: options.defaultStatus,
      source: {
        intakeBlockId: "website_knowledge",
        excerpt: evidence?.excerpt ?? fact.value,
        sourceType: "website" as const,
        sourceUrl: evidence?.url ?? null,
      },
      metadata: {
        generated: true,
        userEdited: false,
        conflictingEntryIds: [],
        tags: [fact.category],
      },
      createdAt,
      updatedAt: createdAt,
    }];
  });

  const contextEntries = retainedEntries.concat(structuredEntries);
  const byCategory: AiBuilderSession["contextCounts"]["byCategory"] = {};
  contextEntries.forEach((entry) => {
    byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1;
  });

  return {
    ...session,
    contextEntries,
    contextCounts: {
      total: contextEntries.length,
      approved: contextEntries.filter(
        (entry) => entry.status === "approved" || entry.status === "corrected",
      ).length,
      proposed: contextEntries.filter((entry) => entry.status === "proposed").length,
      archived:
        contextEntries.filter((entry) => entry.status === "archived").length +
        session.faqEntries.filter((entry) => entry.status === "archived").length,
      byCategory,
    },
  };
}
