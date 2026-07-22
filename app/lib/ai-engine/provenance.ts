import type { BusinessContextEntry, GeneratedFaqEntry } from "./contracts";

export const AI_BUILDER_PROVENANCE_CLASSIFICATIONS = [
  "manual", "website", "ai_generated", "user_corrected",
] as const;

export type AiBuilderProvenanceClassification =
  (typeof AI_BUILDER_PROVENANCE_CLASSIFICATIONS)[number];

type ProvenanceMetadata = {
  provenanceClassification?: AiBuilderProvenanceClassification;
  predecessorProvenanceClassification?: AiBuilderProvenanceClassification;
  originalProvenanceClassification?: AiBuilderProvenanceClassification;
  upstreamSourceEntryIds?: string[];
  mixedSourceProvenance?: boolean;
  userEdited?: boolean;
  generated?: boolean;
};

export function isAiBuilderProvenanceClassification(value: unknown): value is AiBuilderProvenanceClassification {
  return typeof value === "string" && (AI_BUILDER_PROVENANCE_CLASSIFICATIONS as readonly string[]).includes(value);
}

function metadata(value: unknown): ProvenanceMetadata {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ProvenanceMetadata : {};
}

/**
 * The sole compatibility classifier. It deliberately uses persisted source
 * structure, never a UI label or a non-empty URL. A website source must be the
 * durable website-review shape produced from a crawl snapshot.
 */
export function classifyContextStructuralProvenance(entry: Pick<BusinessContextEntry, "source" | "metadata">): Exclude<AiBuilderProvenanceClassification, "user_corrected"> {
  if (entry.source?.sourceType === "website" && entry.source.intakeBlockId === "website_knowledge" && Boolean(entry.source.sourceUrl) && Boolean(entry.source.excerpt)) return "website";
  if (metadata(entry.metadata).generated || entry.source?.sourceType === "generated_qa") return "ai_generated";
  if (entry.source?.sourceType === "manual_intake" && !metadata(entry.metadata).generated) return "manual";
  return "ai_generated";
}

export function classifyContextProvenance(entry: Pick<BusinessContextEntry, "source" | "metadata" | "status">): AiBuilderProvenanceClassification {
  const saved = metadata(entry.metadata).provenanceClassification;
  if (isAiBuilderProvenanceClassification(saved)) return saved;
  if (entry.status === "corrected" || entry.source?.sourceType === "user_edit" || metadata(entry.metadata).userEdited) return "user_corrected";
  return classifyContextStructuralProvenance(entry);
}

export function classifyFaqStructuralProvenance(entry: Pick<GeneratedFaqEntry, "sourceEntryIds" | "question" | "answer">, contextEntries: readonly BusinessContextEntry[]): Exclude<AiBuilderProvenanceClassification, "user_corrected"> {
  const sources = entry.sourceEntryIds.map((id) => contextEntries.find((item) => item.id === id)).filter((item): item is BusinessContextEntry => Boolean(item));
  if (sources.length === 1 && entry.sourceEntryIds.length === 1 && classifyContextStructuralProvenance(sources[0]) === "website" && sources[0].title === entry.question && sources[0].content === entry.answer) return "website";
  return "ai_generated";
}

export function classifyFaqProvenance(entry: Pick<GeneratedFaqEntry, "sourceEntryIds" | "metadata" | "status" | "question" | "answer">, contextEntries: readonly BusinessContextEntry[]): AiBuilderProvenanceClassification {
  const saved = metadata(entry.metadata).provenanceClassification;
  if (isAiBuilderProvenanceClassification(saved)) return saved;
  if (entry.status === "corrected" || metadata(entry.metadata).userEdited) return "user_corrected";
  // A FAQ is website only for the one-claim direct extraction shape. All other
  // FAQ authoring is synthesis, including mixed website/manual inputs.
  return classifyFaqStructuralProvenance(entry, contextEntries);
}

function normalizedMetadata(existing: unknown, classification: AiBuilderProvenanceClassification, upstreamSourceEntryIds?: string[]): ProvenanceMetadata {
  const prior = metadata(existing);
  const result: ProvenanceMetadata = { ...prior, provenanceClassification: classification };
  if (upstreamSourceEntryIds?.length) result.upstreamSourceEntryIds = Array.from(new Set(upstreamSourceEntryIds));
  return result;
}

export function normalizeContextProvenance(entry: BusinessContextEntry): BusinessContextEntry {
  const classification = classifyContextProvenance(entry);
  return { ...entry, metadata: { ...(entry.metadata ?? {}), ...normalizedMetadata(entry.metadata, classification) } };
}

export function normalizeFaqProvenance(entry: GeneratedFaqEntry, contextEntries: readonly BusinessContextEntry[]): GeneratedFaqEntry {
  const classification = classifyFaqProvenance(entry, contextEntries);
  const sourceClassifications = entry.sourceEntryIds.map((id) => contextEntries.find((item) => item.id === id)).filter((item): item is BusinessContextEntry => Boolean(item)).map(classifyContextProvenance);
  return { ...entry, metadata: { ...(entry.metadata ?? {}), ...normalizedMetadata(entry.metadata, classification, entry.sourceEntryIds), mixedSourceProvenance: new Set(sourceClassifications).size > 1 } };
}

export function correctedProvenanceMetadata(previous: unknown, derivedPredecessor: AiBuilderProvenanceClassification): ProvenanceMetadata {
  const prior = metadata(previous);
  // The current classification can already be user_corrected (or stale); only
  // the structural classifier describes the provenance immediately before this edit.
  const predecessor = derivedPredecessor === "user_corrected" ? "ai_generated" : derivedPredecessor;
  const original = isAiBuilderProvenanceClassification(prior.originalProvenanceClassification) && prior.originalProvenanceClassification !== "user_corrected"
    ? prior.originalProvenanceClassification
    : isAiBuilderProvenanceClassification(prior.predecessorProvenanceClassification) && prior.predecessorProvenanceClassification !== "user_corrected"
      ? prior.predecessorProvenanceClassification
      : predecessor;
  return { ...prior, provenanceClassification: "user_corrected", predecessorProvenanceClassification: predecessor, originalProvenanceClassification: original };
}
