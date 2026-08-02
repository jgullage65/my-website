import type { WebsiteKnowledgeFact } from "../knowledge/websiteKnowledge";
import type { ClassifiedPageType } from "./contracts";
import { cleanText, keyText } from "./util";

type Category = WebsiteKnowledgeFact["category"];

export type CanonicalTopicInput = {
  category: Category;
  value: string;
  suggestedTopic?: string;
  heading?: string;
  pageType?: ClassifiedPageType;
};

type Alias = {
  namespace: string;
  identity: string;
  categories: readonly Category[];
  pattern: RegExp;
};

const ALIASES: readonly Alias[] = [
  { namespace: "certification", identity: "soc2", categories: ["certification", "security_compliance"], pattern: /\bsoc\s*(?:ii|2)\b/i },
  { namespace: "certification", identity: "hipaa", categories: ["certification", "security_compliance"], pattern: /\bhipaa\b/i },
  { namespace: "certification", identity: "iso_27001", categories: ["certification", "security_compliance"], pattern: /\biso\s*27001\b/i },
  { namespace: "integration", identity: "google_workspace", categories: ["integration"], pattern: /\bgoogle\s+(?:workspace|apps)\b/i },
  { namespace: "service", identity: "google_ads", categories: ["service"], pattern: /\bgoogle\s+ads?\b/i },
  { namespace: "service", identity: "seo", categories: ["service"], pattern: /\bseo\b|\bsearch engine optimi[sz]ation\b/i },
];

const NAMESPACE: Partial<Record<Category, string>> = {
  product: "product", service: "service", pricing_plan: "pricing_plan",
  policy: "policy", contact_information: "contact", location_service_area: "location",
  integration: "integration", industry_served: "industry", certification: "certification",
  security_compliance: "certification", faq: "faq",
};

const GENERIC_HEADINGS = /^(?:what we (?:offer|do)|our solutions|solutions for growth|products? and services?|services?|products?|industries|who we serve|locations?|where we work|capabilities)$/i;
const LEADING_NAME_NOISE = /^(?:(?:our|choose|select|try|use)\s+(?:the\s+)?|the\s+)/i;

function slug(value: string): string {
  return keyText(value).replace(/\b(the|a|an)\b/g, " ").trim().replace(/\s+/g, "_");
}

function cleanName(value: string | undefined): string | undefined {
  const cleaned = cleanText(value).replace(LEADING_NAME_NOISE, "").replace(/^[\s:–—-]+|[\s:–—-]+$/g, "");
  return cleaned || undefined;
}

function itemHeading(value: string | undefined): string | undefined {
  const heading = cleanText(value);
  return !heading || GENERIC_HEADINGS.test(heading) ? undefined : heading;
}

function match(value: string, pattern: RegExp): string | undefined {
  return cleanName(value.match(pattern)?.[1]);
}

function explicitValueName(category: Category, value: string): string | undefined {
  if (category === "pricing_plan")
    return match(value, /\b((?:(?:our|choose|select|try|use)\s+(?:the\s+)?|the\s+)?[a-z0-9][a-z0-9 '&.-]{0,35}?)\s+(?:plan|package|tier)\b/i);
  if (category === "product")
    return match(value, /\b(?:our\s+)?([a-z0-9][a-z0-9 '&.-]{0,40}?)\s+(?:product|platform|software|app|application|suite|tool)\b/i);
  if (category === "service")
    return match(value, /\b(?:we\s+(?:offer|provide|deliver)|our services? include)\s+([a-z0-9][a-z0-9 '&.-]{1,55}?)(?:\s+(?:services?|consulting|implementation|managed services?))?(?:[.,]|\s+for\b|$)/i);
  if (category === "industry_served")
    return match(value, /\b(?:solutions? for|serving (?:the\s+)?|industries? (?:we )?serve\s*:?|teams? in)\s+([a-z0-9][a-z0-9 '&.-]{1,45}?)(?:\s+(?:organizations?|companies|businesses|industry|sector))?(?:[.,]|$)/i);
  if (category === "location_service_area")
    return match(value, /\b(?:located|based|office(?: is)? located)\s+in\s+([a-z0-9][a-z0-9 .'-]{1,45}?)(?:[.,]|\s+and\b|$)/i);
  return undefined;
}

/** Evidence-only, deterministic identity. It never changes or combines the fact itself. */
export function canonicalTopicKey(input: CanonicalTopicInput): string {
  // FAQs are observations in their own right, not aliases of mentioned topics.
  if (input.category === "faq") return `faq:${slug(input.suggestedTopic || input.value)}`;

  const evidence = `${input.heading ?? ""} ${input.value}`;
  for (const alias of ALIASES) {
    if (alias.categories.includes(input.category) && alias.pattern.test(evidence))
      return `${alias.namespace}:${alias.identity}`;
  }

  const namespace = NAMESPACE[input.category] ?? input.category;
  let name: string | undefined;
  if (input.category === "policy")
    name = match(evidence, /\b(refund|return|cancellation?|privacy|warranty|guarantee|terms|retention)\b/i);
  else if (input.category === "contact_information")
    name = /\bsupport\b/i.test(evidence) ? "support" : /\bsales\b/i.test(evidence) ? "sales" :
      evidence.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0] ?? evidence.match(/\+?\d[\d ().-]{7,}\d/)?.[0];
  else if (input.category === "integration")
    name = match(input.value, /\b(?:with|to|for)\s+([a-z0-9][a-z0-9 .&+-]{1,45}?)(?:[.!]|$)/i);
  else if (["product", "service", "industry_served", "location_service_area"].includes(input.category))
    name = itemHeading(input.heading);

  const suggested = cleanName(input.suggestedTopic);
  const explicit = explicitValueName(input.category, input.value);
  if (!name) name = explicit ?? suggested;
  if (input.category === "pricing_plan") name = explicit ?? suggested;
  const identity = slug(name || input.value);
  return `${namespace}:${identity || "unknown"}`;
}
