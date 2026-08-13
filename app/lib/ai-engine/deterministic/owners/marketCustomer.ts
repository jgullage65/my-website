import type { OwnerReviewer } from "./types";
import { hasAllowedLane } from "./types";

const ALLOWED = ["core_business", "commercial", "market_customer"] as const;
const ADVICE = /\b(?:should|consider|tips?|best practices?|how to|ways to|you can|you should|marketers? should|businesses should)\b/i;
const FIRST_PARTY = /\b(?:we|our|us|company|agency|firm|studio|practice|provider|team)\b/i;

export const reviewMarketCustomer: OwnerReviewer = ({ fact, lanes }) => {
  if (!hasAllowedLane(lanes, ALLOWED)) return { accept: false, reason: "market_job_rejected_evidence_lane" };

  const value = fact.value.trim();
  if (ADVICE.test(value)) return { accept: false, reason: "market_job_rejected_educational_advice" };

  if (fact.category === "customer_segment" || fact.category === "customer") {
    const explicitAudience = /\b(?:serves?|serving|built for|designed for|customers? (?:include|are)|clients? (?:include|are)|users? (?:include|are)|audience includes?|ideal for|for (?:small|mid-sized|large|local|enterprise|nonprofit|professional|consumer|business))\b/i.test(value);
    if (!explicitAudience || !FIRST_PARTY.test(value)) return { accept: false, reason: "market_job_requires_first_party_customer_claim" };
  }

  if (fact.category === "primary_use_case") {
    const explicitUseCase = /\b(?:helps?|used (?:to|for)|designed to|built to|enables?|solves?|supports?|improves?|reduces?|increases?|manages?|automates?|creates?|tracks?|connects?|drives?|maximi[sz]es?)\b/i.test(value);
    if (!explicitUseCase) return { accept: false, reason: "market_job_requires_explicit_use_case" };
  }

  return { accept: true, reason: "market_job_accepted" };
};
