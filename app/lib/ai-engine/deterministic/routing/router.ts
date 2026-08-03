import type { DeterministicFact } from "../contracts";
import { keyText, stableId } from "../util";
import { primaryBucketForCategory } from "./buckets";
import type { KnowledgeObservation } from "./contracts";

function cloneFactEvidence(fact: DeterministicFact) {
  return fact.evidence.map((evidence) => ({ ...evidence }));
}

function observationMaterial(fact: DeterministicFact): string {
  const evidence = fact.evidence
    .map((item) => [
      item.sourceDocumentId ?? "",
      item.sourceBlockId ?? "",
      item.url,
      keyText(item.excerpt),
      item.provenance,
    ].join("\0"))
    .sort()
    .join("\0");

  return `${fact.id}\0${evidence}`;
}

export function routeLegacyFactsAsObservations(
  facts: readonly DeterministicFact[],
): KnowledgeObservation[] {
  const occurrenceByMaterial = new Map<string, number>();

  return facts
    .map((fact, sourceIndex) => {
      const primaryBucket = primaryBucketForCategory(fact.category);
      const material = observationMaterial(fact);
      const occurrence = occurrenceByMaterial.get(material) ?? 0;
      occurrenceByMaterial.set(material, occurrence + 1);

      return {
        id: stableId("knowledge_observation", `${material}\0${occurrence}`),
        sourceFactId: fact.id,
        sourceIndex,
        text: fact.value,
        evidence: cloneFactEvidence(fact),
        provenance: fact.provenance,
        candidateCategories: [fact.category],
        assignedBuckets: [primaryBucket],
        primaryBucket,
        routingReasons: [
          "legacy_fact_category",
          "category_primary_owner",
        ],
      } satisfies KnowledgeObservation;
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}
