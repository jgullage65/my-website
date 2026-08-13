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

export function routeSourceBlocks(blocks: readonly NormalizedSourceBlock[]): RoutedSourceBlock[] {
  return blocks.map((block) => {
    const routed = strongestSectionLane(block);
    return { ...block, evidenceLane: routed.lane, routingReasons: routed.reasons };
  });
}
