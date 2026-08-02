import { NextResponse } from "next/server";
import {
  crawlBusinessWebsite,
  resolveCrawledBusinessName,
} from "@/app/lib/ai-engine/crawler/crawlBusinessWebsite";
import { buildDeterministicBusinessBrain } from "@/app/lib/ai-engine/deterministic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 3;
const MAX_CONCURRENT = 2;
const requests = new Map<string, number[]>();
let active = 0;

const clientKey = (request: Request) =>
  (request.headers.get("x-forwarded-for")?.split(",")[0] ??
    request.headers.get("x-real-ip") ??
    "unknown").trim();

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 4096) {
    return NextResponse.json(
      { ok: false, error: { code: "request_too_large", message: "The demo request is too large." } },
      { status: 413 },
    );
  }

  const key = clientKey(request);
  const now = Date.now();
  const recent = (requests.get(key) ?? []).filter((timestamp) => now - timestamp < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) {
    return NextResponse.json(
      { ok: false, error: { code: "rate_limited", message: "Please wait a minute before importing another website." } },
      { status: 429 },
    );
  }
  if (active >= MAX_CONCURRENT) {
    return NextResponse.json(
      { ok: false, error: { code: "demo_busy", message: "The public demo is busy. Please try again shortly." } },
      { status: 503 },
    );
  }

  let body: { website?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_json", message: "Add a valid website." } },
      { status: 400 },
    );
  }
  const website = String(body.website ?? "").trim().slice(0, 2048);
  if (!website) {
    return NextResponse.json(
      { ok: false, error: { code: "website_required", message: "Add a website before importing business information." } },
      { status: 400 },
    );
  }

  recent.push(now);
  requests.set(key, recent);
  active += 1;
  try {
    // The shared crawler enforces destination safety, page/byte budgets, request
    // timeouts, redirect validation, and extraction bounds. No artifacts are saved.
    const crawl = await crawlBusinessWebsite(website, undefined, {
      crawlAttemptId: crypto.randomUUID(),
      crawlStartedAt: new Date().toISOString(),
    });
    const brain = buildDeterministicBusinessBrain({
      pages: crawl.pages.map((page) => ({ ...page, crawlAttemptId: crawl.crawlAttempt.id })),
      sourceDocuments: crawl.sourceDocuments,
      sourceBlocks: crawl.sourceBlocks,
    });
    const products = brain.facts
      .filter((fact) => ["product", "service", "feature_capability", "pricing_plan"].includes(fact.category))
      .map((fact) => fact.value).slice(0, 8).join("\n");
    const customers = brain.facts
      .filter((fact) => ["customer_segment", "industry_served"].includes(fact.category))
      .map((fact) => fact.value).slice(0, 6).join("\n");
    const additional = brain.facts
      .filter((fact) => !["product", "service", "feature_capability", "pricing_plan", "customer_segment", "industry_served"].includes(fact.category))
      .map((fact) => fact.value).slice(0, 10).join("\n");

    return NextResponse.json({
      ok: true,
      import: {
        businessName: resolveCrawledBusinessName("", crawl),
        industry: "",
        website: crawl.resolvedUrl,
        requestedUrl: crawl.requestedUrl,
        resolvedUrl: crawl.resolvedUrl,
        productsServices: products,
        idealCustomers: customers,
        additionalKnowledge: additional,
      },
      knowledge: brain.websiteKnowledge,
      pages: crawl.pages.map(({ url, title, pageType, sourceDocumentId }) => ({ url, title, pageType, sourceDocumentId })),
      warnings: crawl.warnings,
      sourceDocuments: crawl.sourceDocuments,
      sourceBlocks: crawl.sourceBlocks,
      crawlAttemptId: crawl.crawlAttempt.id,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: { code: "website_import_failed", message: error instanceof Error ? error.message : "The website could not be imported." } },
      { status: 400 },
    );
  } finally {
    active -= 1;
  }
}
