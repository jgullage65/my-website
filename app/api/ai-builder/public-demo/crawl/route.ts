import { NextResponse } from "next/server";
import {
  crawlBusinessWebsite,
  resolveCrawledBusinessName,
} from "@/app/lib/ai-engine/crawler/crawlBusinessWebsite";
import { buildDeterministicBusinessBrain } from "@/app/lib/ai-engine/deterministic";
import type { DeterministicFact } from "@/app/lib/ai-engine/deterministic";
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

function categorySet(
  ...categories: DeterministicFact["category"][]
): ReadonlySet<DeterministicFact["category"]> {
  return new Set(categories);
}

function distinctFactValues(
  facts: readonly DeterministicFact[],
  categories: ReadonlySet<DeterministicFact["category"]>,
  limit: number,
): string {
  const seen = new Set<string>();
  return facts
    .filter((fact) => categories.has(fact.category))
    .sort((left, right) => right.confidenceScore - left.confidenceScore || left.id.localeCompare(right.id))
    .map((fact) => fact.value.trim())
    .filter((value) => {
      const key = value.toLocaleLowerCase();
      if (!value || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit)
    .join("\n\n");
}

function deterministicIndustry(facts: readonly DeterministicFact[]): string {
  const direct = distinctFactValues(facts, categorySet("industry_served"), 3);
  if (direct) return direct;

  const company = facts
    .filter((fact) => fact.category === "company_overview" || fact.category === "mission_value_proposition")
    .sort((left, right) => right.confidenceScore - left.confidenceScore || left.id.localeCompare(right.id))[0];
  return company?.title.trim() || "";
}

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_REQUEST_BYTES) {
    return NextResponse.json(
      { ok: false, error: { code: "request_too_large", message: "The demo request is too large." } },
      { status: 413 },
    );
  }

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
    const crawl = await crawlBusinessWebsite(website, undefined, {
      crawlAttemptId: crypto.randomUUID(),
      crawlStartedAt: new Date().toISOString(),
    });
    const brain = buildDeterministicBusinessBrain({
      pages: crawl.pages.map((page) => ({ ...page, crawlAttemptId: crawl.crawlAttempt.id })),
      sourceDocuments: crawl.sourceDocuments,
      sourceBlocks: crawl.sourceBlocks,
    });

    const productsServices = distinctFactValues(
      brain.facts,
      categorySet("product", "service", "feature_capability", "pricing_plan", "primary_use_case"),
      12,
    );
    const idealCustomers = distinctFactValues(
      brain.facts,
      categorySet("customer_segment", "industry_served", "location_service_area"),
      8,
    );
    const additionalKnowledge = distinctFactValues(
      brain.facts,
      categorySet(
        "company_overview",
        "mission_value_proposition",
        "competitive_differentiator",
        "policy",
        "support_onboarding",
        "contact_information",
        "brand_voice_terminology",
        "integration",
        "ai_automation",
        "technical_capability",
        "security_compliance",
        "certification",
        "partnership",
        "additional_business_knowledge",
        "faq",
      ),
      16,
    );

    return NextResponse.json({
      ok: true,
      import: {
        businessName: resolveCrawledBusinessName("", crawl),
        industry: deterministicIndustry(brain.facts),
        website: crawl.resolvedUrl,
        requestedUrl: crawl.requestedUrl,
        resolvedUrl: crawl.resolvedUrl,
        productsServices,
        idealCustomers,
        additionalKnowledge,
      },
      knowledge: brain.websiteKnowledge,
      pages: crawl.pages.map(({ url, title, pageType, sourceDocumentId }) => ({
        url,
        title,
        pageType,
        sourceDocumentId,
      })),
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
