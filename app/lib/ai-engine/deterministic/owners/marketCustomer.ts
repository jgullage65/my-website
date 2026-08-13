import type { OwnerReviewer } from "./types";
import { hasAllowedLane } from "./types";

const ALLOWED = ["core_business", "commercial", "market_customer", "unknown"] as const;
const ADVICE = /\b(?:should|consider|tips?|best practices?|how to|ways to|you can|you should|marketers? should|businesses should)\b/i;

export const reviewMarketCustomer: OwnerReviewer = ({ fact, lanes }) => {
  if (!hasAllowedLane(lanes, ALLOWED)) return { accept: false, reason: "market_owner_rejected_evidence_lane" };

  const value = fact.value.trim();
  if (ADVICE.test(value)) return { accept: false, reason: "market_owner_rejected_educational_advice" };

  if (fact.category === "customer_segment" || fact.category === "customer") {
    if (!/\b(?:serves?|serving|built for|designed for|customers? (?:include|are)|clients? (?:include|are)|users? (?:include|are)|businesses?|companies|organizations?|teams?|professionals?|audience)\b/i.test(value)) {
      return { accept: false, reason: "market_owner_requires_explicit_customer_segment" };
    }
  }

  return { accept: true, reason: "market_owner_accepted" };
};
