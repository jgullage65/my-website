import type { DeterministicFact } from "../contracts";
import type { EvidenceLane } from "../routing";

export type OwnerReviewContext = {
  fact: DeterministicFact;
  lanes: readonly EvidenceLane[];
};

export type OwnerReviewDecision = {
  accept: boolean;
  reason: string;
};

export type OwnerReviewer = (context: OwnerReviewContext) => OwnerReviewDecision;

export function hasAllowedLane(lanes: readonly EvidenceLane[], allowed: readonly EvidenceLane[]) {
  return lanes.length === 0 || lanes.some((lane) => allowed.includes(lane));
}
