import type { DeterministicFact } from "../contracts";
import type { KnowledgeBucket, KnowledgeObservation } from "../routing/contracts";
import type { BucketReport } from "./contracts";

function cloneFact(fact: DeterministicFact): DeterministicFact {
  return {
    ...fact,
    evidence: fact.evidence.map((evidence) => ({ ...evidence })),
  };
}

function cloneObservation(
  observation: KnowledgeObservation,
): KnowledgeObservation {
  return {
    ...observation,
    evidence: observation.evidence.map((evidence) => ({ ...evidence })),
    candidateCategories: [...observation.candidateCategories],
    assignedBuckets: [...observation.assignedBuckets],
    routingReasons: [...observation.routingReasons],
  };
}

export function buildCompatibilityBucketReport(
  bucket: KnowledgeBucket,
  observations: readonly KnowledgeObservation[],
  legacyFacts: readonly DeterministicFact[],
): BucketReport {
  const ownedObservations = observations
    .filter((observation) => observation.primaryBucket === bucket)
    .map(cloneObservation)
    .sort((left, right) => left.id.localeCompare(right.id));

  const facts = ownedObservations.map((observation) => {
    const fact = legacyFacts[observation.sourceIndex];
    if (!fact || fact.id !== observation.sourceFactId) {
      throw new Error(
        `Missing legacy fact occurrence at source index ${observation.sourceIndex}`,
      );
    }
    return cloneFact(fact);
  });

  return {
    bucket,
    observations: ownedObservations,
    claims: [],
    facts,
    duplicateGroups: [],
    conflicts: [],
    concepts: [],
    unresolvedQuestions: [],
    crossBucketReferences: [],
    status: "complete",
  };
}
