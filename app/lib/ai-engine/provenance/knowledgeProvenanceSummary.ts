import type { AiBuilderSession } from "../contracts";
import type { PersistedWebsiteKnowledge } from "../knowledge/websiteKnowledge";
import type { AiBuilderProvenanceClassification } from "../provenance";
import {
  buildKnowledgeProvenanceReadModel,
  type KnowledgeItemKind,
  type ProvenanceAvailability,
} from "./knowledgeProvenanceReadModel";

export type KnowledgeProvenanceSummary = {
  itemKind: KnowledgeItemKind;
  itemId: string;
  classification: AiBuilderProvenanceClassification;
  originalClassification: AiBuilderProvenanceClassification | null;
  confidence: "high" | "medium" | "low";
  confidenceScore: number;
  availability: ProvenanceAvailability;
  evidenceCount: number;
  relatedEntryCount: number;
  hasExactProvenance: boolean;
};

export function buildKnowledgeProvenanceSummaries(input: {
  session: AiBuilderSession;
  websiteKnowledge: PersistedWebsiteKnowledge | null;
}) {
  const build = (itemKind: KnowledgeItemKind, itemId: string): KnowledgeProvenanceSummary | null => {
    const detail = buildKnowledgeProvenanceReadModel({ ...input, itemKind, itemId });
    return detail ? {
      itemKind,
      itemId,
      classification: detail.classification,
      originalClassification: detail.originalClassification,
      confidence: detail.confidence,
      confidenceScore: detail.confidenceScore,
      availability: detail.availability,
      evidenceCount: detail.evidence.length,
      relatedEntryCount: detail.relatedEntryIds.length,
      hasExactProvenance: detail.availability === "exact",
    } : null;
  };

  return {
    contextEntries: Object.fromEntries(input.session.contextEntries.flatMap((entry) => {
      const value = build("context_entry", entry.id);
      return value ? [[entry.id, value]] : [];
    })),
    faqEntries: Object.fromEntries(input.session.faqEntries.flatMap((entry) => {
      const value = build("faq", entry.id);
      return value ? [[entry.id, value]] : [];
    })),
  };
}
