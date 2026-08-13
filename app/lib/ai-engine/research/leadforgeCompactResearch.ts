import { crawlBusinessWebsite, resolveCrawledBusinessName } from "@/app/lib/ai-engine/crawler/crawlBusinessWebsite";
import { persistWebsiteSourceRecords } from "@/app/lib/ai-engine/crawler/websiteSourceRecordStore";
import { buildDeterministicBusinessBrain } from "@/app/lib/ai-engine/deterministic";
import type { DeterministicEngineResult } from "@/app/lib/ai-engine/deterministic/contracts";
import type { WebsiteKnowledgeFact } from "@/app/lib/ai-engine/knowledge/websiteKnowledge";

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const chromeExact = /^(?:skip to (?:main )?content|home|about|about us|services|products|blog|contact|contact us|book now|new patients|menu|close menu|back to top|privacy policy|terms of use|all rights reserved|learn more|read more)$/i;
const navWords = /\b(?:home|about|provider|blog|services|products|contact|book now|new patients|privacy policy|terms of use)\b/gi;

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

function cleanDeterministicFacts(result: DeterministicEngineResult): WebsiteKnowledgeFact[] {
  const seen = new Set<string>();
  return result.websiteKnowledge.facts.filter((fact) => {
    if (looksLikeChrome(fact.title) || looksLikeChrome(fact.value)) return false;
    if (fact.value.length > 900 && (fact.value.match(navWords)?.length ?? 0) >= 3) return false;
    const key = `${fact.category}\u0000${normalizeText(fact.title).toLowerCase()}\u0000${normalizeText(fact.value).toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function deterministicSummary(
  facts: WebsiteKnowledgeFact[],
  categories: WebsiteKnowledgeFact["category"][],
  maximum = 4,
) {
  return facts
    .filter((fact) => categories.includes(fact.category))
    .slice(0, maximum)
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
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      const started = performance.now();

      try {
        send({ type: "progress", percent: 5 });
        const crawl = await crawlBusinessWebsite(
          website,
          (pagesCrawled, pagesDiscovered) => {
            send({ type: "crawl_progress", pagesCrawled, pagesDiscovered });
          },
        );

        await persistWebsiteSourceRecords(
          crawl.crawlAttempt,
          crawl.sourceDocuments,
          crawl.sourceBlocks,
        );

        send({
          type: "crawl_complete",
          pagesCrawled: crawl.diagnostics.pagesRetained,
          pagesDiscovered: crawl.diagnostics.pagesDiscovered,
        });
        send({ type: "progress", percent: 72 });

        const deterministicStarted = performance.now();
        const deterministic = buildDeterministicBusinessBrain({
          pages: crawl.pages.map((page) => ({
            ...page,
            crawlAttemptId: crawl.crawlAttempt.id,
          })),
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
        const industry = deterministicSummary(
          facts,
          ["industry_served", "company_overview"],
          2,
        );
        const productsServices = deterministicSummary(
          facts,
          ["product", "service", "primary_use_case"],
          5,
        );
        const idealCustomers = deterministicSummary(
          facts,
          ["customer_segment", "industry_served"],
          4,
        );
        const additionalKnowledge = deterministicSummary(
          facts,
          [
            "competitive_differentiator",
            "pricing_plan",
            "location_service_area",
            "certification",
            "faq",
          ],
          5,
        );

        const timings = {
          ...crawl.diagnostics.timings,
          deterministicKnowledgeMs: deterministicMs,
          aiKnowledgeExtractionMs: 0,
          totalDurationMs: performance.now() - started,
        };

        console.info("LEADFORGE_DETERMINISTIC_ONLY_RESULT", {
          crawlAttemptId: crawl.crawlAttempt.id,
          sourceBlockCount: crawl.sourceBlocks.length,
          availableSourceCharacters: crawl.sourceBlocks.reduce(
            (total, block) => total + block.normalizedText.length,
            0,
          ),
          deterministicFacts: deterministic.facts.length,
          cleanDeterministicFacts: facts.length,
          discardedDeterministicFacts: deterministic.facts.length - facts.length,
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
            tokens: {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
            },
            estimatedCostUsd: {
              input: 0,
              output: 0,
              total: 0,
            },
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
          error: {
            code: "website_import_failed",
            message: "Website research could not be completed.",
          },
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
