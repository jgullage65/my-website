import type { ClassifiedPageType, NormalizedSourceBlock } from "./contracts";
import { cleanText } from "./util";

export type EvidenceLane =
  | "core_business"
  | "commercial"
  | "market_customer"
  | "proof"
  | "operations"
  | "editorial"
  | "legal"
  | "technical"
  | "unknown";

export type RoutedSourceBlock = NormalizedSourceBlock & {
  evidenceLane: EvidenceLane;
  routingReasons: string[];
};

const EDITORIAL_SIGNAL = /\b(?:blog|article|news|insight|resource|guide|tips?|best practices?|ways to|how to|what is|why |ideas? for|strategies? for)\b/i;
const LEGAL_SIGNAL = /\b(?:privacy|terms|policy|policies|refund|return|cancel|cookie|personal information|data collection|data retention|do not track|\bdnt\b)\b/i;
const PROOF_SIGNAL = /\b(?:testimonial|review|case study|success stor|results?|customer stor|client stor|award|recognition)\b/i;
const COMMERCIAL_SIGNAL = /\b(?:services?|products?|pricing|packages?|plans?|offers?|menu|catalog|shop|store|solutions?|capabilities)\b/i;
const MARKET_SIGNAL = /\b(?:industries?|who we serve|customers?|clients?|audience|markets?|use cases?|solutions? for|serving)\b/i;
const OPERATIONS_SIGNAL = /\b(?:faq|support|onboarding|getting started|implementation|training|help desk|process|contact|hours?)\b/i;
const TECHNICAL_SIGNAL = /\b(?:technical|developers?|api|sdk|webhook|integration|security|compliance|soc ?2|hipaa|gdpr|iso ?27001)\b/i;
const PRICE_SIGNAL = /(?:[$£€]\s?\d|\b\d+(?:\.\d{2})\b|\b(?:price|pricing|per person|per item|per hour|per month|starting at|from only)\b)/i;
const STRUCTURED_ITEM_TYPES = new Set<NormalizedSourceBlock["type"]>(["list_item", "table_row", "table_cell", "definition"]);

function pageLane(pageType: ClassifiedPageType): EvidenceLane {
  if (["products", "services", "pricing"].includes(pageType)) return "commercial";
  if (["industries", "use_cases", "locations"].includes(pageType)) return "market_customer";
  if (["case_studies", "testimonials", "certifications"].includes(pageType)) return "proof";
  if (pageType === "policies") return "legal";
  if (["faq", "onboarding", "support", "contact"].includes(pageType)) return "operations";
  if (["technical", "integrations", "security", "compliance"].includes(pageType)) return "technical";
  if (["home", "about", "partnerships"].includes(pageType)) return "core_business";
  return "unknown";
}

function strongestSectionLane(block: NormalizedSourceBlock): { lane: EvidenceLane; reasons: string[] } {
  const signal = cleanText(`${block.heading ?? ""} ${block.evidence.pageTitle ?? ""} ${block.evidence.url}`);

  if (LEGAL_SIGNAL.test(signal)) return { lane: "legal", reasons: ["section_or_page_signals_legal"] };
  if (EDITORIAL_SIGNAL.test(signal)) return { lane: "editorial", reasons: ["section_or_page_signals_editorial"] };
  if (PROOF_SIGNAL.test(signal)) return { lane: "proof", reasons: ["section_or_page_signals_proof"] };
  if (COMMERCIAL_SIGNAL.test(signal)) return { lane: "commercial", reasons: ["section_or_page_signals_commercial"] };
  if (MARKET_SIGNAL.test(signal)) return { lane: "market_customer", reasons: ["section_or_page_signals_market_customer"] };
  if (OPERATIONS_SIGNAL.test(signal)) return { lane: "operations", reasons: ["section_or_page_signals_operations"] };
  if (TECHNICAL_SIGNAL.test(signal)) return { lane: "technical", reasons: ["section_or_page_signals_technical"] };

  return { lane: pageLane(block.pageType), reasons: [`page_type:${block.pageType}`] };
}

function structurallyCommercialUrls(blocks: readonly NormalizedSourceBlock[]) {
  const byUrl = new Map<string, NormalizedSourceBlock[]>();
  for (const block of blocks) {
    const existing = byUrl.get(block.evidence.url) ?? [];
    existing.push(block);
    byUrl.set(block.evidence.url, existing);
  }

  const commercial = new Set<string>();
  Array.from(byUrl.entries()).forEach(([url, pageBlocks]) => {
    const first = pageBlocks[0];
    if (!first || first.pageType !== "other") return;

    const pageSignal = cleanText(`${first.evidence.pageTitle ?? ""} ${url}`);
    if (LEGAL_SIGNAL.test(pageSignal) || EDITORIAL_SIGNAL.test(pageSignal) || PROOF_SIGNAL.test(pageSignal)) return;

    const body = pageBlocks.filter((block) => block.type !== "heading" && block.type !== "faq_question");
    if (!body.length) return;

    const structured = body.filter((block) => STRUCTURED_ITEM_TYPES.has(block.type));
    const prose = body.filter((block) => !STRUCTURED_ITEM_TYPES.has(block.type));
    const priceBearing = body.filter((block) => PRICE_SIGNAL.test(block.text));

    if (structured.length > prose.length || priceBearing.length > 0) commercial.add(url);
  });
  return commercial;
}

export function routeSourceBlocks(blocks: readonly NormalizedSourceBlock[]): RoutedSourceBlock[] {
  const structurallyCommercial = structurallyCommercialUrls(blocks);

  return blocks.map((block) => {
    const routed = strongestSectionLane(block);
    if (routed.lane === "unknown" && structurallyCommercial.has(block.evidence.url)) {
      return {
        ...block,
        evidenceLane: "commercial" as const,
        routingReasons: [...routed.reasons, "page_structure_catalog_or_price_bearing"],
      };
    }
    return { ...block, evidenceLane: routed.lane, routingReasons: routed.reasons };
  });
}
