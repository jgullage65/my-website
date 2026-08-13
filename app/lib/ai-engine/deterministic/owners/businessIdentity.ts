import type { OwnerReviewer } from "./types";
import { hasAllowedLane } from "./types";

const ALLOWED = ["core_business", "market_customer", "operations", "technical", "unknown"] as const;

export const reviewBusinessIdentity: OwnerReviewer = ({ fact, lanes }) => {
  if (!hasAllowedLane(lanes, ALLOWED)) return { accept: false, reason: "identity_owner_rejected_evidence_lane" };

  const value = fact.value.toLowerCase();
  if (fact.category === "location_service_area" || fact.category === "location") {
    if (!/\b(?:located|based|serve|serves|serving|service area|available in|available throughout|office|offices|nationwide|worldwide|region|surrounding)\b/i.test(value)) {
      return { accept: false, reason: "identity_owner_requires_explicit_location_claim" };
    }
  }

  if (fact.category === "company_overview") {
    if (/\b(?:should|consider|tips?|best practices?|how to|ways to)\b/i.test(value)) {
      return { accept: false, reason: "identity_owner_rejected_advice_as_company_fact" };
    }
  }

  return { accept: true, reason: "identity_owner_accepted" };
};
