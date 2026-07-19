import type { AssertionAuthority, BusinessAssertion, BusinessEntity, Confidence, EvidenceRecord, KnowledgeSourceOrigin, ReviewState } from "../business-memory/contracts";

export type KnowledgeSyncEvidenceReference = {
  id: string;
  sourceId: string;
  url: string | null;
  excerpt: string;
  crawlAttemptId: string | null;
};

export type KnowledgeSyncWorkflow = {
  reviewState: ReviewState;
  authority: AssertionAuthority;
  sourceOrigins: KnowledgeSourceOrigin[];
  crawlAttemptIds: string[];
  evidenceReferences: KnowledgeSyncEvidenceReference[];
};

export type KnowledgeSyncCurrentAssertion = Pick<BusinessAssertion, "id" | "entityId" | "value" | "confidence"> & KnowledgeSyncWorkflow;
export type KnowledgeSyncCrawledAssertion = {
  canonicalIdentity: string;
  entityCanonicalIdentity: string;
  category: string;
  title: string;
  value: string;
  confidence: Confidence["level"];
  evidence: Array<{ url: string; excerpt: string }>;
};

export type KnowledgeSyncEvidenceChanges = {
  added: Array<{ url: string; excerpt: string }>;
  removed: KnowledgeSyncEvidenceReference[];
};

export type KnowledgeSyncChangedAssertion = {
  canonicalIdentity: string;
  current: KnowledgeSyncCurrentAssertion;
  crawled: KnowledgeSyncCrawledAssertion;
  changes: {
    value: boolean;
    confidence: boolean;
    sourceUrls: boolean;
    evidenceExcerpts: boolean;
    evidence: KnowledgeSyncEvidenceChanges;
  };
};

export type KnowledgeSyncEntity = Pick<BusinessEntity, "id" | "type" | "name" | "aliases"> & {
  canonicalIdentity: string;
};

export type CrawlMetadataComparison = {
  current: { crawlAttemptId: string | null; importedAt: string | null; pageCount: number | null; warningCount: number | null };
  crawled: { crawlAttemptId: string | null; importedAt: string | null; pageCount: number | null; warningCount: number | null };
  changes: { crawlAttemptId: boolean; importedAt: boolean; pageCount: boolean; warningCount: boolean };
};

export type KnowledgeSyncResult = {
  synchronizationTimestamp: string;
  unchangedAssertions: Array<{ canonicalIdentity: string; current: KnowledgeSyncCurrentAssertion; crawled: KnowledgeSyncCrawledAssertion }>;
  newAssertions: KnowledgeSyncCrawledAssertion[];
  changedAssertions: KnowledgeSyncChangedAssertion[];
  removedAssertions: Array<{ canonicalIdentity: string; current: KnowledgeSyncCurrentAssertion }>;
  unchangedEntities: KnowledgeSyncEntity[];
  newEntities: KnowledgeSyncEntity[];
  changedEntities: Array<{ current: KnowledgeSyncEntity; crawled: KnowledgeSyncEntity }>;
  removedEntities: KnowledgeSyncEntity[];
  crawlMetadata: CrawlMetadataComparison;
};
