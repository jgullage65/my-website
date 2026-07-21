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
  BusinessContextStatus,
  ContextConfidence,
} from "../contracts";

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

/** Canonical restoration identity: category, title, value, and evidence URLs. */
export function websiteFactIdentityMaterial(fact: WebsiteKnowledgeFact): string {
  const evidenceUrls = fact.evidence
    .map((item) => normalizeFactIdentityValue(item.url))
    .filter(Boolean)
    .sort();
  return [fact.category, fact.title, fact.value, ...evidenceUrls]
    .map(normalizeFactIdentityValue)
    .join("\u0000");
}

/** Business Memory fingerprint: restoration identity plus every evidence excerpt. */
export function websiteFactFingerprint(fact: WebsiteKnowledgeFact): string {
  const evidence = fact.evidence
    .map((item) => `${item.url}\u0000${item.excerpt}`)
    .map(normalizeFactIdentityValue)
    .filter(Boolean)
    .sort();
  return [fact.category, fact.title, fact.value, ...evidence]
    .map(normalizeFactIdentityValue)
    .join("\u0000");
}

export function websiteFactIdentity(fact: WebsiteKnowledgeFact): string {
  const identity = websiteFactIdentityMaterial(fact);
  let hash = 2166136261;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `website_fact_${(hash >>> 0).toString(16)}`;
}

/** Stable FAQ identity derived from the same canonical website observation. */
export function websiteFaqIdentity(fact: WebsiteKnowledgeFact): string {
  return `website_faq_${websiteFactIdentity(fact).slice("website_fact_".length)}`;
}

function confidenceScore(confidence: ContextConfidence): number {
  return confidence === "high" ? 0.9 : confidence === "medium" ? 0.7 : 0.5;
}

type ApplyStructuredWebsiteKnowledgeOptions = {
  defaultStatus: BusinessContextStatus;
};

/**
 * Builds the durable website-review graph from crawler source data. Existing
 * records win verbatim, preserving every review decision and user correction.
 */
export function reconcileStructuredWebsiteKnowledge(
  session: AiBuilderSession,
  knowledge: StructuredWebsiteKnowledge | null | undefined,
  options: ApplyStructuredWebsiteKnowledgeOptions,
): AiBuilderSession {
  if (!knowledge?.facts.length) return session;

  const existingEntries = new Map(
    session.contextEntries.map((entry) => [entry.id, entry]),
  );
  const existingFaqEntries = new Map(
    session.faqEntries.map((entry) => [entry.id, entry]),
  );
  // Never remove a persisted website row here: an archived/removed legacy row
  // is a review decision, not a cue to recreate or discard state.
  const retainedEntries = session.contextEntries;
  const createdAt = session.createdAt;

  const structuredEntries = knowledge.facts.flatMap((fact) => {
    const id = websiteFactIdentity(fact);
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
        provenanceClassification: "website" as const,
      },
      createdAt,
      updatedAt: createdAt,
    }];
  });

  const contextEntries = retainedEntries.concat(structuredEntries);
  const structuredFaqEntries = knowledge.facts.flatMap((fact) => {
    if (fact.category !== "faq") return [];
    const id = websiteFaqIdentity(fact);
    if (existingFaqEntries.has(id)) return [];
    return [{
      id,
      sessionId: session.id,
      question: fact.title,
      answer: fact.value,
      confidence: fact.confidence,
      confidenceScore: confidenceScore(fact.confidence),
      // The matching website context row preserves the canonical evidence link.
      sourceEntryIds: [websiteFactIdentity(fact)],
      status: options.defaultStatus,
      metadata: { provenanceClassification: "website" as const, upstreamSourceEntryIds: [websiteFactIdentity(fact)], mixedSourceProvenance: false },
      createdAt,
      updatedAt: createdAt,
    }];
  });
  const faqEntries = session.faqEntries.concat(structuredFaqEntries);
  const byCategory: AiBuilderSession["contextCounts"]["byCategory"] = {};
  contextEntries.forEach((entry) => {
    byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1;
  });

  return {
    ...session,
    contextEntries,
    faqEntries,
    contextCounts: {
      total: contextEntries.length,
      approved: contextEntries.filter(
        (entry) => entry.status === "approved" || entry.status === "corrected",
      ).length,
      proposed: contextEntries.filter((entry) => entry.status === "proposed").length,
      archived:
        contextEntries.filter((entry) => entry.status === "archived").length +
        faqEntries.filter((entry) => entry.status === "archived").length,
      byCategory,
    },
  };
}

/** @deprecated Browser restoration must not create review records. Kept only for compatibility. */
export const applyStructuredWebsiteKnowledge = reconcileStructuredWebsiteKnowledge;
