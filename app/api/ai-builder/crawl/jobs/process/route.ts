import { NextResponse } from "next/server";
import { claimNextCrawlJob, completeCrawlJob, failCrawlJob, updateCrawlJobProgress } from "@/app/lib/ai-engine/crawler/crawlJobStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;
const LEASE_HEARTBEAT_MS = 60_000;
class TerminalCrawlJobError extends Error {}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });
  const job = await claimNextCrawlJob();
  if (!job) return NextResponse.json({ ok: true, processed: false });
  const leaseOwner = job.leaseOwner;
  if (!leaseOwner) return NextResponse.json({ ok: false, processed: true, jobId: job.id }, { status: 500 });
  const workerController = new AbortController();
  let heartbeatRunning = false;
  const heartbeat = setInterval(() => {
    if (heartbeatRunning) return;
    heartbeatRunning = true;
    void updateCrawlJobProgress(job.id, leaseOwner, {}).catch(() => workerController.abort()).finally(() => { heartbeatRunning = false; });
  }, LEASE_HEARTBEAT_MS);
  try {
    const response = await fetch(new URL("/api/ai-builder/crawl", request.url), { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` }, body: JSON.stringify({ website: job.requestedUrl }), cache: "no-store", signal: workerController.signal });
    if (!response.ok || !response.body) {
      const error = new Error("The background crawl worker could not start.");
      if (response.status >= 400 && response.status < 500) throw new TerminalCrawlJobError(error.message);
      throw error;
    }
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let result: Record<string, unknown> | null = null;
    while (true) {
      const { done, value } = await reader.read(); buffer += decoder.decode(value, { stream: !done }); const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
      for (const line of lines) { if (!line.trim()) continue; const event = JSON.parse(line) as Record<string, unknown>;
        if (event.type === "crawl_progress") await updateCrawlJobProgress(job.id, leaseOwner, { state: "crawling", pagesCrawled: Number(event.pagesCrawled ?? 0), pagesDiscovered: Number(event.pagesDiscovered ?? 0) });
        else if (event.type === "crawl_complete") await updateCrawlJobProgress(job.id, leaseOwner, { state: "processing", pagesCrawled: Number(event.pagesCrawled ?? 0), pagesDiscovered: Number(event.pagesDiscovered ?? 0), crawlComplete: true, processingPercent: 70 });
        else if (event.type === "progress" && Number(event.percent ?? 0) >= 70) await updateCrawlJobProgress(job.id, leaseOwner, { state: "processing", processingPercent: Number(event.percent ?? 70) });
        else if (event.type === "result") result = event;
        else if (event.type === "error") throw new TerminalCrawlJobError(String((event.error as { message?: unknown } | undefined)?.message ?? "The website could not be imported."));
      }
      if (done) break;
    }
    if (!result) throw new Error("The background crawl completed without an import result.");
    await completeCrawlJob(job.id, leaseOwner, result);
    return NextResponse.json({ ok: true, processed: true, jobId: job.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The website could not be imported.";
    try { await failCrawlJob(job.id, leaseOwner, message, { retryable: !(error instanceof TerminalCrawlJobError) }); } catch { /* A newer lease owner is responsible for the job. */ }
    return NextResponse.json({ ok: false, processed: true, jobId: job.id }, { status: 500 });
  } finally {
    clearInterval(heartbeat);
  }
}
