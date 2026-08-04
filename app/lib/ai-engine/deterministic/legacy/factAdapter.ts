import assert from "node:assert/strict";
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
  const expectedObservationIds = new Set(
    observations.map((observation) => observation.id),
  );
  const seenObservationIds = new Set<string>();
  const reconstructed: Array<{ sourceIndex: number; fact: DeterministicFact }> = [];

  for (const report of reports) {
    if (report.observations.length !== report.facts.length) {
      throw new Error(
        `Bucket ${report.bucket} observation/fact count mismatch`,
      );
    }

    report.observations.forEach((observation, index) => {
      if (seenObservationIds.has(observation.id)) {
        throw new Error(
          `Duplicate observation across bucket reports: ${observation.id}`,
        );
      }
      seenObservationIds.add(observation.id);

      if (!expectedObservationIds.has(observation.id)) {
        throw new Error(`Unexpected routed observation: ${observation.id}`);
      }

      if (observation.primaryBucket !== report.bucket) {
        throw new Error(
          `Observation ${observation.id} does not belong to bucket ${report.bucket}`,
        );
      }

      const fact = report.facts[index];
      if (!fact || fact.id !== observation.sourceFactId) {
        throw new Error(
          `Missing matching fact for observation ${observation.id}`,
        );
      }

      if (primaryBucketForCategory(fact.category) !== report.bucket) {
        throw new Error(
          `Fact ${fact.id} does not belong to bucket ${report.bucket}`,
        );
      }

      const expected = expectedFacts[observation.sourceIndex];
      if (!expected) {
        throw new Error(
          `Missing expected legacy fact at source index ${observation.sourceIndex}`,
        );
      }

      try {
        assert.deepStrictEqual(fact, expected);
      } catch {
        throw new Error(
          `Legacy fact parity mismatch at source index ${observation.sourceIndex}`,
        );
      }

      reconstructed.push({
        sourceIndex: observation.sourceIndex,
        fact: cloneFact(fact),
      });
    });
  }

  if (seenObservationIds.size !== observations.length) {
    throw new Error(
      `Reconstructed observation count ${seenObservationIds.size} does not match expected ${observations.length}`,
    );
  }

  if (reconstructed.length !== expectedFacts.length) {
    throw new Error(
      `Reconstructed fact count ${reconstructed.length} does not match expected ${expectedFacts.length}`,
    );
  }

  const ordered = reconstructed.sort(
    (left, right) => left.sourceIndex - right.sourceIndex,
  );

  ordered.forEach(({ fact, sourceIndex }, index) => {
    const expected = expectedFacts[index];
    if (sourceIndex !== index || !expected || fact.id !== expected.id) {
      throw new Error(`Legacy fact order mismatch at source index ${index}`);
    }
  });

  return ordered.map(({ fact }) => fact);
}
