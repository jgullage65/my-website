import type { DeterministicFact, NormalizedSourceBlock } from "./contracts";
import { canonicalTopicKey } from "./topics";
import { cleanText, keyText, stableId } from "./util";

type Category = DeterministicFact["category"];

const COMMERCIAL = new Set<Category>([
  "company_overview", "pricing_plan", "product", "service", "feature_capability",
  "customer_segment", "industry_served", "primary_use_case", "location_service_area",
  "competitive_differentiator", "mission_value_proposition", "support_onboarding",
  "brand_voice_terminology", "additional_business_knowledge",
]);

const POLICY_LANGUAGE = /\b(?:privacy|cookie|personal information|data collection|data retention|do not track|\bdnt\b|refunds?|returns?|terms of use|terms and conditions|customer(?:'s|s') responsibility|it is the customer(?:'s|s') responsibility)\b/i;
const EDITORIAL_TITLE = /\b(?:tips?|best practices?|ways to|how to|guide to|consider a|things to|ideas? for|strategies? for|what is|why you should)\b/i;
const FIRST_PARTY_CLAIM = /\b(?:we|our|us|the company|the agency|the business|the firm|the studio|the practice|the provider|the organization|the team)\b/i;
const EXPLICIT_OFFER = /\b(?:we (?:offer|provide|deliver|sell|serve|specialize)|our (?:services?|products?|offerings?)|specializ(?:e|es|ing) in|available (?:in|for)|serving|located in|based in)\b/i;
const GENERIC_PAGE_CHROME = /^(?:home|about|contact|blog|menu|services?|products?|learn more|read more|view more|order now|shop now)$/i;

function editorialEvidence(fact: DeterministicFact) {
  return fact.evidence.length > 0 && fact.evidence.every((evidence) => {
    const path = (() => {
      try { return new URL(evidence.url).pathname; } catch { return evidence.url; }
    })();
    const title = cleanText(evidence.pageTitle ?? "");
    return /\/(?:blog|news|resources?|articles?|insights?)(?:\/|$)/i.test(path) || EDITORIAL_TITLE.test(title);
  });
}

function shouldDiscard(fact: DeterministicFact) {
  const value = cleanText(fact.value);
  if (!value) return true;

  if (COMMERCIAL.has(fact.category) && POLICY_LANGUAGE.test(value)) {
    const genuinelyCommercial = EXPLICIT_OFFER.test(value) && !/\b(?:privacy|cookie|personal information|data collection|data retention|do not track|\bdnt\b)\b/i.test(value);
    if (!genuinelyCommercial) return true;
  }

  if (COMMERCIAL.has(fact.category) && editorialEvidence(fact)) {
    if (!FIRST_PARTY_CLAIM.test(value) || !EXPLICIT_OFFER.test(value)) return true;
  }

  if (fact.category === "competitive_differentiator") {
    const weakConstraint = /^(?:we only|available only|limited to|cost is based on)\b/i.test(value);
    if (weakConstraint) return true;
  }

  return false;
}

function titleCandidate(block: NormalizedSourceBlock) {
  const pageTitle = cleanText(block.evidence.pageTitle ?? "");
  const heading = cleanText(block.heading ?? "");
  const candidates = [heading, pageTitle]
    .map((value) => value.split(/\s+[|—–-]\s+/)[0]?.trim() ?? "")
    .filter((value) => value.length >= 4 && value.length <= 120 && !GENERIC_PAGE_CHROME.test(value));
  return candidates[0] ?? "";
}

function pageLooksCommercial(block: NormalizedSourceBlock) {
  if (["products", "services", "pricing", "locations", "industries", "use_cases"].includes(block.pageType)) return true;
  const signal = `${block.evidence.url} ${block.evidence.pageTitle ?? ""} ${block.heading ?? ""}`;
  if (EDITORIAL_TITLE.test(signal)) return false;
  return /\b(?:services?|products?|solutions?|pricing|packages?|offers?|menu|catalog|shop|store)\b/i.test(signal);
}

function categoryForTitle(title: string, block: NormalizedSourceBlock): Category {
  if (block.pageType === "pricing" || /\b(?:pricing|packages?|specials?|offers?)\b/i.test(title)) return "pricing_plan";
  if (block.pageType === "products" || /\b(?:products?|catalog|shop|store)\b/i.test(title)) return "product";
  return "service";
}

function makeTitleFact(block: NormalizedSourceBlock, category: Category, title: string): DeterministicFact {
  const value = title;
  const topicKey = canonicalTopicKey({ category, value, suggestedTopic: title, heading: block.heading, pageType: block.pageType });
  return {
    id: stableId("det_fact", `${topicKey}\0${keyText(value)}\0${block.evidence.url}`),
    category,
    title,
    value,
    topicKey,
    confidence: "medium",
    confidenceScore: 0,
    provenance: "website",
    evidence: [{ ...block.evidence, excerpt: block.text }],
    explicit: true,
  };
}

function addCommercialPageFacts(facts: DeterministicFact[], blocks: readonly NormalizedSourceBlock[]) {
  const additions: DeterministicFact[] = [];
  const firstBodyByUrl = new Map<string, NormalizedSourceBlock>();
  for (const block of blocks) {
    if (block.type === "heading" || block.type === "faq_question") continue;
    if (!firstBodyByUrl.has(block.evidence.url)) firstBodyByUrl.set(block.evidence.url, block);
  }

  Array.from(firstBodyByUrl.values()).forEach((block) => {
    if (!pageLooksCommercial(block)) return;
    const title = titleCandidate(block);
    if (!title) return;
    const category = categoryForTitle(title, block);
    const alreadyRepresented = facts.some((fact) => fact.category === category && fact.evidence.some((evidence) => evidence.url === block.evidence.url));
    if (!alreadyRepresented) additions.push(makeTitleFact(block, category, title));
  });
  return additions;
}

export function improveBusinessRelevance(facts: DeterministicFact[], blocks: readonly NormalizedSourceBlock[]) {
  const retained = facts.filter((fact) => !shouldDiscard(fact));
  return [...retained, ...addCommercialPageFacts(retained, blocks)];
}
