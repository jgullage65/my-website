import { NextResponse } from "next/server";
import OpenAI from "openai";
import { crawlBusinessWebsite } from "@/app/lib/ai-engine/crawler/crawlBusinessWebsite";

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
  ],
  properties: {
    businessName: { type: "string" },
    industry: { type: "string" },
    productsServices: { type: "string" },
    idealCustomers: { type: "string" },
    additionalKnowledge: { type: "string" },
  },
} as const;

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function POST(request: Request) {
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
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

      try {
    send({ type: "progress", percent: 5 });
    const crawl = await crawlBusinessWebsite(website, (completed, maximum) => {
      send({
        type: "progress",
        percent: Math.min(65, 10 + Math.round((completed / maximum) * 55)),
      });
    });
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
    const response = await client.responses.create({
      model,
      instructions: [
        "Extract structured business intake information from the supplied public website pages.",
        "Use only information explicitly supported by the pages.",
        "Do not invent pricing, policies, guarantees, customers, industries, locations, or claims.",
        "Write concise but useful intake copy that a business owner can review and edit.",
        "Products/services should explain the main offers and outcomes.",
        "Ideal customers should describe only clearly supported audiences. Leave it brief when the audience is unclear.",
        "Additional knowledge may include FAQs, processes, policies, differentiators, guarantees, contact methods, locations, or other supported details.",
        "Return an empty string for any field that cannot be supported.",
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
    };

    send({ type: "progress", percent: 100 });
    send({
      type: "result",
      ok: true,
      import: {
        businessName: normalizeText(extracted.businessName),
        industry: normalizeText(extracted.industry),
        website: crawl.resolvedUrl,
        productsServices: normalizeText(extracted.productsServices),
        idealCustomers: normalizeText(extracted.idealCustomers),
        additionalKnowledge: normalizeText(extracted.additionalKnowledge),
      },
      pages: crawl.pages.map((page) => ({
        url: page.url,
        title: page.title,
        pageType: page.pageType,
      })),
      warnings: crawl.warnings,
    });
      } catch (error) {
        const message = error instanceof Error ? error.message : "The website could not be imported.";
        console.error("AI_BUILDER_WEBSITE_CRAWL_FAILED", { website, message });
        send({
          type: "error",
          error: {
            code: "website_import_failed",
            message: message || "The website could not be imported.",
          },
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
