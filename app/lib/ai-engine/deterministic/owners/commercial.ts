import type { OwnerReviewer } from "./types";
import { hasAllowedLane } from "./types";

const ALLOWED = ["core_business", "commercial", "technical"] as const;
const POLICY = /\b(?:refund|return|privacy|terms|policy|non-refundable|customer(?:'s|s') responsibility|data collection|personal information)\b/i;
const CTA_ONLY = /^(?:scroll down|click here|learn more|read more|view more|order now|shop now|contact us|call now|see what we offer)\b/i;
const REFERRAL_OR_ADVICE = /\b(?:provide (?:you )?with .*recommendations?|refer you to|local recommendations?|consult (?:an|a)|you should|consider|tips?|best practices?)\b/i;
const EXPLICIT_SELLABLE = /\b(?:we|our|company|agency|firm|studio|practice|provider|team)\b.{0,60}\b(?:offer|offers|provide|provides|deliver|delivers|sell|sells|specialize|specializes|build|builds|create|creates|design|designs|manage|manages|implement|implements|support|supports)\b/i;

export const reviewCommercial: OwnerReviewer = ({ fact, lanes }) => {
  if (!hasAllowedLane(lanes, ALLOWED)) return { accept: false, reason: "commercial_job_rejected_evidence_lane" };

  const value = fact.value.trim();
  if (POLICY.test(value)) return { accept: false, reason: "commercial_job_rejected_policy_language" };
  if (CTA_ONLY.test(value)) return { accept: false, reason: "commercial_job_rejected_navigation_or_cta" };
  if (REFERRAL_OR_ADVICE.test(value) && !lanes.includes("commercial")) return { accept: false, reason: "commercial_job_rejected_referral_or_advice" };

  if (fact.category === "pricing_plan" || fact.category === "pricing") {
    const transactionalPricing = /\b(?:price|pricing|fee|rate|plan|package|tier|subscription|membership|special|promotion|discount|offer|starting at|from only|per month|per year)\b/i.test(value);
    const moneyWithTransaction = /(?:[$£€]\s?\d)/.test(value) && /\b(?:fee|price|cost|plan|package|special|promotion|discount|per|starting|add|setup|size|side|month|year)\b/i.test(value);
    if (!transactionalPricing && !moneyWithTransaction) return { accept: false, reason: "commercial_job_requires_transactional_pricing" };
  }

  if (fact.category === "service" && lanes.includes("core_business") && !EXPLICIT_SELLABLE.test(value)) {
    return { accept: false, reason: "commercial_job_requires_first_party_service_claim" };
  }

  return { accept: true, reason: "commercial_job_accepted" };
};
