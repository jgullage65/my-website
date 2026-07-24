import { NextResponse } from "next/server";
import OpenAI from "openai";
import { BusinessWebsiteCrawlError, crawlBusinessWebsite, resolveCrawledBusinessName } from "@/app/lib/ai-engine/crawler/crawlBusinessWebsite";
import { finishCrawlTelemetry, startCrawlTelemetry } from "@/app/lib/telemetry/ai-builder-telemetry";
import { requireClerkUserId } from "@/app/lib/auth/clerk";
import { estimateAiTokenCost } from "@/app/lib/telemetry/ai-pricing";
import type { AiTokenUsage } from "@/app/lib/telemetry/ai-pricing";
import {
  AI_BUILDER_MAX_FINAL_INPUT_CHARACTERS,
  assertSafeWebsiteExtractionInput,
  buildWebsiteExtractionBatches,
  renderWebsiteExtractionBatch,
  type WebsiteExtractionChunk,
} from "@/app/lib/ai-engine/knowledge/websiteExtractionBatching";
import {
  WEBSITE_KNOWLEDGE_CATEGORIES,
  WEBSITE_KNOWLEDGE_COVERAGE_FIELDS,
} from "@/app/lib/ai-engine/knowledge/websiteKnowledge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "businessName",
    "industry",
    "productsServices",
    "idealCustomers",
    "additionalKnowledge",
    "knowledge",
  ],
  properties: {
    businessName: { type: "string" },
    industry: { type: "string" },
    productsServices: { type: "string" },
    idealCustomers: { type: "string" },
    additionalKnowledge: { type: "string" },
    knowledge: {
      type: "object",
      additionalProperties: false,
      required: ["facts", "coverage", "unresolvedQuestions"],
      properties: {
        facts: {
          type: "array",
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
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["url", "excerpt"],
                  properties: {
                    url: { type: "string" },
                    excerpt: { type: "string" },
                  },
                },
              },
            },
          },
        },
        coverage: {
          type: "object",
          additionalProperties: false,
          required: WEBSITE_KNOWLEDGE_COVERAGE_FIELDS,
          properties: Object.fromEntries(WEBSITE_KNOWLEDGE_COVERAGE_FIELDS.map((field) => [field, { type: "number", minimum: 0, maximum: 100 }])),
        },
        unresolvedQuestions: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
  },
} as const;

const extractionInstructions = [
  "Extract structured business intake information from the supplied public website pages.",
  "These pages may be one batch from a larger crawl; extract all supported information in this batch without assuming that absent information is absent from the website.",
  "Use only information explicitly supported by the pages.",
  "Do not invent pricing, policies, guarantees, customers, industries, locations, or claims.",
  "The five flat fields are editable intake summaries that a business owner can review and edit.",
  "Products/services should explain the main offers and outcomes.",
  "Ideal customers should describe only clearly supported audiences. Leave it brief when the audience is unclear.",
  "Additional knowledge may include FAQs, processes, policies, differentiators, guarantees, contact methods, locations, or other supported details.",
  "Return an empty string for any field that cannot be supported.",
  "Knowledge is the evidence-backed permanent knowledge representation.",
  "Classify every fact into the most specific canonical section: company_overview, mission_value_proposition, product, service, feature_capability, pricing_plan, customer_segment, industry_served, primary_use_case, integration, ai_automation, technical_capability, security_compliance, certification, support_onboarding, partnership, location_service_area, contact_information, brand_voice_terminology, faq, policy, competitive_differentiator, or additional_business_knowledge.",
  "Populate each canonical section intentionally when supported. Keep distinct products, services, plans, features, integrations, certifications, locations, contacts, policies, use cases, and FAQ answers as independently reviewable facts instead of compressing them into a general summary.",
  "Use additional_business_knowledge only when no more specific canonical section applies.",
  "Every knowledge fact must include one or more direct evidence entries with a crawled page URL and a short, direct supporting excerpt from that page.",
  "Do not use the requested website URL as evidence unless it is one of the crawled page URLs.",
  "Omit unsupported facts rather than guessing or inferring them.",
  "Set coverage scores according to how much clearly supported information is available for each topic, not according to the number of pages crawled.",
  "Put important information that is unclear or unsupported in unresolvedQuestions.",
  "Determine businessName from the canonical homepage identity and business content, never from an internal page title such as Contact, About, or Services.",
].join(" ");

export function measureWebsiteExtractionFinalInput(input: string): number {
  return JSON.stringify({ instructions: extractionInstructions, input, text: { format: { type: "json_schema", name: "ai_builder_website_import", strict: true, schema: extractionSchema } } }).length;
}

const factCategories = new Set<string>(WEBSITE_KNOWLEDGE_CATEGORIES);

const confidenceLevels = new Set(["high", "medium", "low"]);

const coverageFields = WEBSITE_KNOWLEDGE_COVERAGE_FIELDS;

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function clampCoverage(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : 0;
}

function canonicalizeUrl(value: unknown): string {
  const url = normalizeText(value);
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname === "/" ? "/" : parsed.pathname.replace(/\/+$/, "");
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${parsed.port ? `:${parsed.port}` : ""}${pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}

function normalizeKnowledge(value: unknown, crawledPages: Map<string, string>) {
  const knowledge = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const rawFacts = Array.isArray(knowledge.facts) ? knowledge.facts : [];
  const facts = rawFacts.flatMap((rawFact) => {
    if (!rawFact || typeof rawFact !== "object") return [];

    const fact = rawFact as Record<string, unknown>;
    const category = normalizeText(fact.category);
    const title = normalizeText(fact.title);
    const factValue = normalizeText(fact.value);
    const confidence = normalizeText(fact.confidence);
    const evidence = (Array.isArray(fact.evidence) ? fact.evidence : []).flatMap((rawEvidence) => {
      if (!rawEvidence || typeof rawEvidence !== "object") return [];

      const item = rawEvidence as Record<string, unknown>;
      const url = normalizeText(item.url);
      const excerpt = normalizeText(item.excerpt);
      const pageText = crawledPages.get(canonicalizeUrl(url));
      return url && excerpt && pageText?.includes(excerpt) ? [{ url, excerpt }] : [];
    });

    if (!category || !title || !factValue || !confidence || !factCategories.has(category) || !confidenceLevels.has(confidence) || !evidence.length) {
      return [];
    }

    return [{ category, title, value: factValue, confidence, evidence }];
  });
  const rawCoverage = knowledge.coverage && typeof knowledge.coverage === "object"
    ? knowledge.coverage as Record<string, unknown>
    : {};
  const coverage = Object.fromEntries(
    coverageFields.map((field) => [field, clampCoverage(rawCoverage[field])]),
  ) as Record<(typeof coverageFields)[number], number>;
  const unresolvedQuestions = (Array.isArray(knowledge.unresolvedQuestions) ? knowledge.unresolvedQuestions : [])
    .map(normalizeText)
    .filter(Boolean);

  return { facts, coverage, unresolvedQuestions };
}

type ExtractedWebsiteBatch = {
  businessName: string;
  industry: string;
  productsServices: string;
  idealCustomers: string;
  additionalKnowledge: string;
  knowledge: ReturnType<typeof normalizeKnowledge>;
};

function splitTextInHalf(value: string): [string, string] {
  let midpoint = Math.floor(value.length / 2);
  if (midpoint > 0 && midpoint < value.length && /[\uD800-\uDBFF]/.test(value[midpoint - 1] ?? "") && /[\uDC00-\uDFFF]/.test(value[midpoint] ?? "")) midpoint += 1;
  return [value.slice(0, midpoint), value.slice(midpoint)];
}

function splitExtractionUnits(units: WebsiteExtractionChunk[]): [WebsiteExtractionChunk[], WebsiteExtractionChunk[]] | null {
  if (units.length > 1) {
    const midpoint = Math.ceil(units.length / 2);
    return [units.slice(0, midpoint), units.slice(midpoint)];
  }
  const unit = units[0];
  if (!unit || unit.text.length < 2) return null;
  const [left, right] = splitTextInHalf(unit.text);
  return [[{ ...unit, text: left, chunkIndex: unit.chunkIndex * 2 - 1, chunkCount: unit.chunkCount * 2 }], [{ ...unit, text: right, chunkIndex: unit.chunkIndex * 2, chunkCount: unit.chunkCount * 2 }]];
}

function isContextWindowError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { status?: unknown; code?: unknown; message?: unknown; error?: { code?: unknown; message?: unknown } };
  const code = String(candidate.code ?? candidate.error?.code ?? "").toLowerCase();
  const message = String(candidate.message ?? candidate.error?.message ?? "").toLowerCase();
  return candidate.status === 400 && (
    code.includes("context") ||
    message.includes("context window") ||
    message.includes("maximum context") ||
    message.includes("too many tokens") ||
    message.includes("input exceeds")
  );
}

function appendDistinct(values: string[]): string {
  const seen = new Set<string>();
  return values.map(normalizeText).filter((value) => {
    const identity = value.toLocaleLowerCase();
    if (!value || seen.has(identity)) return false;
    seen.add(identity);
    return true;
  }).join("\n\n");
}

function mergeExtractedBatches(batches: ExtractedWebsiteBatch[]): ExtractedWebsiteBatch {
  const facts = new Map<string, ExtractedWebsiteBatch["knowledge"]["facts"][number]>();
  for (const batch of batches) {
    for (const fact of batch.knowledge.facts) {
      const identity = [fact.category, fact.title].map((value) => normalizeText(value).toLocaleLowerCase()).join("\u0000");
      const existing = facts.get(identity);
      if (!existing) {
        facts.set(identity, fact);
        continue;
      }
      const evidence = new Map(existing.evidence.map((item) => [`${canonicalizeUrl(item.url)}\u0000${normalizeText(item.excerpt).toLocaleLowerCase()}`, item]));
      for (const item of fact.evidence) evidence.set(`${canonicalizeUrl(item.url)}\u0000${normalizeText(item.excerpt).toLocaleLowerCase()}`, item);
      const confidenceOrder = { low: 0, medium: 1, high: 2 } as const;
      facts.set(identity, { ...existing, value: appendDistinct([existing.value, fact.value]), confidence: confidenceOrder[fact.confidence as keyof typeof confidenceOrder] > confidenceOrder[existing.confidence as keyof typeof confidenceOrder] ? fact.confidence : existing.confidence, evidence: Array.from(evidence.values()) });
    }
  }
  const coverage = Object.fromEntries(coverageFields.map((field) => [field, Math.max(0, ...batches.map((batch) => batch.knowledge.coverage[field]))])) as ExtractedWebsiteBatch["knowledge"]["coverage"];
  return {
    businessName: batches.map((batch) => normalizeText(batch.businessName)).find(Boolean) ?? "",
    industry: appendDistinct(batches.map((batch) => batch.industry)),
    productsServices: appendDistinct(batches.map((batch) => batch.productsServices)),
    idealCustomers: appendDistinct(batches.map((batch) => batch.idealCustomers)),
    additionalKnowledge: appendDistinct(batches.map((batch) => batch.additionalKnowledge)),
    knowledge: {
      facts: Array.from(facts.values()),
      coverage,
      unresolvedQuestions: appendDistinct(batches.flatMap((batch) => batch.knowledge.unresolvedQuestions)).split("\n\n").filter(Boolean),
    },
  };
}

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function POST(request: Request) {
  const workerSecret = process.env.CRON_SECRET?.trim();
  const internalWorker = Boolean(workerSecret && request.headers.get("authorization") === `Bearer ${workerSecret}`);
  if (!internalWorker) {
    try {
      await requireClerkUserId();
    } catch {
      return NextResponse.json({ ok: false, error: { code: "authentication_required", message: "Sign in to use AI Builder." } }, { status: 401 });
    }
  }
  let body: { website?: unknown };

  try {
    body = (await request.json()) as { website?: unknown };
  } catch {
    return errorResponse(400, "invalid_json", "The request body must be valid JSON.");
  }

  const website = normalizeText(body.website);
  if (!website) {
    return errorResponse(400, "website_required", "Add a website before importing business information.");
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return errorResponse(503, "openai_not_configured", "The AI builder is not configured yet.");
  }

  const encoder = new TextEncoder();
  const attemptId = crypto.randomUUID();
  const requestStarted = performance.now();
  let persistenceMs = 0;
  let crawlStartedAt = new Date().toISOString();
  const telemetryStart = performance.now();
  await startCrawlTelemetry(attemptId, website, crawlStartedAt);
  persistenceMs += performance.now() - telemetryStart;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

      let crawlRecorded = false;
      let model = process.env.AI_BUILDER_CRAWLER_MODEL?.trim() || "gpt-5-mini";
      let usage: AiTokenUsage | undefined;
      let aiCalls = 0;
      let estimatedInputCostUsd = 0;
      let estimatedOutputCostUsd = 0;
      let hasCostEstimate = false;
      let aiExtractionStarted: number | undefined;
      let aiExtractionDurationMs = 0;
      let crawlDiagnostics: BusinessWebsiteCrawlError["diagnostics"] | undefined;
      try {
    send({ type: "progress", percent: 5 });
    crawlStartedAt = new Date().toISOString();
    const crawl = await crawlBusinessWebsite(website, (pagesCrawled, pagesDiscovered) => {
      send({ type: "crawl_progress", pagesCrawled, pagesDiscovered });
    });
    crawlDiagnostics = crawl.diagnostics;
    const crawlCompletedAt = new Date().toISOString();
    const telemetryFinish = performance.now();
    await finishCrawlTelemetry(attemptId,{status:crawl.warnings.length||crawl.diagnostics.pagesFailed?"partial":"completed",resolvedUrl:crawl.resolvedUrl,startedAt:crawlStartedAt,completedAt:crawlCompletedAt,...crawl.diagnostics,warnings:crawl.warnings.map(message=>({stage:"crawl",message}))});
    persistenceMs += performance.now() - telemetryFinish;
    crawlRecorded = true;
    send({ type: "crawl_complete", pagesCrawled: crawl.pages.length, pagesDiscovered: crawl.diagnostics.pagesDiscovered });
    send({ type: "progress", percent: 70 });
    const client = new OpenAI({ apiKey });

    const extractionUnits = crawl.pages.map((page, index) => ({
      pageNumber: index + 1,
      sourceIdentifier: `crawl-page-${index + 1}`,
      url: page.url,
      pageType: page.pageType,
      title: page.title,
      text: page.text,
    }));
    const crawledPages = new Map(crawl.pages.map((page) => [
      canonicalizeUrl(page.url),
      normalizeText(page.text),
    ]));

    send({ type: "progress", percent: 75 });
    const aiStarted = performance.now();
    aiExtractionStarted = aiStarted;
    const plannedBatches = buildWebsiteExtractionBatches(extractionUnits, measureWebsiteExtractionFinalInput);
    const pendingBatches: WebsiteExtractionChunk[][] = plannedBatches.map((batch) => batch.units);
    const extractedBatches: ExtractedWebsiteBatch[] = [];
    while (pendingBatches.length > 0) {
      const units = pendingBatches.shift()!;
      const batchIndex = aiCalls + 1;
      const input = renderWebsiteExtractionBatch(units);
      const finalInputCharacterCount = assertSafeWebsiteExtractionInput(input, measureWebsiteExtractionFinalInput);
      const callStarted = performance.now();
      try {
        aiCalls += 1;
        const response = await client.responses.create({
          model,
          instructions: extractionInstructions,
          input,
          text: {
            format: {
              type: "json_schema",
              name: "ai_builder_website_import",
              strict: true,
              schema: extractionSchema,
            },
          },
        });
        console.info("AI_BUILDER_EXTRACTION_CALL", { attemptId, batchIndex, totalBatchCount: plannedBatches.length, pageCount: new Set(units.map((unit) => unit.sourceIdentifier)).size, chunkCount: units.length, finalInputCharacterCount, inputTokenCount: response.usage?.input_tokens, outputTokenCount: response.usage?.output_tokens, model: response.model || model, durationMs: performance.now() - callStarted, success: true });
        model = response.model || model;
        if (response.usage) {
          const batchUsage = {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            totalTokens: response.usage.total_tokens,
          };
          usage = {
            inputTokens: (usage?.inputTokens ?? 0) + batchUsage.inputTokens,
            outputTokens: (usage?.outputTokens ?? 0) + batchUsage.outputTokens,
            totalTokens: (usage?.totalTokens ?? 0) + batchUsage.totalTokens,
          };
          const batchCost = estimateAiTokenCost(response.model || model, batchUsage);
          if (batchCost) {
            hasCostEstimate = true;
            estimatedInputCostUsd += batchCost.inputCostUsd;
            estimatedOutputCostUsd += batchCost.outputCostUsd;
          }
        }
        if (response.incomplete_details?.reason === "max_output_tokens") {
          const split = splitExtractionUnits(units);
          if (!split) throw new Error("AI extraction could not produce a complete response for a single content unit.");
          pendingBatches.unshift(split[0], split[1]);
          continue;
        }
        const batch = JSON.parse(response.output_text.trim()) as Omit<ExtractedWebsiteBatch, "knowledge"> & { knowledge: unknown };
        extractedBatches.push({ ...batch, knowledge: normalizeKnowledge(batch.knowledge, crawledPages) });
      } catch (error) {
        console.error("AI_BUILDER_EXTRACTION_CALL", { attemptId, batchIndex, totalBatchCount: plannedBatches.length, pageCount: new Set(units.map((unit) => unit.sourceIdentifier)).size, chunkCount: units.length, finalInputCharacterCount, model, durationMs: performance.now() - callStarted, success: false, error: error instanceof Error ? error.message : String(error) });
        if (!isContextWindowError(error)) throw error;
        const split = splitExtractionUnits(units);
        if (!split) throw error;
        pendingBatches.unshift(split[0], split[1]);
      }
    }
    const extracted = mergeExtractedBatches(extractedBatches);
    const knowledge = extracted.knowledge;
    const aiKnowledgeExtractionMs = performance.now() - aiStarted;
    aiExtractionDurationMs = aiKnowledgeExtractionMs;
    const timings = {
      ...crawl.diagnostics.timings,
      aiKnowledgeExtractionMs,
      persistenceMs,
      totalDurationMs: performance.now() - requestStarted,
    };
    console.info("AI_BUILDER_CRAWL_TIMINGS", { attemptId, ...timings });

    send({ type: "progress", percent: 100 });
    send({
      type: "result",
      ok: true,
      import: {
        businessName: resolveCrawledBusinessName(extracted.businessName, crawl),
        industry: normalizeText(extracted.industry),
        website: crawl.resolvedUrl,
        requestedUrl: crawl.requestedUrl,
        resolvedUrl: crawl.resolvedUrl,
        productsServices: normalizeText(extracted.productsServices),
        idealCustomers: normalizeText(extracted.idealCustomers),
        additionalKnowledge: normalizeText(extracted.additionalKnowledge),
      },
      knowledge,
      pages: crawl.pages.map((page) => ({
        url: page.url,
        title: page.title,
        pageType: page.pageType,
      })),
      warnings: crawl.warnings,
      crawlAttemptId: attemptId,
      timings,
    });
      } catch (error) {
        const message = error instanceof Error ? error.message : "The website could not be imported.";
        if (!crawlRecorded) {
          const diagnostics=error instanceof BusinessWebsiteCrawlError?error.diagnostics:undefined;
          crawlDiagnostics = diagnostics;
          await finishCrawlTelemetry(attemptId,{status:"failed",startedAt:crawlStartedAt,completedAt:new Date().toISOString(),...diagnostics,errors:[{stage:"crawl",message:message.slice(0,500)}],failureStage:"crawl"});
        }
        console.error("AI_BUILDER_WEBSITE_CRAWL_FAILED", { website, message });
        send({
          type: "error",
          error: {
            code: "website_import_failed",
            message: message || "The website could not be imported.",
          },
          crawlAttemptId: attemptId,
        });
      } finally {
        if (aiExtractionStarted !== undefined && aiExtractionDurationMs === 0) aiExtractionDurationMs = performance.now() - aiExtractionStarted;
        const cost = hasCostEstimate ? {
          inputCostUsd: estimatedInputCostUsd,
          outputCostUsd: estimatedOutputCostUsd,
          totalCostUsd: estimatedInputCostUsd + estimatedOutputCostUsd,
        } : undefined;
        const pagesProcessed = crawlDiagnostics?.pagesProcessed ?? 0;
        console.info("AI_BUILDER_CRAWL_DIAGNOSTICS", {
          attemptId,
          website,
          model,
          pagesDiscovered: crawlDiagnostics?.pagesDiscovered ?? 0,
          pagesCrawled: pagesProcessed,
          pagesProcessed,
          pagesSkipped: crawlDiagnostics?.pagesSkipped ?? 0,
          pagesFailed: crawlDiagnostics?.pagesFailed ?? 0,
          aiCalls,
          inputTokens: usage?.inputTokens ?? 0,
          outputTokens: usage?.outputTokens ?? 0,
          totalTokens: usage?.totalTokens ?? 0,
          estimatedInputCostUsd: cost?.inputCostUsd ?? null,
          estimatedOutputCostUsd: cost?.outputCostUsd ?? null,
          estimatedTotalCostUsd: cost?.totalCostUsd ?? null,
          costPerPageUsd: cost && pagesProcessed > 0 ? cost.totalCostUsd / pagesProcessed : null,
          crawlDurationMs: crawlDiagnostics?.timings.totalCrawlDurationMs ?? 0,
          aiExtractionDurationMs,
          totalRequestDurationMs: performance.now() - requestStarted,
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
