import { crawlBusinessWebsite, resolveCrawledBusinessName } from "@/app/lib/ai-engine/crawler/crawlBusinessWebsite";
import { locateWebsiteEvidence } from "@/app/lib/ai-engine/crawler/websiteSourceRecords";
import { persistWebsiteSourceRecords } from "@/app/lib/ai-engine/crawler/websiteSourceRecordStore";
import { buildDeterministicBusinessBrain } from "@/app/lib/ai-engine/deterministic";
import type { DeterministicEngineResult, NormalizedSourceBlock } from "@/app/lib/ai-engine/deterministic/contracts";
import { runModel } from "@/app/lib/ai-engine/models/runModel";
import { estimateAiTokenCost } from "@/app/lib/telemetry/ai-pricing";
import {
  WEBSITE_KNOWLEDGE_CATEGORIES,
  websiteFactIdentity,
  type WebsiteKnowledgeFact,
} from "@/app/lib/ai-engine/knowledge/websiteKnowledge";

const MAX_SEMANTIC_INPUT_CHARACTERS = 24_000;
const MAX_EVIDENCE_BLOCKS = 18;
const MAX_BLOCK_EXCERPT_CHARACTERS = 600;
const MAX_DETERMINISTIC_FACTS = 32;
const MAX_SEMANTIC_FACTS = 12;

const semanticSchema = {
  type: "object",
  additionalProperties: false,
  required: ["businessName", "industry", "productsServices", "idealCustomers", "additionalKnowledge", "facts"],
  properties: {
    businessName: { type: "string" },
    industry: { type: "string" },
    productsServices: { type: "string" },
    idealCustomers: { type: "string" },
    additionalKnowledge: { type: "string" },
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
  "You are the bounded semantic review stage for LeadForge website research.",
  "A deterministic engine has already extracted, deduplicated, classified, conflict-checked, and confidence-scored the website knowledge.",
  "Do not re-read or reconstruct the website. You only receive a compact evidence pack.",
  "Use deterministic facts as the authority for what is already known.",
  "Add a fact only when the supplied evidence candidates clearly support useful semantic knowledge that the deterministic facts missed or underspecified.",
  `Return at most ${MAX_SEMANTIC_FACTS} additional facts.`,
  "Do not duplicate an existing deterministic fact.",
  "Do not infer facts from general industry knowledge.",
  "Every added fact must cite one or more supplied sourceBlockId values and use a short exact excerpt from that supplied block.",
  "The five summary fields are concise summaries of the supplied deterministic facts plus supported semantic additions, not new sources of truth.",
  "Return an empty string when a summary cannot be supported.",
  "Return JSON only matching the provided schema.",
].join(" ");

const categorySet = new Set<string>(WEBSITE_KNOWLEDGE_CATEGORIES);

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function blockPriority(block: NormalizedSourceBlock): number {
  const pageWeights: Record<string, number> = {
    home: 100,
    services: 95,
    products: 95,
    pricing: 94,
    about: 88,
    faq: 86,
    testimonials: 84,
    case_studies: 84,
    industries: 82,
    use_cases: 82,
    contact: 78,
    locations: 78,
    certifications: 76,
    support: 72,
    onboarding: 72,
    security: 70,
    compliance: 70,
    policies: 55,
    other: 40,
  };
  let score = pageWeights[block.pageType] ?? 50;
  const text = block.text.toLowerCase();
  if (/\$|\bprice|pricing|special|offer|discount|free consultation\b/.test(text)) score += 18;
  if (/\bspecializ|unique|only|experience|award|certif|testimonial|review\b/.test(text)) score += 12;
  if (/\bserve|customer|patient|client|industry|location|area\b/.test(text)) score += 8;
  if (/\bfaq|how long|who is|what is|can i|do you\b/.test(text)) score += 6;
  if (block.type === "heading" || block.type === "faq_question" || block.type === "faq_answer") score += 5;
  return score;
}

function compactDeterministicFacts(result: DeterministicEngineResult) {
  return [...result.facts]
    .sort((a, b) => b.confidenceScore - a.confidenceScore || a.title.localeCompare(b.title))
    .slice(0, MAX_DETERMINISTIC_FACTS)
    .map((fact) => ({
      category: fact.category,
      title: normalizeText(fact.title).slice(0, 140),
      value: normalizeText(fact.value).slice(0, 700),
      confidence: fact.confidence,
      evidence: fact.evidence.slice(0, 2).map((evidence) => ({
        url: evidence.url,
        excerpt: normalizeText(evidence.excerpt).slice(0, 300),
      })),
    }));
}

function candidateEvidence(result: DeterministicEngineResult) {
  const seen = new Set<string>();
  return [...result.normalizedBlocks]
    .sort((a, b) => blockPriority(b) - blockPriority(a))
    .flatMap((block) => {
      if (seen.has(block.id)) return [];
      const excerpt = normalizeText(block.text).slice(0, MAX_BLOCK_EXCERPT_CHARACTERS);
      if (excerpt.length < 20) return [];
      seen.add(block.id);
      return [{
        sourceBlockId: block.id,
        pageType: block.pageType,
        sourceType: block.evidence.sourceType,
        url: block.evidence.url,
        pageTitle: block.evidence.pageTitle ?? "",
        heading: block.heading ?? block.evidence.heading ?? "",
        excerpt,
      }];
    })
    .slice(0, MAX_EVIDENCE_BLOCKS);
}

function buildSemanticPack(result: DeterministicEngineResult) {
  const missingCategories = WEBSITE_KNOWLEDGE_CATEGORIES.filter((category) => !result.categories.includes(category));
  const base = {
    deterministicFacts: compactDeterministicFacts(result),
    unresolved: result.missingInformation.slice(0, 12).map((item) => ({ topic: item.topic, reason: item.reason })),
    conflicts: result.conflicts.slice(0, 8).map((item) => ({ topicKey: item.topicKey, reason: item.reason })),
    missingCategories,
    evidenceCandidates: candidateEvidence(result),
  };

  let pack = base;
  let serialized = JSON.stringify(pack);
  while (serialized.length > MAX_SEMANTIC_INPUT_CHARACTERS && pack.evidenceCandidates.length > 4) {
    pack = { ...pack, evidenceCandidates: pack.evidenceCandidates.slice(0, pack.evidenceCandidates.length - 1) };
    serialized = JSON.stringify(pack);
  }
  while (serialized.length > MAX_SEMANTIC_INPUT_CHARACTERS && pack.deterministicFacts.length > 12) {
    pack = { ...pack, deterministicFacts: pack.deterministicFacts.slice(0, pack.deterministicFacts.length - 1) };
    serialized = JSON.stringify(pack);
  }
  if (serialized.length > MAX_SEMANTIC_INPUT_CHARACTERS) {
    serialized = serialized.slice(0, MAX_SEMANTIC_INPUT_CHARACTERS);
  }
  return { pack, serialized };
}

type SemanticResponse = {
  businessName?: unknown;
  industry?: unknown;
  productsServices?: unknown;
  idealCustomers?: unknown;
  additionalKnowledge?: unknown;
  facts?: unknown;
};

function normalizeSemanticFacts(
  value: unknown,
  deterministic: DeterministicEngineResult,
  crawl: Awaited<ReturnType<typeof crawlBusinessWebsite>>,
): WebsiteKnowledgeFact[] {
  const blocksById = new Map(crawl.sourceBlocks.map((block) => [block.id, block]));
  const documentsById = new Map(crawl.sourceDocuments.map((document) => [document.id, document]));
  const existing = new Set(deterministic.websiteKnowledge.facts.map(websiteFactIdentity));
  const rows = Array.isArray(value) ? value : [];

  return rows.slice(0, MAX_SEMANTIC_FACTS).flatMap((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const item = raw as Record<string, unknown>;
    const category = normalizeText(item.category) as WebsiteKnowledgeFact["category"];
    const title = normalizeText(item.title);
    const factValue = normalizeText(item.value);
    const confidence = normalizeText(item.confidence) as WebsiteKnowledgeFact["confidence"];
    if (!categorySet.has(category) || !title || !factValue || !["high", "medium", "low"].includes(confidence)) return [];

    const evidence = (Array.isArray(item.evidence) ? item.evidence : []).slice(0, 3).flatMap((rawEvidence) => {
      if (!rawEvidence || typeof rawEvidence !== "object" || Array.isArray(rawEvidence)) return [];
      const candidate = rawEvidence as Record<string, unknown>;
      const sourceBlockId = normalizeText(candidate.sourceBlockId);
      const excerpt = normalizeText(candidate.excerpt);
      const block = blocksById.get(sourceBlockId);
      if (!block || !excerpt) return [];
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
    const identity = websiteFactIdentity(fact);
    if (existing.has(identity)) return [];
    existing.add(identity);
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
        send({ type: "progress", percent: 82 });

        const { pack, serialized } = buildSemanticPack(deterministic);
        const availableSourceCharacters = crawl.sourceBlocks.reduce((total, block) => total + block.normalizedText.length, 0);
        console.info("LEADFORGE_COMPACT_SEMANTIC_INPUT", {
          crawlAttemptId: crawl.crawlAttempt.id,
          sourceBlockCount: crawl.sourceBlocks.length,
          availableSourceCharacters,
          semanticInputCharacters: serialized.length,
          deterministicFactCount: deterministic.facts.length,
          deterministicFactsSent: pack.deterministicFacts.length,
          evidenceBlocksSent: pack.evidenceCandidates.length,
          maxSemanticInputCharacters: MAX_SEMANTIC_INPUT_CHARACTERS,
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

        const semanticFacts = normalizeSemanticFacts(semantic.facts, deterministic, crawl);
        const mergedFacts = new Map(deterministic.websiteKnowledge.facts.map((fact) => [websiteFactIdentity(fact), fact]));
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
        const productsServices = normalizeText(semantic.productsServices) || deterministicSummary(facts, ["product", "service", "primary_use_case"], 5);
        const idealCustomers = normalizeText(semantic.idealCustomers) || deterministicSummary(facts, ["customer_segment", "industry_served"], 4);
        const additionalKnowledge = normalizeText(semantic.additionalKnowledge) || deterministicSummary(facts, ["competitive_differentiator", "pricing_plan", "location_service_area", "certification", "faq"], 5);

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
              deterministicFacts: deterministic.facts.length,
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
