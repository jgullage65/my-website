const MAX_EVENT_BYTES = 8 * 1024 * 1024;
export class TerminalCrawlWorkerError extends Error {}
type Progress = { state?: "crawling" | "processing"; pagesCrawled?: number; pagesDiscovered?: number; crawlComplete?: boolean; processingPercent?: number };

export function configuredCrawlEndpoint(configuredOrigin: string | undefined): URL {
  const value = configuredOrigin?.trim();
  if (!value) throw new Error("AI_BUILDER_INTERNAL_ORIGIN is required for the crawl worker.");
  const origin = new URL(value);
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/") {
    throw new Error("AI_BUILDER_INTERNAL_ORIGIN must be an origin without credentials, path, query, or fragment.");
  }
  const hostname = origin.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (origin.protocol !== "https:" && !(origin.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(hostname))) {
    throw new Error("AI_BUILDER_INTERNAL_ORIGIN must use HTTPS outside local development.");
  }
  return new URL("/api/ai-builder/crawl", origin);
}

export async function consumeCrawlEvents(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: Record<string, unknown>) => Promise<void>,
  maximumEventBytes = MAX_EVENT_BYTES,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let bufferedBytes = 0;
  const consume = async (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as unknown;
    if (!event || typeof event !== "object" || Array.isArray(event)) throw new Error("The crawl worker emitted an invalid event.");
    await onEvent(event as Record<string, unknown>);
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (value) {
        bufferedBytes += value.byteLength;
        if (bufferedBytes > maximumEventBytes) throw new Error("The crawl worker emitted an oversized event.");
        buffer += decoder.decode(value, { stream: true });
      }
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        await consume(line);
        bufferedBytes = new TextEncoder().encode(buffer).byteLength;
      }
      if (done) {
        buffer += decoder.decode();
        await consume(buffer);
        break;
      }
    }
  } catch (error) {
    try { await reader.cancel(); } catch { /* Stream cleanup cannot hide the processor failure. */ }
    throw error;
  }
}

export async function applyCrawlEvent(
  event: Record<string, unknown>,
  updateProgress: (progress: Progress) => Promise<void>,
): Promise<Record<string, unknown> | null> {
  if (event.type === "crawl_progress") await updateProgress({ state:"crawling", pagesCrawled:Number(event.pagesCrawled ?? 0), pagesDiscovered:Number(event.pagesDiscovered ?? 0) });
  else if (event.type === "crawl_complete") await updateProgress({ state:"processing", pagesCrawled:Number(event.pagesCrawled ?? 0), pagesDiscovered:Number(event.pagesDiscovered ?? 0), crawlComplete:true, processingPercent:70 });
  else if (event.type === "progress" && Number(event.percent ?? 0) >= 70) await updateProgress({ state:"processing", processingPercent:Number(event.percent ?? 70) });
  else if (event.type === "result") return event;
  else if (event.type === "error") throw new TerminalCrawlWorkerError(String((event.error as { message?: unknown } | undefined)?.message ?? "The website could not be imported."));
  return null;
}
