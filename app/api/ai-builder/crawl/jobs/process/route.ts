import { NextResponse } from "next/server";
import { claimNextCrawlJob, completeCrawlJob, failCrawlJob, updateCrawlJobProgress } from "@/app/lib/ai-engine/crawler/crawlJobStore";
import { applyCrawlEvent, configuredCrawlEndpoint, consumeCrawlEvents, TerminalCrawlWorkerError } from "@/app/lib/ai-engine/crawler/crawlJobProcessor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;
const LEASE_HEARTBEAT_MS = 60_000;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });
  let crawlEndpoint: URL;
  try { crawlEndpoint = configuredCrawlEndpoint(process.env.AI_BUILDER_INTERNAL_ORIGIN); }
  catch { return NextResponse.json({ ok:false, error:{ code:"crawl_worker_not_configured", message:"The background website importer is not configured yet." } }, { status:503 }); }
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
    const response = await fetch(crawlEndpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` }, body: JSON.stringify({ website: job.requestedUrl }), cache: "no-store", signal: workerController.signal });
    if (!response.ok || !response.body) {
      const error = new Error("The background crawl worker could not start.");
      if (response.status >= 400 && response.status < 500) throw new TerminalCrawlWorkerError(error.message);
      throw error;
    }
    let result: Record<string, unknown> | null = null;
    await consumeCrawlEvents(response.body, async (event) => {
      const eventResult = await applyCrawlEvent(event, (progress) => updateCrawlJobProgress(job.id, leaseOwner, progress));
      if (eventResult) result = eventResult;
    });
    if (!result) throw new Error("The background crawl completed without an import result.");
    await completeCrawlJob(job.id, leaseOwner, result);
    return NextResponse.json({ ok: true, processed: true, jobId: job.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The website could not be imported.";
    try { await failCrawlJob(job.id, leaseOwner, message, { retryable: !(error instanceof TerminalCrawlWorkerError) }); } catch { /* A newer lease owner is responsible for the job. */ }
    return NextResponse.json({ ok: false, processed: true, jobId: job.id }, { status: 500 });
  } finally {
    clearInterval(heartbeat);
  }
}
