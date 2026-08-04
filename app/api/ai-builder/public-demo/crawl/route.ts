import { NextResponse } from "next/server";
import { POST as runProductionCrawl } from "@/app/api/ai-builder/crawl/route";
import { enforcePublicRateLimit } from "@/app/lib/security/publicRateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 3;
const MAX_CONCURRENT = 2;
const MAX_REQUEST_BYTES = 4_096;

const clientKey = (request: Request) =>
  (request.headers.get("x-forwarded-for")?.split(",")[0] ??
    request.headers.get("x-real-ip") ??
    "unknown").trim();

type PublicDemoRequestBody = {
  website?: unknown;
  modelId?: unknown;
};

type CrawlEvent = {
  type?: string;
  ok?: boolean;
  error?: {
    code?: string;
    message?: string;
    modelId?: string;
    provider?: string;
    gateway?: string;
    requestId?: string | null;
  };
  [key: string]: unknown;
};

async function readBoundedJson(request: Request): Promise<PublicDemoRequestBody> {
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

  return JSON.parse(new TextDecoder().decode(body)) as PublicDemoRequestBody;
}

function publicError(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

async function readProductionResult(response: Response): Promise<CrawlEvent> {
  if (!response.body) {
    try {
      return (await response.json()) as CrawlEvent;
    } catch {
      throw new Error("production_crawl_returned_no_body");
    }
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: CrawlEvent | null = null;

  const consumeLine = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as CrawlEvent;
    if (event.type === "error") throw event;
    if (event.type === "result") result = event;
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) consumeLine(line);
    if (done) {
      if (buffer.trim()) consumeLine(buffer);
      break;
    }
  }

  if (!result) throw new Error("production_crawl_returned_no_result");
  const { type: _type, ...payload } = result;
  return payload;
}

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_REQUEST_BYTES) {
    return publicError(413, "request_too_large", "The demo request is too large.");
  }

  let body: PublicDemoRequestBody;
  try {
    body = await readBoundedJson(request);
  } catch {
    return publicError(400, "invalid_request", "Add a valid website and try again.");
  }

  const website = typeof body.website === "string" ? body.website.trim().slice(0, 2_048) : "";
  const modelId = typeof body.modelId === "string" ? body.modelId.trim().slice(0, 128) : "";
  if (!website) {
    return publicError(400, "website_required", "Add a website before importing business information.");
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
    return publicError(503, "demo_temporarily_unavailable", "The demo needs a short break. Please try again in a moment.");
  }

  if (!rateLimit.allowed) {
    return publicError(429, "demo_temporarily_unavailable", "The demo needs a short break. Please try again in a moment.");
  }

  try {
    const workerSecret = process.env.CRON_SECRET?.trim();
    if (!workerSecret) {
      console.error("AI_BUILDER_PUBLIC_DEMO_WORKER_SECRET_MISSING");
      return publicError(503, "demo_temporarily_unavailable", "The demo needs a short break. Please try again in a moment.");
    }

    const productionRequest = new Request(new URL("/api/ai-builder/crawl", request.url), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${workerSecret}`,
      },
      body: JSON.stringify({ website, modelId }),
    });

    const productionResponse = await runProductionCrawl(productionRequest);
    if (!productionResponse.ok) {
      try {
        const payload = (await productionResponse.json()) as CrawlEvent;
        return NextResponse.json(payload, { status: productionResponse.status });
      } catch {
        return publicError(502, "website_import_failed", "We couldn’t bring in that website right now.");
      }
    }

    const payload = await readProductionResult(productionResponse);
    if (!payload.ok) {
      return NextResponse.json(payload, { status: 400 });
    }

    return NextResponse.json(payload);
  } catch (error) {
    const crawlEvent = error && typeof error === "object" ? error as CrawlEvent : null;
    console.error("AI_BUILDER_PUBLIC_DEMO_IMPORT_FAILED", {
      message: crawlEvent?.error?.message ?? (error instanceof Error ? error.message : String(error)),
    });
    return NextResponse.json(
      {
        ok: false,
        error: crawlEvent?.error ?? {
          code: "website_unavailable",
          message: "We couldn’t bring in that website right now. Check the address and try again.",
        },
      },
      { status: 400 },
    );
  } finally {
    await rateLimit.release().catch((error) => {
      console.error("AI_BUILDER_PUBLIC_DEMO_RATE_LIMIT_RELEASE_FAILED", {
        message: error instanceof Error ? error.message : String(error),
      });
    });
  }
}
