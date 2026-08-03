import type { DeterministicFact } from "../contracts";
import { stableId } from "../util";
import { primaryBucketForCategory } from "./buckets";
import type { KnowledgeObservation } from "./contracts";

function cloneFactEvidence(fact: DeterministicFact) {
  return fact.evidence.map((evidence) => ({ ...evidence }));
}

export function routeLegacyFactsAsObservations(
  facts: readonly DeterministicFact[],
): KnowledgeObservation[] {
  return facts
    .map((fact, sourceIndex) => {
      const primaryBucket = primaryBucketForCategory(fact.category);
      return {
        id: stableId("knowledge_observation", fact.id),
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
