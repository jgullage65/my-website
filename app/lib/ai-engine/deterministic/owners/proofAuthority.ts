import type { OwnerReviewer } from "./types";
import { hasAllowedLane } from "./types";

const ALLOWED = ["core_business", "commercial", "proof", "market_customer"] as const;
const WEAK_CONSTRAINT = /^(?:\*?special order only!?|we only offer|available only|limited to|cost is based on)\b/i;
const PROOF_SIGNAL = /\b(?:testimonial|review|recommend|case study|success story|result|results|outcome|rating|stars?|award|recognized|licensed|certified|years? of experience|over \d+ years|more than \d+ years|served \d+|sold \d+|generated|increased|reduced|saved|delivered)\b/i;
const DIFFERENTIATION_SIGNAL = /\b(?:unique|proprietary|exclusive|specializ(?:e|es|ed|ing)|award-winning|only provider|recognized for|known for|leading|decades? of experience|years? of experience|proven)\b/i;

function looksTransactionalBlob(value: string) {
  const moneyCount = value.match(/[$£€]\s?\d+(?:\.\d+)?/g)?.length ?? 0;
  const addOnCount = value.match(/\b(?:fee|add|setup|size|double sided|per foot|per month|per year|quantity|cost|price)\b/gi)?.length ?? 0;
  return moneyCount >= 2 && addOnCount >= 2;
}

export const reviewProofAuthority: OwnerReviewer = ({ fact, lanes }) => {
  if (!hasAllowedLane(lanes, ALLOWED)) return { accept: false, reason: "proof_job_rejected_evidence_lane" };

  const value = fact.value.trim();

  if (fact.category === "competitive_differentiator" || fact.category === "differentiator") {
    if (WEAK_CONSTRAINT.test(value)) return { accept: false, reason: "proof_job_rejected_operational_constraint" };
    if (looksTransactionalBlob(value)) return { accept: false, reason: "proof_job_rejected_pricing_blob_as_differentiator" };
    if (!DIFFERENTIATION_SIGNAL.test(value) && !PROOF_SIGNAL.test(value)) {
      return { accept: false, reason: "proof_job_requires_real_differentiation_or_authority" };
    }
  }

  if (fact.category === "additional_business_knowledge") {
    if (lanes.includes("proof")) return { accept: true, reason: "proof_job_accepted_proof_lane" };
    if (!PROOF_SIGNAL.test(value)) return { accept: false, reason: "proof_job_requires_proof_signal" };
  }

  return { accept: true, reason: "proof_job_accepted" };
};
