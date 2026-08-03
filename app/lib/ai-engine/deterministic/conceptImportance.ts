import type {
  ConceptHealth, ConceptImportance, ConceptImportanceLevel, DeterministicFact, MaterialConflict,
} from "./contracts";

type ImportanceProfile = {
  business: number;
  assistant: number;
  customer: number;
  reason: string;
};

// Category baselines are deliberately independent of confidence, support count, and health.
const CATEGORY_BASELINES: Partial<Record<DeterministicFact["category"], ImportanceProfile>> = {
  pricing_plan: { business: 95, assistant: 95, customer: 95, reason: "pricing_affects_purchase" },
  policy: { business: 62, assistant: 68, customer: 68, reason: "policy_business_rule" },
  product: { business: 62, assistant: 62, customer: 58, reason: "core_business_identity" },
  service: { business: 62, assistant: 65, customer: 62, reason: "core_business_identity" },
  contact_information: { business: 42, assistant: 48, customer: 48, reason: "secondary_business_detail" },
  industry_served: { business: 55, assistant: 55, customer: 52, reason: "customer_eligibility" },
  integration: { business: 55, assistant: 58, customer: 55, reason: "integration_compatibility" },
  certification: { business: 55, assistant: 58, customer: 55, reason: "business_qualification" },
  location_service_area: { business: 35, assistant: 38, customer: 38, reason: "secondary_business_detail" },
};

function level(score: number): ConceptImportanceLevel {
  if (score >= 85) return "critical";
  if (score >= 70) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function matches(text: string, expression: RegExp): boolean {
  return expression.test(text);
}

/** Explicit deterministic category/wording assessment; mention frequency is never used. */
export function assessConceptImportance(
  category: DeterministicFact["category"],
  canonicalTopicIdentity: string,
  facts: readonly DeterministicFact[],
  health: ConceptHealth,
  conflicts: readonly MaterialConflict[],
): ConceptImportance {
  const baseline = CATEGORY_BASELINES[category];
  // Only supported concept categories call this function. This fallback keeps the helper total.
  const scores = baseline
    ? { business: baseline.business, assistant: baseline.assistant, customer: baseline.customer }
    : { business: 20, assistant: 20, customer: 20 };
  const reasons = new Set<string>([baseline?.reason ?? "low_customer_impact"]);
  const text = `${canonicalTopicIdentity.replace(/[_:]/g, " ")} ${facts.map(fact => `${fact.title} ${fact.value}`).join(" ")}`;

  const primary = matches(text, /\b(?:primary|core|flagship|main|most popular|recommended|best for)\b/i);
  const required = matches(text, /\b(?:required|mandatory|essential|unavailable without)\b/i);
  const included = matches(text, /\bincluded\b/i);
  const official = matches(text, /\bofficial\b/i);
  const secondary = matches(text, /\b(?:secondary|peripheral|minor|additional office|alternate contact)\b/i);
  const refundOrCancellation = matches(text, /\b(?:refunds?|cancell?ation|cancell?ing|cancelled)\b/i);
  const privacy = matches(text, /\bprivacy\b/i);
  const warrantyOrGuarantee = matches(text, /\b(?:warrant(?:y|ies)|guarantee[sd]?)\b/i);
  const eligibility = matches(text, /\b(?:eligib(?:le|ility)|qualif(?:y|ies|ication)|requirements?)\b/i);
  const support = matches(text, /\bsupport\b/i);
  const billing = matches(text, /\bbilling\b/i);
  const security = matches(text, /\b(?:security|secure|soc\s*[123]|hipaa)\b/i);
  const compliance = matches(text, /\b(?:compliance|compliant|gdpr|pci(?:[- ]dss)?|iso\s*27001)\b/i);
  const availability = matches(text, /\b(?:available|availability|service area|serves|serving|nationwide|worldwide)\b/i);

  if (primary && (category === "product" || category === "service")) {
    scores.business += 18; scores.assistant += 12; scores.customer += 12;
    reasons.add("primary_offer");
  }
  if (required) {
    scores.business += 15; scores.assistant += 15; scores.customer += 15;
    reasons.add(category === "integration" ? "essential_integration" : "customer_eligibility");
  }
  if (included && (category === "product" || category === "service" || category === "integration")) {
    scores.business += 5; scores.assistant += 5; scores.customer += 5;
    reasons.add("included_business_capability");
  }
  if (secondary && (category === "product" || category === "service" || category === "contact_information" || category === "location_service_area")) {
    scores.business -= 22; scores.assistant -= 22; scores.customer -= 22;
    reasons.delete("core_business_identity");
    reasons.add("secondary_business_detail");
    reasons.add("low_customer_impact");
  }
  if (category === "policy" && (refundOrCancellation || privacy || warrantyOrGuarantee || eligibility)) {
    scores.business = Math.max(scores.business, 90);
    scores.assistant = Math.max(scores.assistant, 95);
    scores.customer = Math.max(scores.customer, 95);
    reasons.add("policy_affects_customer_rights");
    if (eligibility) reasons.add("customer_eligibility");
  }
  if (category === "contact_information" && (support || billing)) {
    scores.business = Math.max(scores.business, 72);
    scores.assistant = Math.max(scores.assistant, 80);
    scores.customer = Math.max(scores.customer, 78);
    if (support) reasons.add("support_contact");
    if (billing) reasons.add("billing_contact");
  }
  if (official && (category === "contact_information" || category === "certification")) {
    scores.business += 5; scores.assistant += 5; scores.customer += 5;
    reasons.add("official_business_source");
  }
  if (security || compliance) {
    scores.business = Math.max(scores.business, 75);
    scores.assistant = Math.max(scores.assistant, 80);
    scores.customer = Math.max(scores.customer, 75);
    if (security) reasons.add("security_claim");
    if (compliance) reasons.add("compliance_claim");
  }
  if (availability && (category === "service" || category === "location_service_area")) {
    scores.assistant = Math.max(scores.assistant, 68);
    scores.customer = Math.max(scores.customer, 65);
    reasons.add("service_availability");
  }

  scores.business = Math.max(0, Math.min(100, scores.business));
  scores.assistant = Math.max(0, Math.min(100, scores.assistant));
  scores.customer = Math.max(0, Math.min(100, scores.customer));
  const score = Math.max(0, Math.min(100, Math.round(
    scores.business * 0.4 + scores.assistant * 0.35 + scores.customer * 0.25,
  )));
  const importanceLevel = level(score);
  const hasConflict = conflicts.length > 0 || health.hasConflicts;
  if (hasConflict && (importanceLevel === "critical" || importanceLevel === "high")) {
    reasons.add("unresolved_high_impact_conflict");
  }
  const riskIfWrong = importanceLevel === "critical"
    ? hasConflict ? "severe" : "high"
    : importanceLevel === "high"
      ? "high"
      : importanceLevel === "medium"
        ? health.status === "strong" && !hasConflict ? "low" : "moderate"
        : "low";

  return {
    level: importanceLevel,
    score,
    reasons: Array.from(reasons).sort(),
    businessCriticality: level(scores.business),
    assistantCriticality: level(scores.assistant),
    customerImpact: level(scores.customer),
    riskIfWrong,
  };
}
