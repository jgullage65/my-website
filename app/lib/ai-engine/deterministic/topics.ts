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
  { namespace: "security_compliance", identity: "soc2", categories: ["security_compliance"], pattern: /\bsoc\s*(?:ii|2)\b/i },
  { namespace: "security_compliance", identity: "hipaa", categories: ["security_compliance"], pattern: /\bhipaa\b/i },
  { namespace: "security_compliance", identity: "iso_27001", categories: ["security_compliance"], pattern: /\biso\s*27001\b/i },
  { namespace: "security_compliance", identity: "gdpr", categories: ["security_compliance"], pattern: /\bgdpr\b/i },
  { namespace: "security_compliance", identity: "encryption", categories: ["security_compliance"], pattern: /\bencrypt(?:ed|ion)?\b/i },
  { namespace: "security_compliance", identity: "sso", categories: ["security_compliance"], pattern: /\bsso\b/i },
  { namespace: "security_compliance", identity: "mfa", categories: ["security_compliance"], pattern: /\bmfa\b/i },
  { namespace: "integration", identity: "google_workspace", categories: ["integration"], pattern: /\bgoogle\s+(?:workspace|apps)\b/i },
  { namespace: "service", identity: "google_ads", categories: ["service"], pattern: /\bgoogle\s+ads?\b/i },
  { namespace: "service", identity: "seo", categories: ["service"], pattern: /\bseo\b|\bsearch engine optimi[sz]ation\b/i },
];

const NAMESPACE: Partial<Record<Category, string>> = {
  product: "product",
  service: "service",
  pricing_plan: "pricing_plan",
  policy: "policy",
  contact_information: "contact",
  location_service_area: "location",
  integration: "integration",
  industry_served: "industry",
  certification: "certification",
  security_compliance: "security_compliance",
  faq: "faq",
  primary_use_case: "primary_use_case",
  support_onboarding: "support_onboarding",
  customer_segment: "customer_segment",
  competitive_differentiator: "competitive_differentiator",
  mission_value_proposition: "mission_value_proposition",
  brand_voice_terminology: "brand_voice_terminology",
  additional_business_knowledge: "additional_business_knowledge",
};

const GENERIC_HEADINGS = /^(?:what we (?:offer|do|help with)|our solutions|solutions (?:for|built for) growth|our expertise|popular services|featured products|products? and services?|services?|products?|industries|who we serve|locations?|where we work|capabilities)$/i;
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
  if (category === "pricing_plan") {
    return match(value, /\b([a-z0-9][a-z0-9 '&.-]*?)\s+(?:special|offer|promotion|plan|package|tier|subscription)\b/i)
      ?? match(value, /\b(?:special|offer|promotion|plan|package|tier|subscription)\s+(?:for\s+)?([a-z0-9][a-z0-9 '&.-]*?)(?:[.,]|$)/i);
  }
  if (category === "product")
    return match(value, /\b(?:our\s+)?([a-z0-9][a-z0-9 '&.-]*?)\s+(?:product|platform|software|app|application|suite|tool)\b/i);
  if (category === "service") {
    if (/^(?:implementation|consulting|training|management|design|optimization|cleaning|strategy|development|marketing|support|maintenance)$/i.test(cleanText(value)))
      return cleanName(value);
    return match(value, /\b(?:we\s+(?:offer|provide|deliver)|our services? include|(?:our\s+)?(?:business|company|agency|firm|practice|studio|team)\s+specializes? in)\s+(.+?)(?:[.;]|\s+for\b|$)/i)
      ?? match(value, /^(.+?(?:consulting|implementation|training|management|design|optimization|cleaning|strategy|development|marketing|support|maintenance|service|services))$/i);
  }
  if (category === "primary_use_case") {
    return match(value, /\b(?:helps?|used (?:to|for)|designed to|built to|enables?|solves?|supports?)\s+(.+?)(?:[.;]|$)/i);
  }
  if (category === "industry_served")
    return match(value, /\b(?:solutions? for|serving (?:the\s+)?|industries? (?:we )?serve\s*:?|teams? in)\s+(.+?)(?:\s+(?:organizations?|companies|businesses|industry|sector))?(?:[.,]|$)/i);
  if (category === "location_service_area")
    return match(value, /\b(?:(?:located|based|office(?: is)? located)\s+in|serve|serving|available throughout|available in)\s+(.+?)(?:[.,]|\s+and\b|$)/i)
      ?? (/^(?:[A-Z][a-z]+(?:[ -][A-Z][a-z]+){0,3})$/.test(cleanText(value)) ? cleanName(value) : undefined);
  return undefined;
}

export function canonicalTopicKey(input: CanonicalTopicInput): string {
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
    name = match(input.value, /\b(?:with|to|for)\s+(.+?)(?:[.!]|$)/i);
  else if (["product", "service", "industry_served", "location_service_area", "primary_use_case"].includes(input.category)) {
    const itemName = explicitValueName(input.category, input.value);
    name = itemName && !/^(?:software|product|platform|app|application|suite|tool|service|services)$/i.test(itemName)
      ? itemName : itemHeading(input.heading);
  }

  const suggested = cleanName(input.suggestedTopic);
  const explicit = explicitValueName(input.category, input.value);
  if (!name) name = explicit ?? suggested;
  if (input.category === "pricing_plan") name = explicit ?? suggested;
  const identity = slug(name || input.value);
  return `${namespace}:${identity || "unknown"}`;
}
