import type { AiBuilderSession } from "../contracts";
import type { WebsiteSourceBlockRecord, WebsiteSourceDocumentRecord } from "../crawler/websiteSourceRecords";
import type { WebsiteKnowledgeCoverage, WebsiteKnowledgeFact, WebsiteKnowledgePage } from "../knowledge/websiteKnowledge";
export type KnowledgeProvenance = "owner" | "website";
export type DeterministicSourceType = "owner" | "html" | "rendered_html" | "pdf" | "structured_data";
export type ClassifiedPageType = "home" | "about" | "products" | "services" | "pricing" | "faq" | "policies" | "contact" | "locations" | "industries" | "use_cases" | "case_studies" | "testimonials" | "integrations" | "security" | "compliance" | "technical" | "onboarding" | "support" | "partnerships" | "certifications" | "other";
export type DeterministicPage = WebsiteKnowledgePage & {
    text?: string;
    headings?: string[];
    structuredMetadata?: Record<string, unknown>;
    crawlAttemptId?: string;
};
export type OwnerKnowledge = {
    businessName?: string;
    industry?: string;
    productsServices?: string;
    idealCustomers?: string;
    additionalKnowledge?: string;
    policiesOperations?: string;
    caseStudiesTestimonials?: string;
    tone?: string;
};
export type DeterministicEngineInput = {
    pages?: readonly DeterministicPage[];
    sourceDocuments?: readonly WebsiteSourceDocumentRecord[];
    sourceBlocks?: readonly WebsiteSourceBlockRecord[];
    owner?: OwnerKnowledge;
    now?: string;
    sessionId?: string;
};
export type NormalizedEvidence = {
    url: string;
    excerpt: string;
    sourceDocumentId?: string;
    sourceBlockId?: string;
    crawlAttemptId?: string;
    heading?: string;
    pageTitle?: string;
    pageType: ClassifiedPageType;
    sourceType: DeterministicSourceType;
    provenance: KnowledgeProvenance;
    structured: boolean;
};
export type NormalizedSourceBlock = {
    id: string;
    text: string;
    type: WebsiteSourceBlockRecord["type"] | "owner" | "page_text";
    evidence: NormalizedEvidence;
    pageType: ClassifiedPageType;
    heading?: string;
    previousBlockId?: string;
    nextBlockId?: string;
};
export type DeterministicFact = Omit<WebsiteKnowledgeFact, "evidence"> & {
    id: string;
    topicKey: string;
    confidenceScore: number;
    provenance: KnowledgeProvenance;
    evidence: NormalizedEvidence[];
    explicit: boolean;
};
export type DuplicateGroup = {
    id: string;
    topicKey: string;
    factIds: string[];
    mergedFactId: string;
};
export type MaterialConflict = {
    id: string;
    topicKey: string;
    factIds: string[];
    preferredFactId: string;
    websiteFactIds: string[];
    sessionEntryIds: string[];
    reason: string;
};
export type DeterministicFaq = {
    id: string;
    question: string;
    answer: string;
    confidence: WebsiteKnowledgeFact["confidence"];
    confidenceScore: number;
    evidence: NormalizedEvidence[];
    sourceFactIds: string[];
};
export type BusinessConcept = {
    id: string;
    canonicalTopicIdentity: string;
    category: WebsiteKnowledgeFact["category"];
    displayName: string;
    supportingFactIds: string[];
    supportingEvidence: NormalizedEvidence[];
    overallConfidence: WebsiteKnowledgeFact["confidence"];
    confidenceScore: number;
    supportingSourceCount: number;
    firstSeenSource: NormalizedEvidence;
    lastSeenSource: NormalizedEvidence;
    ownerKnowledgeContributes: boolean;
    websiteKnowledgeContributes: boolean;
};
export type MissingInformationSignal = {
    id: string;
    topic: string;
    reason: string;
    suggestedQuestion: string;
};
export type DeterministicEngineResult = {
    facts: DeterministicFact[];
    concepts: BusinessConcept[];
    categories: WebsiteKnowledgeFact["category"][];
    duplicateGroups: DuplicateGroup[];
    conflicts: MaterialConflict[];
    coverage: WebsiteKnowledgeCoverage;
    missingInformation: MissingInformationSignal[];
    faqs: DeterministicFaq[];
    normalizedBlocks: NormalizedSourceBlock[];
    websiteKnowledge: {
        facts: WebsiteKnowledgeFact[];
        coverage: WebsiteKnowledgeCoverage;
        unresolvedQuestions: string[];
    };
    session?: AiBuilderSession;
    executionTimeMs: number;
};
