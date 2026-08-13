import { crawlBusinessWebsite, resolveCrawledBusinessName } from "@/app/lib/ai-engine/crawler/crawlBusinessWebsite";
import { locateWebsiteEvidence } from "@/app/lib/ai-engine/crawler/websiteSourceRecords";
import { persistWebsiteSourceRecords } from "@/app/lib/ai-engine/crawler/websiteSourceRecordStore";
import { buildDeterministicBusinessBrain } from "@/app/lib/ai-engine/deterministic";
import type { DeterministicEngineResult } from "@/app/lib/ai-engine/deterministic/contracts";
import { runModel } from "@/app/lib/ai-engine/models/runModel";
import { estimateAiTokenCost } from "@/app/lib/telemetry/ai-pricing";
import {
  WEBSITE_KNOWLEDGE_CATEGORIES,
  websiteFactIdentity,
  type WebsiteKnowledgeFact,
} from "@/app/lib/ai-engine/knowledge/websiteKnowledge";

const MAX_SEMANTIC_FACTS = 14;
const MAX_EVIDENCE_PER_PAGE = 3;
const MAX_SELECTED_EVIDENCE = 20;
const MAX_EVIDENCE_EXCERPT_CHARACTERS = 520;

const semanticSchema = {
  type: "object",
  additionalProperties: false,
  required: ["businessName", "industry", "facts"],
  properties: {
    businessName: { type: "string" },
    industry: { type: "string" },
    facts: {
      type: "array",
      maxItems: MAX_SEMANTIC_FACTS,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "title", "value", "confidence", "evidence"],
        properties: {
          category: { type: "string", enum: WEBSITE_KNOWLEDGE_CATEGORIES },
          title: { type: "string" },
          value: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          evidence: {
            type: "array",
            minItems: 1,
            maxItems: 3,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["sourceBlockId", "excerpt"],
              properties: {
                sourceBlockId: { type: "string" },
                excerpt: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
} as const;

const semanticInstructions = [
  "You are the semantic gap-review stage for LeadForge website research.",
  "A deterministic engine has already extracted, classified, deduplicated, conflict-checked, and confidence-scored the website.",
  "You are not the primary extractor and you are not summarizing the website.",
  "The input contains compact existing fact identities and a curated set of clean evidence fragments from the crawled pages.",
  "Add only useful business facts that are clearly supported by the supplied evidence and materially missing or underspecified in the existing facts.",
  "Prioritize services and products, pricing or offers, customer segments, service areas, differentiators, proof, credentials, FAQs, and other commercially meaningful details.",
  "Do not repeat, paraphrase, or repackage an existing fact.",
  "Do not infer from general industry knowledge.",
  "Do not turn navigation, page chrome, menus, footers, or generic legal boilerplate into facts.",
  "Every added fact must cite a supplied sourceBlockId and a short exact excerpt from that evidence fragment.",
  "businessName and industry should be concise identity fields supported by the supplied material.",
  `Return no more than ${MAX_SEMANTIC_FACTS} additional facts.`,
  "Return JSON only matching the schema.",
].join(" ");

const categorySet = new Set<string>(WEBSITE_KNOWLEDGE_CATEGORIES);

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

function looksLikeUsefulEvidence(text: string): boolean {
  if (looksLikeChrome(text)) return false;
  if (text.length < 28) return false;
  if (/^(?:copyright|privacy policy|terms of use)\b/i.test(text) && text.length < 180) return false;
  return /[a-z]{3}/i.test(text);
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

function compactFactIdentities(facts: WebsiteKnowledgeFact[]) {
  return facts.map((fact) => ({
    category: fact.category,
    title: normalizeText(fact.title).slice(0, 120),
    value: normalizeText(fact.value).slice(0, 420),
    confidence: fact.confidence,
  }));
}

type EvidenceCandidate = {
  sourceBlockId: string;
  pageType: string;
  url: string;
  pageTitle: string;
  excerpt: string;
  score: number;
};

function evidenceSignalScore(text: string, pageType: string): number {
  const pageWeights: Record<string, number> = {
    home: 100,
    services: 100,
    products: 100,
    pricing: 100,
    about: 92,
    faq: 90,
    testimonials: 88,
    case_studies: 88,
    industries: 86,
    use_cases: 86,
    locations: 82,
    contact: 76,
    certifications: 76,
    support: 68,
    onboarding: 68,
    security: 62,
    compliance: 62,
    policies: 45,
    other: 50,
  };
  let score = pageWeights[pageType] ?? 50;
  if (/[$£€]\s?\d|\b(?:price|pricing|special|offer|discount|free consultation|new patient)\b/i.test(text)) score += 24;
  if (/\b(?:we offer|we provide|specializ|service|treatment|product|solution|capabilit)\b/i.test(text)) score += 20;
  if (/\b(?:unique|only|proven|experience|award|licensed|certif|testimonial|review|results?)\b/i.test(text)) score += 16;
  if (/\b(?:serve|serving|customer|patient|client|industry|location|area|fullerton|brea|anaheim)\b/i.test(text)) score += 12;
  if (/\b(?:faq|how long|who is|what is|can i|do you|insurance|hsa|fsa)\b/i.test(text)) score += 10;
  if (/\b(?:phone|email|fax|hours|address)\b/i.test(text)) score += 4;
  return score;
}

function pageFragments(page: Awaited<ReturnType<typeof crawlBusinessWebsite>>["pages"][number], sourceBlockId: string): EvidenceCandidate[] {
  const normalizedPage = String(page.text ?? "").replace(/\r\n/g, "\n");
  const rawFragments = normalizedPage
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map(normalizeText)
    .filter(looksLikeUsefulEvidence);
  const seen = new Set<string>();
  return rawFragments.flatMap((fragment) => {
    const excerpt = fragment.slice(0, MAX_EVIDENCE_EXCERPT_CHARACTERS).trim();
    const key = excerpt.toLowerCase();
    if (!excerpt || seen.has(key)) return [];
    seen.add(key);
    return [{
      sourceBlockId,
      pageType: page.pageType,
      url: page.url,
      pageTitle: page.title,
      excerpt,
      score: evidenceSignalScore(excerpt, page.pageType),
    }];
  });
}

function candidateEvidence(result: DeterministicEngineResult, crawl: Awaited<ReturnType<typeof crawlBusinessWebsite>>) {
  const visibleBlockByDocument = new Map<string, string>();
  for (const block of crawl.sourceBlocks) {
    if (block.extractionMethod !== "semantic_html") continue;
    if (!visibleBlockByDocument.has(block.sourceDocumentId)) visibleBlockByDocument.set(block.sourceDocumentId, block.id);
  }

  const candidates = crawl.pages.flatMap((page) => {
    const sourceBlockId = page.sourceDocumentId ? visibleBlockByDocument.get(page.sourceDocumentId) : undefined;
    return sourceBlockId ? pageFragments(page, sourceBlockId) : [];
  });

  const selected: EvidenceCandidate[] = [];
  const perPage = new Map<string, number>();
  const chosen = new Set<string>();
  const ranked = [...candidates].sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));

  const pageTypeOrder = ["home", "services", "products", "pricing", "about", "faq", "testimonials", "case_studies", "industries", "use_cases", "locations", "contact", "certifications"];
  for (const pageType of pageTypeOrder) {
    const candidate = ranked.find((item) => item.pageType === pageType && !chosen.has(`${item.sourceBlockId}\u0000${item.excerpt}`));
    if (!candidate) continue;
    selected.push(candidate);
    chosen.add(`${candidate.sourceBlockId}\u0000${candidate.excerpt}`);
    perPage.set(candidate.url, 1);
  }

  for (const candidate of ranked) {
    if (selected.length >= MAX_SELECTED_EVIDENCE) break;
    const identity = `${candidate.sourceBlockId}\u0000${candidate.excerpt}`;
    if (chosen.has(identity)) continue;
    const pageCount = perPage.get(candidate.url) ?? 0;
    if (pageCount >= MAX_EVIDENCE_PER_PAGE) continue;
    selected.push(candidate);
    chosen.add(identity);
    perPage.set(candidate.url, pageCount + 1);
  }

  const existingCategories = new Set(result.categories);
  const missingCategories = WEBSITE_KNOWLEDGE_CATEGORIES.filter((category) => !existingCategories.has(category));
  return {
    missingCategories,
    evidenceCandidates: selected.map(({ score: _score, ...item }) => item),
  };
}

function buildSemanticPack(result: DeterministicEngineResult, cleanFacts: WebsiteKnowledgeFact[], crawl: Awaited<ReturnType<typeof crawlBusinessWebsite>>) {
  const evidence = candidateEvidence(result, crawl);
  const pack = {
    existingFacts: compactFactIdentities(cleanFacts),
    missingInformation: result.missingInformation.slice(0, 12).map((item) => ({ topic: item.topic, reason: item.reason })),
    conflicts: result.conflicts.slice(0, 8).map((item) => ({ topicKey: item.topicKey, reason: item.reason })),
    missingCategories: evidence.missingCategories,
    evidenceCandidates: evidence.evidenceCandidates,
  };
  return { pack, serialized: JSON.stringify(pack) };
}

type SemanticResponse = {
  businessName?: unknown;
  industry?: unknown;
  facts?: unknown;
};

function comparableWords(value: string): Set<string> {
  return new Set(normalizeText(value).toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 4));
}

function meaningfullyDuplicatesExisting(candidate: WebsiteKnowledgeFact, existingFacts: WebsiteKnowledgeFact[]): boolean {
  const candidateText = normalizeText(candidate.value).toLowerCase();
  const candidateWords = comparableWords(candidateText);
  return existingFacts.some((fact) => {
    if (fact.category !== candidate.category) return false;
    const existingText = normalizeText(fact.value).toLowerCase();
    if (candidateText === existingText || candidateText.includes(existingText) || existingText.includes(candidateText)) return true;
    const existingWords = comparableWords(existingText);
    if (!candidateWords.size || !existingWords.size) return false;
    let overlap = 0;
    candidateWords.forEach((word) => {
      if (existingWords.has(word)) overlap += 1;
    });
    return overlap / Math.min(candidateWords.size, existingWords.size) >= 0.72;
  });
}

function normalizeSemanticFacts(
  value: unknown,
  existingFacts: WebsiteKnowledgeFact[],
  crawl: Awaited<ReturnType<typeof crawlBusinessWebsite>>,
): WebsiteKnowledgeFact[] {
  const blocksById = new Map(crawl.sourceBlocks.map((block) => [block.id, block]));
  const documentsById = new Map(crawl.sourceDocuments.map((document) => [document.id, document]));
  const existing = new Set(existingFacts.map(websiteFactIdentity));
  const accepted = [...existingFacts];
  const rows = Array.isArray(value) ? value : [];

  return rows.slice(0, MAX_SEMANTIC_FACTS).flatMap((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const item = raw as Record<string, unknown>;
    const category = normalizeText(item.category) as WebsiteKnowledgeFact["category"];
    const title = normalizeText(item.title);
    const factValue = normalizeText(item.value);
    const confidence = normalizeText(item.confidence) as WebsiteKnowledgeFact["confidence"];
    if (!categorySet.has(category) || !title || !factValue || !["high", "medium", "low"].includes(confidence)) return [];
    if (looksLikeChrome(title) || looksLikeChrome(factValue)) return [];

    const evidence = (Array.isArray(item.evidence) ? item.evidence : []).slice(0, 3).flatMap((rawEvidence) => {
      if (!rawEvidence || typeof rawEvidence !== "object" || Array.isArray(rawEvidence)) return [];
      const candidate = rawEvidence as Record<string, unknown>;
      const sourceBlockId = normalizeText(candidate.sourceBlockId);
      const excerpt = normalizeText(candidate.excerpt);
      const block = blocksById.get(sourceBlockId);
      if (!block || !excerpt || looksLikeChrome(excerpt)) return [];
      const blockText = normalizeText(block.normalizedText);
      if (!blockText.toLowerCase().includes(excerpt.toLowerCase())) return [];
      const document = documentsById.get(block.sourceDocumentId);
      if (!document) return [];
      const url = document.canonicalUrl ?? document.actualFetchedUrl;
      return [{
        url,
        excerpt,
        sourceBlockId: block.id,
        sourceDocumentId: document.id,
        crawlAttemptId: crawl.crawlAttempt.id,
        ...locateWebsiteEvidence(url, excerpt, crawl.sourceDocuments, crawl.sourceBlocks, crawl.crawlAttempt.id),
      }];
    });
    if (!evidence.length) return [];

    const fact: WebsiteKnowledgeFact = { category, title, value: factValue, confidence, evidence };
    if (meaningfullyDuplicatesExisting(fact, accepted)) return [];
    const identity = websiteFactIdentity(fact);
    if (existing.has(identity)) return [];
    existing.add(identity);
    accepted.push(fact);
    return [fact];
  });
}

function deterministicSummary(facts: WebsiteKnowledgeFact[], categories: WebsiteKnowledgeFact["category"][], maximum = 4) {
  return facts
    .filter((fact) => categories.includes(fact.category))
    .slice(0, maximum)
    .map((fact) => fact.value)
    .join(" ");
}

export async function runLeadForgeCompactResearchRequest(request: Request) {
  let body: { website?: unknown; modelId?: unknown };
  try {
    body = await request.json() as { website?: unknown; modelId?: unknown };
  } catch {
    return Response.json({ ok: false, error: { code: "invalid_json", message: "The request body must be valid JSON." } }, { status: 400 });
  }

  const website = normalizeText(body.website);
  const model = normalizeText(body.modelId) || "leadforge-gpt-5-5";
  if (!website) return Response.json({ ok: false, error: { code: "website_required", message: "A website is required." } }, { status: 400 });

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
        const cleanFacts = cleanDeterministicFacts(deterministic);
        send({ type: "progress", percent: 82 });

        const { pack, serialized } = buildSemanticPack(deterministic, cleanFacts, crawl);
        const availableSourceCharacters = crawl.sourceBlocks.reduce((total, block) => total + block.normalizedText.length, 0);
        const evidenceCharacters = pack.evidenceCandidates.reduce((total, item) => total + item.excerpt.length, 0);
        console.info("LEADFORGE_COMPACT_SEMANTIC_INPUT", {
          crawlAttemptId: crawl.crawlAttempt.id,
          sourceBlockCount: crawl.sourceBlocks.length,
          availableSourceCharacters,
          semanticInputCharacters: serialized.length,
          evidenceCharacters,
          deterministicFactCount: deterministic.facts.length,
          cleanDeterministicFacts: cleanFacts.length,
          discardedDeterministicFacts: deterministic.facts.length - cleanFacts.length,
          deterministicFactsSent: pack.existingFacts.length,
          evidenceFragmentsSent: pack.evidenceCandidates.length,
          representedPages: new Set(pack.evidenceCandidates.map((item) => item.url)).size,
          reductionRatio: availableSourceCharacters > 0 ? serialized.length / availableSourceCharacters : 0,
        });

        const aiStarted = performance.now();
        const response = await runModel({
          modelId: model,
          purpose: "crawl",
          instructions: `${semanticInstructions} Schema: ${JSON.stringify(semanticSchema)}`,
          messages: [{ role: "user", content: serialized }],
          signal: request.signal,
        });
        const aiMs = performance.now() - aiStarted;
        send({ type: "progress", percent: 94 });

        let semantic: SemanticResponse = {};
        try {
          const parsed = JSON.parse(response.text);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) semantic = parsed as SemanticResponse;
        } catch {
          semantic = {};
        }

        const semanticFacts = normalizeSemanticFacts(semantic.facts, cleanFacts, crawl);
        const mergedFacts = new Map(cleanFacts.map((fact) => [websiteFactIdentity(fact), fact]));
        for (const fact of semanticFacts) mergedFacts.set(websiteFactIdentity(fact), fact);
        const facts = Array.from(mergedFacts.values());
        const knowledge = {
          facts,
          coverage: deterministic.websiteKnowledge.coverage,
          unresolvedQuestions: deterministic.websiteKnowledge.unresolvedQuestions,
        };

        const usage = {
          inputTokens: response.usage.inputTokens,
          outputTokens: response.usage.outputTokens,
          totalTokens: response.usage.totalTokens,
        };
        const cost = estimateAiTokenCost(model, usage);
        const businessName = resolveCrawledBusinessName(normalizeText(semantic.businessName), crawl);
        const industry = normalizeText(semantic.industry) || deterministicSummary(facts, ["industry_served", "company_overview"], 2);
        const productsServices = deterministicSummary(facts, ["product", "service", "primary_use_case"], 5);
        const idealCustomers = deterministicSummary(facts, ["customer_segment", "industry_served"], 4);
        const additionalKnowledge = deterministicSummary(facts, ["competitive_differentiator", "pricing_plan", "location_service_area", "certification", "faq"], 5);

        const timings = {
          ...crawl.diagnostics.timings,
          deterministicKnowledgeMs: deterministicMs,
          aiKnowledgeExtractionMs: aiMs,
          totalDurationMs: performance.now() - started,
        };

        console.info("LEADFORGE_COMPACT_SEMANTIC_RESULT", {
          crawlAttemptId: crawl.crawlAttempt.id,
          model: response.modelId,
          deterministicFacts: deterministic.facts.length,
          cleanDeterministicFacts: cleanFacts.length,
          discardedDeterministicFacts: deterministic.facts.length - cleanFacts.length,
          semanticFactsAdded: semanticFacts.length,
          finalFacts: facts.length,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          estimatedCostUsd: cost?.totalCostUsd ?? null,
          deterministicMs,
          aiMs,
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
            model: response.modelId,
            aiCalls: 1,
            extractionUnits: pack.evidenceCandidates.length,
            tokens: usage,
            estimatedCostUsd: cost ? {
              input: cost.inputCostUsd,
              output: cost.outputCostUsd,
              total: cost.totalCostUsd,
            } : null,
            semanticReview: {
              availableSourceCharacters,
              inputCharacters: serialized.length,
              evidenceCharacters,
              cleanDeterministicFacts: cleanFacts.length,
              semanticFactsAdded: semanticFacts.length,
            },
          },
        });
        controller.close();
      } catch (error) {
        console.error("LEADFORGE_COMPACT_RESEARCH_FAILED", {
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
