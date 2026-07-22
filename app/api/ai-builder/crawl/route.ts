import { NextResponse } from "next/server";
import OpenAI from "openai";
import { BusinessWebsiteCrawlError, crawlBusinessWebsite, resolveCrawledBusinessName } from "@/app/lib/ai-engine/crawler/crawlBusinessWebsite";
import { finishCrawlTelemetry, startCrawlTelemetry } from "@/app/lib/telemetry/ai-builder-telemetry";
import { requireClerkUserId } from "@/app/lib/auth/clerk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
              category: {
                type: "string",
                enum: [
                  "business_identity",
                  "industry",
                  "product",
                  "service",
                  "customer",
                  "pricing",
                  "policy",
                  "process",
                  "faq",
                  "differentiator",
                  "guarantee",
                  "location",
                  "contact",
                  "other",
                ],
              },
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
          required: [
            "businessIdentity",
            "offers",
            "customers",
            "pricing",
            "policies",
            "processes",
            "faq",
            "contact",
            "overall",
          ],
          properties: {
            businessIdentity: { type: "number", minimum: 0, maximum: 100 },
            offers: { type: "number", minimum: 0, maximum: 100 },
            customers: { type: "number", minimum: 0, maximum: 100 },
            pricing: { type: "number", minimum: 0, maximum: 100 },
            policies: { type: "number", minimum: 0, maximum: 100 },
            processes: { type: "number", minimum: 0, maximum: 100 },
            faq: { type: "number", minimum: 0, maximum: 100 },
            contact: { type: "number", minimum: 0, maximum: 100 },
            overall: { type: "number", minimum: 0, maximum: 100 },
          },
        },
        unresolvedQuestions: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
  },
} as const;

const factCategories = new Set([
  "business_identity",
  "industry",
  "product",
  "service",
  "customer",
  "pricing",
  "policy",
  "process",
  "faq",
  "differentiator",
  "guarantee",
  "location",
  "contact",
  "other",
]);

const confidenceLevels = new Set(["high", "medium", "low"]);

const coverageFields = [
  "businessIdentity",
  "offers",
  "customers",
  "pricing",
  "policies",
  "processes",
  "faq",
  "contact",
  "overall",
] as const;

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

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function POST(request: Request) {
  try {
    await requireClerkUserId();
  } catch {
    return NextResponse.json({ ok: false, error: { code: "authentication_required", message: "Sign in to use AI Builder." } }, { status: 401 });
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
      try {
    send({ type: "progress", percent: 5 });
    crawlStartedAt = new Date().toISOString();
    const crawl = await crawlBusinessWebsite(website, (completed, maximum) => {
      send({
        type: "progress",
        percent: Math.min(65, 10 + Math.round((completed / maximum) * 55)),
      });
    });
    const crawlCompletedAt = new Date().toISOString();
    const telemetryFinish = performance.now();
    await finishCrawlTelemetry(attemptId,{status:crawl.warnings.length||crawl.diagnostics.pagesFailed?"partial":"completed",resolvedUrl:crawl.resolvedUrl,startedAt:crawlStartedAt,completedAt:crawlCompletedAt,...crawl.diagnostics,warnings:crawl.warnings.map(message=>({stage:"crawl",message}))});
    persistenceMs += performance.now() - telemetryFinish;
    crawlRecorded = true;
    send({ type: "progress", percent: 70 });
    const client = new OpenAI({ apiKey });
    const model = process.env.AI_BUILDER_CRAWLER_MODEL?.trim() || "gpt-5-mini";

    const source = crawl.pages
      .map(
        (page, index) =>
          [
            `PAGE ${index + 1}`,
            `URL: ${page.url}`,
            `TYPE: ${page.pageType}`,
            page.title ? `TITLE: ${page.title}` : "",
            "CONTENT:",
            page.text,
          ]
            .filter(Boolean)
            .join("\n"),
      )
      .join("\n\n---\n\n")
      .slice(0, 60_000);

    send({ type: "progress", percent: 75 });
    const aiStarted = performance.now();
    const response = await client.responses.create({
      model,
      instructions: [
        "Extract structured business intake information from the supplied public website pages.",
        "Use only information explicitly supported by the pages.",
        "Do not invent pricing, policies, guarantees, customers, industries, locations, or claims.",
        "The five flat fields are editable intake summaries that a business owner can review and edit.",
        "Products/services should explain the main offers and outcomes.",
        "Ideal customers should describe only clearly supported audiences. Leave it brief when the audience is unclear.",
        "Additional knowledge may include FAQs, processes, policies, differentiators, guarantees, contact methods, locations, or other supported details.",
        "Return an empty string for any field that cannot be supported.",
        "Knowledge is the evidence-backed permanent knowledge representation.",
        "Every knowledge fact must include one or more direct evidence entries with a crawled page URL and a short, direct supporting excerpt from that page.",
        "Do not use the requested website URL as evidence unless it is one of the crawled page URLs.",
        "Omit unsupported facts rather than guessing or inferring them.",
        "Set coverage scores according to how much clearly supported information is available for each topic, not according to the number of pages crawled.",
        "Put important information that is unclear or unsupported in unresolvedQuestions.",
        "Determine businessName from the canonical homepage identity and business content, never from an internal page title such as Contact, About, or Services.",
      ].join(" "),
      input: source,
      text: {
        format: {
          type: "json_schema",
          name: "ai_builder_website_import",
          strict: true,
          schema: extractionSchema,
        },
      },
    });

    const extracted = JSON.parse(response.output_text.trim()) as {
      businessName: string;
      industry: string;
      productsServices: string;
      idealCustomers: string;
      additionalKnowledge: string;
      knowledge: unknown;
    };
    const crawledPages = new Map(crawl.pages.map((page) => [
      canonicalizeUrl(page.url),
      normalizeText(page.text),
    ]));
    const knowledge = normalizeKnowledge(extracted.knowledge, crawledPages);
    const aiKnowledgeExtractionMs = performance.now() - aiStarted;
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
