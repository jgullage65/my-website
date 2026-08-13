import type { OwnerReviewer } from "./types";
import { hasAllowedLane } from "./types";

const ALLOWED = ["core_business", "market_customer", "operations", "technical", "unknown"] as const;
const CTA = /^(?:set up|schedule|book|connect|contact|call|click|learn more|read more|view more|start|join)\b/i;
const ADVICE = /\b(?:should|consider|tips?|best practices?|how to|ways to)\b/i;

export const reviewBusinessIdentity: OwnerReviewer = ({ fact, lanes }) => {
  if (!hasAllowedLane(lanes, ALLOWED)) return { accept: false, reason: "identity_job_rejected_evidence_lane" };

  const value = fact.value.trim();

  if (fact.category === "location_service_area" || fact.category === "location") {
    const explicitServiceArea = /\b(?:located|based|serve|serves|serving|service area|available in|available throughout|office|offices|surrounding area|operates? in|ships? to|delivery to)\b/i.test(value);
    if (!explicitServiceArea) return { accept: false, reason: "identity_job_requires_explicit_service_area_claim" };
  }

  if (fact.category === "company_overview" || fact.category === "business_identity") {
    if (CTA.test(value) || ADVICE.test(value)) return { accept: false, reason: "identity_job_rejected_cta_or_advice" };
  }

  return { accept: true, reason: "identity_job_accepted" };
};
