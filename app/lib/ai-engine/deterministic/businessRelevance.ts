import type { DeterministicFact } from "./contracts";
import type { RoutedSourceBlock } from "./routing";
import { canonicalTopicKey } from "./topics";
import { cleanText, keyText, stableId } from "./util";

type Category = DeterministicFact["category"];

const EDITORIAL_TITLE = /\b(?:tips?|best practices?|ways to|how to|guide to|consider a|things to|ideas? for|strategies? for|what is|why you should)\b/i;
const GENERIC_PAGE_CHROME = /^(?:home|about|contact|blog|menu|services?|products?|learn more|read more|view more|order now|shop now)$/i;

function titleCandidate(block: RoutedSourceBlock) {
  const pageTitle = cleanText(block.evidence.pageTitle ?? "");
  const heading = cleanText(block.heading ?? "");
  const candidates = [heading, pageTitle]
    .map((value) => value.split(/\s+[|—–-]\s+/)[0]?.trim() ?? "")
    .filter((value) => value.length >= 4 && !GENERIC_PAGE_CHROME.test(value));
  return candidates[0] ?? "";
}

function pageLooksCommercial(block: RoutedSourceBlock) {
  if (block.evidenceLane === "commercial") return true;
  if (["products", "services", "pricing"].includes(block.pageType)) return true;
  const signal = `${block.evidence.url} ${block.evidence.pageTitle ?? ""} ${block.heading ?? ""}`;
  if (EDITORIAL_TITLE.test(signal)) return false;
  return /\b(?:services?|products?|solutions?|pricing|packages?|offers?|menu|catalog|shop|store)\b/i.test(signal);
}

function categoryForTitle(title: string, block: RoutedSourceBlock): Category {
  if (block.pageType === "pricing" || /\b(?:pricing|packages?|specials?|offers?)\b/i.test(title)) return "pricing_plan";
  if (block.pageType === "products" || /\b(?:products?|catalog|shop|store)\b/i.test(title)) return "product";
  return "service";
}

function makeTitleFact(block: RoutedSourceBlock, category: Category, title: string): DeterministicFact {
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

function addCommercialPageFacts(facts: readonly DeterministicFact[], blocks: readonly RoutedSourceBlock[]) {
  const additions: DeterministicFact[] = [];
  const firstBodyByUrl = new Map<string, RoutedSourceBlock>();
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

export function recoverCommercialPageFacts(facts: readonly DeterministicFact[], blocks: readonly RoutedSourceBlock[]) {
  return [...facts, ...addCommercialPageFacts(facts, blocks)];
}
