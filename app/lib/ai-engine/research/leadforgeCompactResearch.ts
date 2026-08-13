import { crawlBusinessWebsite, resolveCrawledBusinessName } from "@/app/lib/ai-engine/crawler/crawlBusinessWebsite";
import { persistWebsiteSourceRecords } from "@/app/lib/ai-engine/crawler/websiteSourceRecordStore";
import { buildDeterministicBusinessBrain } from "@/app/lib/ai-engine/deterministic";
import type { DeterministicEngineResult } from "@/app/lib/ai-engine/deterministic/contracts";
import type { WebsiteKnowledgeFact } from "@/app/lib/ai-engine/knowledge/websiteKnowledge";

function normalizeText(value: unknown): string {
  return String(value ?? "").replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
}

const chromeExact = /^(?:skip to (?:main )?content|home|about|about us|services|products|blog|contact|contact us|book now|new patients|menu|close menu|back to top|privacy policy|terms of use|all rights reserved|learn more|read more)$/i;
const navWords = /\b(?:home|about|provider|blog|services|products|contact|book now|new patients|privacy policy|terms of use)\b/gi;
const legalTrackingText = /\b(?:privacy policy|terms of use|personal information|personally identifiable|ip address|general location|cookies?|pixels?|advertisers?|advertising|third[- ]party sites?|third[- ]party service|services usage|data collection|data retention|opt[- ]out|deletion request|marketing purposes?|browser information|device information|tracking technolog|do not track|\bdnt\b|consumer privacy|ccpa|share your information|online actions|user experience|data on our behalf)\b/i;
const instructionalAdvice = /\b(?:other party(?:'s)?|insurance card|report (?:the )?(?:incident|accident)|call (?:the )?police|consult an attorney|protect (?:your|their) rights|exchange information|identify the other party|seek (?:medical )?care|document the scene|take photos)\b/i;
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
  if (navMatches >= 6 && text.length > 160) return true;
  if (text.length > 500 && navMatches >= 4 && /\b(?:folder:|book now|leave a review|all rights reserved)\b/i.test(text)) return true;
  return false;
}

function factPageTypes(fact: WebsiteKnowledgeFact): string[] {
  const evidence = Array.isArray(fact.evidence) ? fact.evidence : [];
  return evidence
    .map((item) => normalizeText((item as { pageType?: unknown }).pageType).toLowerCase())
    .filter(Boolean);
}

function factHasBusinessSubject(category: WebsiteKnowledgeFact["category"], value: string): boolean {
  if (category === "pricing_plan") {
    return /(?:[$£€]\s?\d|\bfree\b)/i.test(value) && /\b(?:special|offer|promotion|price|pricing|discount|consultation|visit|session|plan|package)\b/i.test(value);
  }
  if (category === "service") {
    return /\b(?:practice|clinic|company|agency|we|our|provider|offers?|provides?|specializes?|therapy|treatment|care|consulting|implementation|chiropractic|spinal decompression|auto accident injury)\b/i.test(value);
  }
  if (category === "primary_use_case") {
    return /\b(?:pain|injur|sciatica|numbness|tingling|whiplash|disc|stenosis|condition|patient|client|customer|treat|relief|use case)\b/i.test(value);
  }
  if (category === "location_service_area") {
    return /\b(?:located in|based in|serves?|serving|available in|office in|practice in|clinic in|surrounding area|surrounding areas|service area|nationwide|worldwide)\b/i.test(value);
  }
  if (category === "certification") {
    return /\b(?:licensed|license|certified|certification|degree|accredited|accreditation|board[- ]certified)\b/i.test(value);
  }
  if (category === "support_onboarding") {
    return /\b(?:new patient|new client|first visit|day\s*[12]|evaluation|consultation|x-?ray|review(?: of)? findings|roadmap|treatment plan|onboarding|implementation|training)\b/i.test(value);
  }
  if (category === "faq") {
    return /\b(?:faq|insurance|ppo|hsa|fsa|candidate|how long|safe|first visit|first day|prior surgery|what conditions|do you accept|can i|who is)\b/i.test(value);
  }
  if (category === "additional_business_knowledge") {
    return /\b(?:review|testimonial|recommend|customer service|patient|client|customer|life-changing|worked wonders|helped me|results?)\b/i.test(value);
  }
  if (category === "competitive_differentiator") {
    return /\b(?:unique|over a decade|experience|advanced|proven|above and beyond|best results|award|specializ)\b/i.test(value);
  }
  if (category === "mission_value_proposition") {
    return /\b(?:mission|core values|philosophy|approach|repair|recover|remodel|we believe|we exist)\b/i.test(value);
  }
  if (category === "customer_segment") {
    return /\b(?:patients?|customers?|clients?|businesses?|teams?|people with|serving)\b/i.test(value);
  }
  if (category === "company_overview") {
    return /\b(?:practice|clinic|company|agency|studio|business|provider|we are|our company|our team|specializes?)\b/i.test(value);
  }
  if (category === "brand_voice_terminology") {
    return /\b(?:core values|healing journey|recovery roadmap|our approach|our method|our framework|we call|known as)\b/i.test(value);
  }
  return true;
}

function isCommercialContamination(fact: WebsiteKnowledgeFact, value: string) {
  if (!commercialCategories.has(fact.category)) return false;
  if (legalTrackingText.test(value) || instructionalAdvice.test(value)) return true;
  const pageTypes = factPageTypes(fact);
  if (pageTypes.length && pageTypes.every((pageType) => legalPageTypes.has(pageType))) return true;
  return !factHasBusinessSubject(fact.category, value);
}

function fragments(value: string) {
  return value
    .split(/\b(?:TESTIMONIALS|Privacy Policy|Terms of Use|All Rights Reserved|LEAVE A REVIEW|BOOK NOW|Read More Reviews)\b/gi)
    .flatMap((part) => part.split(/(?<=[.!?])\s+/))
    .map(normalizeText)
    .filter((part) => part.length >= 12);
}

function fragmentScore(category: WebsiteKnowledgeFact["category"], value: string) {
  let score = 0;
  if (!factHasBusinessSubject(category, value)) return -100;
  if (category === "pricing_plan" && /(?:[$£€]\s?\d|\b(?:special|offer|promotion|pricing|price|discount|free)\b)/i.test(value)) score += 24;
  if (category === "service" && /\b(?:offer|provide|specializ|therapy|treatment|care|consulting|implementation|chiropractic|decompression)\b/i.test(value)) score += 22;
  if (category === "primary_use_case" && /\b(?:pain|injur|sciatica|numbness|tingling|whiplash|disc|stenosis|helps?|treat|relief)\b/i.test(value)) score += 22;
  if (category === "location_service_area" && /\b(?:located in|based in|serve|serving|available in|surrounding|service area|practice in|clinic in)\b/i.test(value)) score += 24;
  if (category === "certification" && /\b(?:licensed|license|certified|degree|accredited|board[- ]certified)\b/i.test(value)) score += 24;
  if (category === "support_onboarding" && /\b(?:new patient|day\s*[12]|first visit|evaluation|consultation|x-?ray|review findings|roadmap|treatment plan)\b/i.test(value)) score += 22;
  if (category === "faq" && /\b(?:faq|insurance|ppo|hsa|fsa|candidate|how long|safe|first visit|prior surgery)\b/i.test(value)) score += 22;
  if (category === "additional_business_knowledge" && /\b(?:review|testimonial|recommend|customer service|life-changing|worked wonders|helped me|results?)\b/i.test(value)) score += 22;
  if (category === "competitive_differentiator" && /\b(?:unique|over a decade|experience|advanced|proven|above and beyond|best results)\b/i.test(value)) score += 22;
  if (category === "mission_value_proposition" && /\b(?:mission|core values|philosophy|approach|repair|recover|remodel)\b/i.test(value)) score += 20;
  if (category === "customer_segment" && /\b(?:patients?|customers?|clients?|people with|serving)\b/i.test(value)) score += 18;
  if (category === "company_overview" && /\b(?:practice|clinic|company|agency|studio|business|provider|specializes?)\b/i.test(value)) score += 18;
  if (legalTrackingText.test(value) || instructionalAdvice.test(value)) score -= 100;
  if (looksLikeChrome(value)) score -= 100;
  if (value.length <= 260) score += 8;
  else if (value.length <= 420) score += 3;
  else score -= 10;
  return score;
}

function compactCommercialValue(fact: WebsiteKnowledgeFact): string | null {
  const original = normalizeText(fact.value);
  if (!commercialCategories.has(fact.category)) return original;

  const candidates = fragments(original)
    .filter((part) => !legalTrackingText.test(part) && !instructionalAdvice.test(part) && !looksLikeChrome(part))
    .map((part) => ({ part, score: fragmentScore(fact.category, part) }))
    .filter((candidate) => candidate.score >= 10)
    .sort((a, b) => b.score - a.score || a.part.length - b.part.length);

  const best = candidates[0];
  if (!best) return null;
  if (best.part.length > 420) return null;
  return best.part;
}

function cleanFactTitle(fact: WebsiteKnowledgeFact, value: string) {
  const title = normalizeText(fact.title);
  const weakTitle = /^(?:company|service|services|faq|pricing|pricing or offer|customer segment|primary use case|location or service area|process or onboarding|competitive differentiator|customer proof)$/i;
  if (title && title.length <= 72 && !looksLikeChrome(title) && !title.endsWith(" hi") && !weakTitle.test(title)) return title;

  if (fact.category === "company_overview") return "Business overview";
  if (fact.category === "pricing_plan") return /new patient/i.test(value) ? "New patient offer" : "Pricing or offer";
  if (fact.category === "service") return /spinal decompression/i.test(value) ? "Spinal decompression" : /auto accident/i.test(value) ? "Auto accident injury care" : "Service";
  if (fact.category === "primary_use_case") return "Primary use case";
  if (fact.category === "location_service_area") return "Service area";
  if (fact.category === "certification") return "Credential";
  if (fact.category === "support_onboarding") return "Customer process";
  if (fact.category === "faq") return /insurance|ppo|hsa|fsa/i.test(value) ? "Insurance and payment FAQ" : "FAQ";
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
    if (leftMoney.some((amount) => rightMoney.includes(amount)) && /new patient|special|promotion|offer/i.test(left.value) && /new patient|special|promotion|offer/i.test(right.value)) return true;
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
    if (fact.value.length > 900 && (fact.value.match(navWords)?.length ?? 0) >= 3) continue;
    if (isCommercialContamination(fact, normalizeText(fact.value))) continue;

    const value = compactCommercialValue(fact);
    if (!value) continue;

    const normalized: WebsiteKnowledgeFact = {
      ...fact,
      title: cleanFactTitle(fact, value),
      value,
    };

    if (cleaned.some((existing) => sameCommercialConcept(existing, normalized))) continue;
    cleaned.push(normalized);
  }
  return cleaned;
}

function deterministicSummary(facts: WebsiteKnowledgeFact[], categories: WebsiteKnowledgeFact["category"][], maximum = 4) {
  return facts.filter((fact) => categories.includes(fact.category)).slice(0, maximum).map((fact) => fact.value).join(" ");
}

export async function runLeadForgeCompactResearchRequest(request: Request) {
  let body: { website?: unknown };
  try {
    body = await request.json() as { website?: unknown };
  } catch {
    return Response.json({ ok: false, error: { code: "invalid_json", message: "The request body must be valid JSON." } }, { status: 400 });
  }

  const website = normalizeText(body.website);
  if (!website) {
    return Response.json({ ok: false, error: { code: "website_required", message: "A website is required." } }, { status: 400 });
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
        const industry = deterministicSummary(facts, ["industry_served", "company_overview"], 2);
        const productsServices = deterministicSummary(facts, ["product", "service", "primary_use_case"], 5);
        const idealCustomers = deterministicSummary(facts, ["customer_segment", "industry_served"], 4);
        const additionalKnowledge = deterministicSummary(facts, ["competitive_differentiator", "pricing_plan", "location_service_area", "certification", "faq"], 5);
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
          pages: crawl.pages.map((page) => ({ url: page.url, title: page.title, pageType: page.pageType, sourceDocumentId: page.sourceDocumentId })),
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
        send({ type: "error", error: { code: "website_import_failed", message: "Website research could not be completed." } });
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
