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
  document_version: 1;
  current_crawl_attempt_id: string | null;
  imported_at: string | null;
  requested_url: string | null;
  resolved_url: string | null;
  pages: WebsiteKnowledgePage[];
  warnings: string[];
  knowledge: StructuredWebsiteKnowledge;
};
