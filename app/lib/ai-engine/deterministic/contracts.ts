import type { WebsiteKnowledgeFact, WebsiteKnowledgeCoverage } from "../knowledge/websiteKnowledge";

export type DeterministicSourceType = "website" | "owner";
export type DeterministicSource = {
  id: string; type: DeterministicSourceType; url?: string; title: string;
  pageType: string; heading?: string; text: string; sourceDocumentId?: string;
  sourceBlockId?: string; crawlAttemptId?: string;
};

export type DeterministicConflict = {
  id: string; topic: string; preferredFact: WebsiteKnowledgeFact;
  conflictingFacts: WebsiteKnowledgeFact[]; reason: string;
};

export type DeterministicBrain = {
  facts: WebsiteKnowledgeFact[];
  coverage: WebsiteKnowledgeCoverage;
  conflicts: DeterministicConflict[];
  missingCategories: string[];
  unresolvedQuestions: string[];
};

export type OwnerKnowledgeInput = {
  businessName?: string; industry?: string; productsServices?: string;
  idealCustomers?: string; policiesOperations?: string;
  successStoriesCaseStudies?: string; additionalKnowledge?: string;
};
