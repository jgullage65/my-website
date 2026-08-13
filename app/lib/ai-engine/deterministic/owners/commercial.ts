import type { OwnerReviewer } from "./types";
import { hasAllowedLane } from "./types";

const ALLOWED = ["core_business", "commercial", "technical", "unknown"] as const;
const POLICY = /\b(?:refund|return|privacy|terms|policy|non-refundable|customer(?:'s|s') responsibility|data collection|personal information)\b/i;
const CTA_ONLY = /^(?:scroll down|click here|learn more|read more|view more|order now|shop now|contact us|call now|see what we offer)\b/i;

export const reviewCommercial: OwnerReviewer = ({ fact, lanes }) => {
  if (!hasAllowedLane(lanes, ALLOWED)) return { accept: false, reason: "commercial_owner_rejected_evidence_lane" };

  const value = fact.value.trim();
  if (POLICY.test(value)) return { accept: false, reason: "commercial_owner_rejected_policy_language" };
  if (CTA_ONLY.test(value)) return { accept: false, reason: "commercial_owner_rejected_navigation_or_cta" };

  if (fact.category === "pricing_plan" || fact.category === "pricing") {
    if (!/(?:[$£€]\s?\d|\bfree\b|\b(?:price|pricing|plan|package|tier|subscription|membership|fee|rate|special|promotion|discount|offer)\b)/i.test(value)) {
      return { accept: false, reason: "commercial_owner_requires_pricing_signal" };
    }
  }

  return { accept: true, reason: "commercial_owner_accepted" };
};
