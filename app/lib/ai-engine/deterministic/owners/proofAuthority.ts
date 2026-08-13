import type { OwnerReviewer } from "./types";
import { hasAllowedLane } from "./types";

const ALLOWED = ["core_business", "commercial", "proof", "market_customer", "unknown"] as const;
const WEAK_CONSTRAINT = /^(?:\*?special order only!?|we only offer|available only|limited to|cost is based on)\b/i;

export const reviewProofAuthority: OwnerReviewer = ({ fact, lanes }) => {
  if (!hasAllowedLane(lanes, ALLOWED)) return { accept: false, reason: "proof_owner_rejected_evidence_lane" };

  const value = fact.value.trim();
  if ((fact.category === "competitive_differentiator" || fact.category === "differentiator") && WEAK_CONSTRAINT.test(value)) {
    return { accept: false, reason: "proof_owner_rejected_operational_constraint_as_differentiator" };
  }

  if (fact.category === "additional_business_knowledge") {
    const proofLike = /\b(?:testimonial|review|recommend|case study|success story|result|results|outcome|rating|stars?|customer|client|user)\b/i.test(value);
    if (!proofLike && lanes.includes("proof")) return { accept: true, reason: "proof_owner_accepted_proof_lane" };
  }

  return { accept: true, reason: "proof_owner_accepted" };
};
