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
const MAX_REQUEST_BYTES = 4_096;

const clientKey = (request: Request) =>
  (request.headers.get("x-forwarded-for")?.split(",")[0] ??
    request.headers.get("x-real-ip") ??
    "unknown").trim();

async function readBoundedJson(request: Request): Promise<{ website?: unknown }> {
  if (!request.body) throw new Error("empty_body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_REQUEST_BYTES) {
        await reader.cancel("request_limit_reached");
        throw new Error("body_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(body)) as { website?: unknown };
}

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_REQUEST_BYTES) {
    return NextResponse.json(
      { ok: false, error: { code: "request_too_large", message: "The demo request is too large." } },
      { status: 413 },
    );
  }

  // Invalid and oversized requests are rejected before a lease is created, so
  // they do not consume a visitor's valid demo allowance.
  let body: { website?: unknown };
  try {
    body = await readBoundedJson(request);
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_request", message: "Add a valid website and try again." } },
      { status: 400 },
    );
  }
  const website = typeof body.website === "string" ? body.website.trim().slice(0, 2_048) : "";
  if (!website) {
    return NextResponse.json(
      { ok: false, error: { code: "website_required", message: "Add a website before importing business information." } },
      { status: 400 },
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
