import type { OwnerReviewer } from "./types";
import { hasAllowedLane } from "./types";

const ALLOWED = ["operations", "legal", "technical", "editorial", "core_business", "unknown"] as const;

export const reviewOperationsContext: OwnerReviewer = ({ lanes }) => {
  if (!hasAllowedLane(lanes, ALLOWED)) return { accept: false, reason: "operations_owner_rejected_evidence_lane" };
  return { accept: true, reason: "operations_owner_accepted" };
};
