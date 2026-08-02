import type { WebsiteKnowledgeFact } from "../knowledge/websiteKnowledge";
import type { ClassifiedPageType } from "./contracts";
import { keyText } from "./util";

type Category = WebsiteKnowledgeFact["category"];

export type CanonicalTopicInput = {
  category: Category;
  value: string;
  suggestedTopic?: string;
  heading?: string;
  pageType?: ClassifiedPageType;
};

const ALIASES: ReadonlyArray<{ namespace: string; identity: string; pattern: RegExp }> = [
  { namespace: "certification", identity: "soc2", pattern: /\bsoc\s*(?:ii|2)\b/i },
  { namespace: "certification", identity: "hipaa", pattern: /\bhipaa\b/i },
  { namespace: "certification", identity: "iso_27001", pattern: /\biso\s*27001\b/i },
  { namespace: "integration", identity: "google_workspace", pattern: /\bgoogle\s+(?:workspace|apps)\b/i },
  { namespace: "service", identity: "google_ads", pattern: /\bgoogle\s+ads?\b/i },
  { namespace: "service", identity: "seo", pattern: /\bseo\b|\bsearch engine optimi[sz]ation\b/i },
];

const NAMESPACE: Partial<Record<Category, string>> = {
  product: "product", service: "service", pricing_plan: "pricing_plan",
  policy: "policy", contact_information: "contact", location_service_area: "location",
  integration: "integration", industry_served: "industry", certification: "certification",
  security_compliance: "certification", faq: "faq",
};

function slug(value: string): string {
  return keyText(value).replace(/\b(the|a|an)\b/g, " ").trim().replace(/\s+/g, "_");
}

function firstMatch(value: string, pattern: RegExp): string | undefined {
  return value.match(pattern)?.[1];
}

/** Evidence-only, deterministic identity. It never changes or combines the fact itself. */
export function canonicalTopicKey(input: CanonicalTopicInput): string {
  const evidence = `${input.heading ?? ""} ${input.value}`;
  for (const alias of ALIASES) {
    if (alias.pattern.test(evidence)) return `${alias.namespace}:${alias.identity}`;
  }

  let namespace = NAMESPACE[input.category] ?? input.category;
  let name: string | undefined;
  if (input.category === "pricing_plan")
    name = firstMatch(input.value, /\b([a-z0-9][a-z0-9 '&.-]{0,35}?)\s+(?:plan|package|tier)\b/i);
  else if (input.category === "policy")
    name = firstMatch(evidence, /\b(refund|return|cancellation?|privacy|warranty|guarantee|terms|retention)\b/i);
  else if (input.category === "contact_information") {
    name = /\bsupport\b/i.test(evidence) ? "support" : /\bsales\b/i.test(evidence) ? "sales" :
      evidence.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0] ?? evidence.match(/\+?\d[\d ().-]{7,}\d/)?.[0];
  } else if (input.category === "integration")
    name = firstMatch(input.value, /\b(?:with|to|for)\s+([a-z0-9][a-z0-9 .&+-]{1,45}?)(?:[.!]|$)/i);
  else if (["product", "service", "industry_served", "location_service_area"].includes(input.category))
    name = input.heading?.replace(/\b(products?|services?|solutions?|industr(?:y|ies)|locations?|our)\b/gi, " ");

  // A category's page structure is useful context, but does not override an
  // explicit category or manufacture a name absent from the evidence.
  if (!name?.trim()) name = input.suggestedTopic || input.value;
  const identity = slug(name);
  if (!identity) return `${namespace}:unknown`;
  return `${namespace}:${identity}`;
}
