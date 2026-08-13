import { crawlBusinessWebsite, resolveCrawledBusinessName } from "@/app/lib/ai-engine/crawler/crawlBusinessWebsite";
import { persistWebsiteSourceRecords } from "@/app/lib/ai-engine/crawler/websiteSourceRecordStore";
import { buildDeterministicBusinessBrain } from "@/app/lib/ai-engine/deterministic";
import type { DeterministicEngineResult } from "@/app/lib/ai-engine/deterministic/contracts";
import type { WebsiteKnowledgeFact } from "@/app/lib/ai-engine/knowledge/websiteKnowledge";

function normalizeText(value: unknown): string {
  return String(value ?? "").replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
}

const chromeExact = /^(?:skip to (?:main )?content|home|about|about us|services|products|blog|contact|contact us|menu|close menu|back to top|privacy policy|terms of use|all rights reserved|learn more|read more)$/i;
const navWords = /\b(?:home|about|blog|services|products|contact|privacy policy|terms of use)\b/gi;
const legalTrackingText = /\b(?:privacy policy|terms of use|personal information|personally identifiable|ip address|cookies?|pixels?|advertisers?|advertising partners?|third[- ]party sites?|third[- ]party service|services usage|data collection|data retention|opt[- ]out|deletion request|browser information|device information|tracking technolog|do not track|\bdnt\b|consumer privacy|share your information|online actions|data on our behalf)\b/i;
const instructionalOrThirdPartyText = /\b(?:other party(?:'s)?|third party(?:'s)?|exchange information|consult (?:an|a) (?:attorney|lawyer|advisor)|report the incident|document the scene|take photos|call the authorities)\b/i;
const legalPageTypes = new Set(["policies", "security", "compliance"]);
const commercialCategories = new Set<WebsiteKnowledgeFact["category"]>([
  "company_overview",
  "pricing_plan",
  "product",
  "service",
  "feature_capability",
  "customer_segment",
  "industry_served",
  "primary_use_case",
  "location_service_area",
  "competitive_differentiator",
  "mission_value_proposition",
  "certification",
  "support_onboarding",
  "brand_voice_terminology",
  "additional_business_knowledge",
  "faq",
]);

function looksLikeChrome(value: unknown): boolean {
  const text = normalizeText(value);
  if (!text) return true;
  if (chromeExact.test(text)) return true;
  if (/^\d*\s*skip to (?:main )?content\b/i.test(text)) return true;
  if (/\b(?:cookie settings|privacy preferences|accept all cookies|accessibility menu)\b/i.test(text)) return true;
  const navMatches = text.match(navWords)?.length ?? 0;
  return navMatches >= 6 && /\b(?:privacy policy|terms of use|all rights reserved)\b/i.test(text);
}

function factPageTypes(fact: WebsiteKnowledgeFact): string[] {
  const evidence = Array.isArray(fact.evidence) ? fact.evidence : [];
  return evidence
    .map((item) => normalizeText((item as { pageType?: unknown }).pageType).toLowerCase())
    .filter(Boolean);
}

function factHasBusinessSubject(category: WebsiteKnowledgeFact["category"], value: string): boolean {
  if (category === "pricing_plan") {
    return /(?:[$£€]\s?\d|\bfree\b)/i.test(value) && /\b(?:special|offer|promotion|price|pricing|discount|trial|plan|package|tier|subscription|membership|rate|fee)\b/i.test(value);
  }
  if (category === "service") {
    return /\b(?:we|our|business|company|agency|firm|studio|team|provider|offers?|provides?|delivers?|specializes?|consulting|implementation|management|design|development|marketing|support|maintenance|training|professional services?)\b/i.test(value);
  }
  if (category === "primary_use_case") {
    return /\b(?:helps?|used (?:to|for)|designed to|built to|enables?|solves?|supports?|improves?|reduces?|increases?|manages?|automates?|creates?|tracks?|connects?|analyzes?|monitors?)\b/i.test(value);
  }
  if (category === "location_service_area") {
    return /\b(?:located in|based in|serves?|serving|available in|available throughout|office in|service area|surrounding area|region|nationwide|worldwide)\b/i.test(value);
  }
  if (category === "certification") {
    return /\b(?:licensed|license|certified|certification|credential|accredited|accreditation|registered|award(?:ed)?)\b/i.test(value);
  }
  if (category === "support_onboarding") {
    return /\b(?:onboarding|implementation|training|getting started|first meeting|initial assessment|consultation|discovery call|kickoff|setup|installation|follow[- ]up|review|roadmap|support process)\b/i.test(value);
  }
  if (category === "faq") {
    return /\b(?:faq|frequently asked|how long|how much|who is|can i|can we|do you|what happens|what is included|how does|when should|what should|is .* available)\b/i.test(value);
  }
  if (category === "additional_business_knowledge") {
    return /\b(?:review|testimonial|recommend|customer service|client|customer|user|case study|results?|success|outcome|rating|stars?)\b/i.test(value);
  }
  if (category === "competitive_differentiator") {
    return /\b(?:unique|experience|advanced|proven|above and beyond|best results|award|specializ|proprietary|exclusive|only|faster|better|leading)\b/i.test(value);
  }
  if (category === "mission_value_proposition") {
    return /\b(?:mission|core values|philosophy|approach|we believe|we exist|our purpose|our goal|our vision|value proposition)\b/i.test(value);
  }
  if (category === "customer_segment") {
    return /\b(?:customers?|clients?|users?|businesses?|companies|organizations?|teams?|professionals?|people who|serving|built for|designed for)\b/i.test(value);
  }
  if (category === "company_overview") {
    return /\b(?:company|agency|firm|studio|business|organization|provider|we are|our company|our team|specializes?|founded|established)\b/i.test(value);
  }
  if (category === "brand_voice_terminology") {
    return /\b(?:core values|our approach|our method|our framework|we call|known as|referred to as|signature process|named framework|proprietary method)\b/i.test(value);
  }
  return true;
}

function isCommercialContamination(fact: WebsiteKnowledgeFact, value: string) {
  if (!commercialCategories.has(fact.category)) return false;
  if (legalTrackingText.test(value) || instructionalOrThirdPartyText.test(value)) return true;
  const pageTypes = factPageTypes(fact);
  if (pageTypes.length && pageTypes.every((pageType) => legalPageTypes.has(pageType))) return true;
  return !factHasBusinessSubject(fact.category, value);
}

function fragments(value: string) {
  return value
    .split(/\b(?:TESTIMONIALS|REVIEWS|Privacy Policy|Terms of Use|All Rights Reserved|LEAVE A REVIEW|READ MORE REVIEWS)\b/gi)
    .flatMap((part) => part.split(/(?<=[.!?])\s+/))
    .map(normalizeText)
    .filter(Boolean);
}

function fragmentScore(category: WebsiteKnowledgeFact["category"], value: string) {
  if (!factHasBusinessSubject(category, value)) return Number.NEGATIVE_INFINITY;
  if (legalTrackingText.test(value) || instructionalOrThirdPartyText.test(value) || looksLikeChrome(value)) return Number.NEGATIVE_INFINITY;

  let score = 0;
  if (category === "pricing_plan" && /(?:[$£€]\s?\d|\b(?:special|offer|promotion|pricing|price|discount|free|trial|plan|package|subscription|membership)\b)/i.test(value)) score += 24;
  if (category === "service" && /\b(?:offer|provide|deliver|specializ|consulting|implementation|management|design|development|marketing|support|maintenance|training|professional service)\b/i.test(value)) score += 22;
  if (category === "primary_use_case" && /\b(?:helps?|used (?:to|for)|designed to|built to|enables?|solves?|supports?|improves?|reduces?|increases?|manages?|automates?|creates?|tracks?|connects?|analyzes?|monitors?)\b/i.test(value)) score += 22;
  if (category === "location_service_area" && /\b(?:located in|based in|serve|serving|available in|available throughout|service area|region|nationwide|worldwide)\b/i.test(value)) score += 24;
  if (category === "certification" && /\b(?:licensed|license|certified|certification|credential|accredited|registered|award)\b/i.test(value)) score += 24;
  if (category === "support_onboarding" && /\b(?:onboarding|implementation|training|getting started|first meeting|initial assessment|consultation|discovery call|kickoff|setup|installation|follow[- ]up|roadmap)\b/i.test(value)) score += 22;
  if (category === "faq" && /\b(?:faq|frequently asked|how long|how much|who is|can i|can we|do you|what happens|what is included|how does|when should|what should)\b/i.test(value)) score += 22;
  if (category === "additional_business_knowledge" && /\b(?:review|testimonial|recommend|customer service|case study|results?|success|outcome|rating|stars?)\b/i.test(value)) score += 22;
  if (category === "competitive_differentiator" && /\b(?:unique|experience|advanced|proven|above and beyond|best results|award|specializ|proprietary|exclusive|only|leading)\b/i.test(value)) score += 22;
  if (category === "mission_value_proposition" && /\b(?:mission|core values|philosophy|approach|we believe|we exist|our purpose|our goal|our vision)\b/i.test(value)) score += 20;
  if (category === "customer_segment" && /\b(?:customers?|clients?|users?|businesses?|companies|organizations?|teams?|professionals?|serving|built for|designed for)\b/i.test(value)) score += 18;
  if (category === "company_overview" && /\b(?:company|agency|firm|studio|business|organization|provider|we are|our company|our team|founded|established)\b/i.test(value)) score += 18;
  return score;
}

function compactCommercialValue(fact: WebsiteKnowledgeFact): string | null {
  const original = normalizeText(fact.value);
  if (!commercialCategories.has(fact.category)) return original;
  if (isCommercialContamination(fact, original)) return null;

  const candidates = fragments(original)
    .map((part) => ({ part, score: fragmentScore(fact.category, part) }))
    .filter((candidate) => Number.isFinite(candidate.score))
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.part ?? null;
}

function cleanFactTitle(fact: WebsiteKnowledgeFact) {
  const title = normalizeText(fact.title);
  const weakTitle = /^(?:company|service|services|faq|pricing|pricing or offer|customer segment|primary use case|location or service area|process or onboarding|competitive differentiator|customer proof)$/i;
  if (title && !looksLikeChrome(title) && !weakTitle.test(title)) return title;

  if (fact.category === "company_overview") return "Business overview";
  if (fact.category === "pricing_plan") return "Pricing or offer";
  if (fact.category === "service") return "Service";
  if (fact.category === "primary_use_case") return "Primary use case";
  if (fact.category === "location_service_area") return "Service area";
  if (fact.category === "certification") return "Credential or certification";
  if (fact.category === "support_onboarding") return "Customer process";
  if (fact.category === "faq") return "FAQ";
  if (fact.category === "additional_business_knowledge") return "Customer proof";
  if (fact.category === "competitive_differentiator") return "Differentiator";
  if (fact.category === "mission_value_proposition") return "Positioning";
  if (fact.category === "customer_segment") return "Customer segment";
  return title || fact.category.replace(/_/g, " ");
}

function comparableWords(value: string) {
  return new Set(normalizeText(value).toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 4));
}

function moneyMarkers(value: string) {
  return normalizeText(value).match(/[$£€]\s?\d+(?:\.\d+)?/g)?.map((item) => item.replace(/\s+/g, "")) ?? [];
}

function sameCommercialConcept(left: WebsiteKnowledgeFact, right: WebsiteKnowledgeFact) {
  if (left.category !== right.category) return false;
  if (left.category === "pricing_plan") {
    const leftMoney = moneyMarkers(left.value);
    const rightMoney = moneyMarkers(right.value);
    if (
      leftMoney.some((amount) => rightMoney.includes(amount)) &&
      /special|promotion|offer|plan|package|subscription|membership|trial/i.test(left.value) &&
      /special|promotion|offer|plan|package|subscription|membership|trial/i.test(right.value)
    ) return true;
  }

  const leftText = normalizeText(left.value).toLowerCase();
  const rightText = normalizeText(right.value).toLowerCase();
  if (leftText === rightText || leftText.includes(rightText) || rightText.includes(leftText)) return true;

  const leftWords = comparableWords(leftText);
  const rightWords = comparableWords(rightText);
  if (!leftWords.size || !rightWords.size) return false;
  let overlap = 0;
  leftWords.forEach((word) => {
    if (rightWords.has(word)) overlap += 1;
  });
  return overlap / Math.min(leftWords.size, rightWords.size) >= 0.72;
}

function cleanDeterministicFacts(result: DeterministicEngineResult): WebsiteKnowledgeFact[] {
  const cleaned: WebsiteKnowledgeFact[] = [];
  for (const fact of result.websiteKnowledge.facts) {
    if (looksLikeChrome(fact.title) || looksLikeChrome(fact.value)) continue;
    if (isCommercialContamination(fact, normalizeText(fact.value))) continue;

    const value = compactCommercialValue(fact);
    if (!value) continue;

    const normalized: WebsiteKnowledgeFact = {
      ...fact,
      title: cleanFactTitle(fact),
      value,
    };

    if (cleaned.some((existing) => sameCommercialConcept(existing, normalized))) continue;
    cleaned.push(normalized);
  }
  return cleaned;
}

function deterministicSummary(
  facts: WebsiteKnowledgeFact[],
  categories: WebsiteKnowledgeFact["category"][],
) {
  return facts
    .filter((fact) => categories.includes(fact.category))
    .map((fact) => fact.value)
    .join(" ");
}

export async function runLeadForgeCompactResearchRequest(request: Request) {
  let body: { website?: unknown };
  try {
    body = await request.json() as { website?: unknown };
  } catch {
    return Response.json(
      { ok: false, error: { code: "invalid_json", message: "The request body must be valid JSON." } },
      { status: 400 },
    );
  }

  const website = normalizeText(body.website);
  if (!website) {
    return Response.json(
      { ok: false, error: { code: "website_required", message: "A website is required." } },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      const started = performance.now();
      try {
        send({ type: "progress", percent: 5 });
        const crawl = await crawlBusinessWebsite(
          website,
          (pagesCrawled, pagesDiscovered) => send({ type: "crawl_progress", pagesCrawled, pagesDiscovered }),
        );
        await persistWebsiteSourceRecords(crawl.crawlAttempt, crawl.sourceDocuments, crawl.sourceBlocks);
        send({ type: "crawl_complete", pagesCrawled: crawl.diagnostics.pagesRetained, pagesDiscovered: crawl.diagnostics.pagesDiscovered });
        send({ type: "progress", percent: 72 });

        const deterministicStarted = performance.now();
        const deterministic = buildDeterministicBusinessBrain({
          pages: crawl.pages.map((page) => ({ ...page, crawlAttemptId: crawl.crawlAttempt.id })),
          sourceDocuments: crawl.sourceDocuments,
          sourceBlocks: crawl.sourceBlocks,
        });
        const deterministicMs = performance.now() - deterministicStarted;
        const facts = cleanDeterministicFacts(deterministic);
        send({ type: "progress", percent: 94 });

        const knowledge = {
          facts,
          coverage: deterministic.websiteKnowledge.coverage,
          unresolvedQuestions: deterministic.websiteKnowledge.unresolvedQuestions,
        };
        const businessName = resolveCrawledBusinessName(undefined, crawl);
        const industry = deterministicSummary(facts, ["industry_served", "company_overview"]);
        const productsServices = deterministicSummary(facts, ["product", "service", "primary_use_case"]);
        const idealCustomers = deterministicSummary(facts, ["customer_segment", "industry_served"]);
        const additionalKnowledge = deterministicSummary(facts, ["competitive_differentiator", "pricing_plan", "location_service_area", "certification", "faq"]);
        const categoryCounts = facts.reduce<Record<string, number>>((counts, fact) => {
          counts[fact.category] = (counts[fact.category] ?? 0) + 1;
          return counts;
        }, {});
        const timings = {
          ...crawl.diagnostics.timings,
          deterministicKnowledgeMs: deterministicMs,
          aiKnowledgeExtractionMs: 0,
          totalDurationMs: performance.now() - started,
        };

        console.info("LEADFORGE_DETERMINISTIC_ONLY_RESULT", {
          crawlAttemptId: crawl.crawlAttempt.id,
          sourceBlockCount: crawl.sourceBlocks.length,
          availableSourceCharacters: crawl.sourceBlocks.reduce((total, block) => total + block.normalizedText.length, 0),
          deterministicFacts: deterministic.facts.length,
          cleanDeterministicFacts: facts.length,
          discardedDeterministicFacts: deterministic.facts.length - facts.length,
          categoryCounts,
          aiCalls: 0,
          inputTokens: 0,
          outputTokens: 0,
          estimatedCostUsd: 0,
          deterministicMs,
          totalDurationMs: timings.totalDurationMs,
        });

        send({ type: "progress", percent: 100 });
        send({
          type: "result",
          ok: true,
          import: {
            businessName,
            industry,
            website: crawl.resolvedUrl,
            requestedUrl: crawl.requestedUrl,
            resolvedUrl: crawl.resolvedUrl,
            productsServices,
            idealCustomers,
            additionalKnowledge,
          },
          knowledge,
          pages: crawl.pages.map((page) => ({
            url: page.url,
            title: page.title,
            pageType: page.pageType,
            sourceDocumentId: page.sourceDocumentId,
          })),
          warnings: crawl.warnings,
          sourceDocuments: crawl.sourceDocuments,
          sourceBlocks: crawl.sourceBlocks,
          crawlAttemptId: crawl.crawlAttempt.id,
          timings,
          diagnostics: crawl.diagnostics,
          usage: {
            model: "deterministic-only",
            aiCalls: 0,
            extractionUnits: 0,
            tokens: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            estimatedCostUsd: { input: 0, output: 0, total: 0 },
            semanticReview: {
              mode: "disabled_for_deterministic_benchmark",
              deterministicFacts: deterministic.facts.length,
              cleanDeterministicFacts: facts.length,
              semanticFactsAdded: 0,
            },
          },
        });
        controller.close();
      } catch (error) {
        console.error("LEADFORGE_DETERMINISTIC_RESEARCH_FAILED", {
          website,
          message: error instanceof Error ? error.message : String(error),
        });
        send({
          type: "error",
          error: { code: "website_import_failed", message: "Website research could not be completed." },
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
    },
  });
}