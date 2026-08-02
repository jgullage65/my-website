import { NextResponse } from "next/server";
import {
  crawlBusinessWebsite,
  resolveCrawledBusinessName,
} from "@/app/lib/ai-engine/crawler/crawlBusinessWebsite";
import { buildDeterministicBusinessBrain } from "@/app/lib/ai-engine/deterministic";
import { enforcePublicRateLimit } from "@/app/lib/security/publicRateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 3;
const MAX_CONCURRENT = 2;

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

  let rateLimit: Awaited<ReturnType<typeof enforcePublicRateLimit>>;
  try {
    rateLimit = await enforcePublicRateLimit({
      scope: "ai-builder-public-demo-crawl",
      subject: clientKey(request),
      limit: MAX_REQUESTS,
      windowMs: WINDOW_MS,
      concurrency: MAX_CONCURRENT,
    });
  } catch (error) {
    console.error("AI_BUILDER_PUBLIC_DEMO_RATE_LIMIT_FAILED", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "demo_temporarily_unavailable",
          message: "The demo needs a short break. Please try again in a moment.",
        },
      },
      { status: 503 },
    );
  }
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "demo_temporarily_unavailable",
          message: "The demo needs a short break. Please try again in a moment.",
        },
      },
      { status: 429 },
    );
  }
  const releaseRateLimit = () => rateLimit.release().catch((error) => {
    console.error("AI_BUILDER_PUBLIC_DEMO_RATE_LIMIT_RELEASE_FAILED", {
      message: error instanceof Error ? error.message : String(error),
    });
  });

  let body: { website?: unknown };
  try {
    body = await request.json();
  } catch {
    await releaseRateLimit();
    return NextResponse.json(
      { ok: false, error: { code: "invalid_json", message: "Add a valid website." } },
      { status: 400 },
    );
  }
  const website = String(body.website ?? "").trim().slice(0, 2048);
  if (!website) {
    await releaseRateLimit();
    return NextResponse.json(
      { ok: false, error: { code: "website_required", message: "Add a website before importing business information." } },
      { status: 400 },
    );
  }

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
      // Operational warnings stay server-side in the public experience.
      warnings: [],
      sourceDocuments: crawl.sourceDocuments,
      sourceBlocks: crawl.sourceBlocks,
      crawlAttemptId: crawl.crawlAttempt.id,
    });
  } catch (error) {
    console.error("AI_BUILDER_PUBLIC_DEMO_IMPORT_FAILED", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "website_unavailable",
          message: "We couldn’t bring in that website right now. Check the address and try again.",
        },
      },
      { status: 400 },
    );
  } finally {
    await releaseRateLimit();
  }
}
