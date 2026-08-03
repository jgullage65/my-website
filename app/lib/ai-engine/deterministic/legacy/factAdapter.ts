import type { DeterministicFact } from "../contracts";
import { primaryBucketForCategory } from "../routing/buckets";
import type { KnowledgeObservation } from "../routing/contracts";
import type { BucketReport } from "../specialists/contracts";

function cloneFact(fact: DeterministicFact): DeterministicFact {
  return {
    ...fact,
    evidence: fact.evidence.map((evidence) => ({ ...evidence })),
  };
}

export function reportsToLegacyFacts(
  reports: readonly BucketReport[],
  observations: readonly KnowledgeObservation[],
  expectedFacts: readonly DeterministicFact[],
): DeterministicFact[] {
  const observationByFactId = new Map(
    observations.map((observation) => [observation.sourceFactId, observation]),
  );
  const seen = new Set<string>();
  const reconstructed: Array<{ sourceIndex: number; fact: DeterministicFact }> = [];

  for (const report of reports) {
    for (const fact of report.facts) {
      if (seen.has(fact.id)) {
        throw new Error(`Duplicate fact ID across bucket reports: ${fact.id}`);
      }
      seen.add(fact.id);

      if (primaryBucketForCategory(fact.category) !== report.bucket) {
        throw new Error(
          `Fact ${fact.id} does not belong to bucket ${report.bucket}`,
        );
      }

      const observation = observationByFactId.get(fact.id);
      if (!observation) {
        throw new Error(`Missing routed observation for fact: ${fact.id}`);
      }

      reconstructed.push({
        sourceIndex: observation.sourceIndex,
        fact: cloneFact(fact),
      });
    }
  }

  if (reconstructed.length !== expectedFacts.length) {
    throw new Error(
      `Reconstructed fact count ${reconstructed.length} does not match expected ${expectedFacts.length}`,
    );
  }

  for (const fact of expectedFacts) {
    if (!seen.has(fact.id)) {
      throw new Error(`Legacy fact was absent from all bucket reports: ${fact.id}`);
    }
  }

  return reconstructed
    .sort((left, right) => left.sourceIndex - right.sourceIndex)
    .map(({ fact }) => fact);
}
