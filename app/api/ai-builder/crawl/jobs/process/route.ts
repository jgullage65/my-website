import { NextResponse } from "next/server";
import { claimNextCrawlJob, completeCrawlJob, failCrawlJob, updateCrawlJobProgress } from "@/app/lib/ai-engine/crawler/crawlJobStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });
  const job = await claimNextCrawlJob();
  if (!job) return NextResponse.json({ ok: true, processed: false });
  try {
    const response = await fetch(new URL("/api/ai-builder/crawl", request.url), { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` }, body: JSON.stringify({ website: job.requestedUrl }), cache: "no-store" });
    if (!response.ok || !response.body) throw new Error("The background crawl worker could not start.");
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let result: Record<string, unknown> | null = null;
    while (true) {
      const { done, value } = await reader.read(); buffer += decoder.decode(value, { stream: !done }); const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
      for (const line of lines) { if (!line.trim()) continue; const event = JSON.parse(line) as Record<string, unknown>;
        if (event.type === "crawl_progress") await updateCrawlJobProgress(job.id, { state: "crawling", pagesCrawled: Number(event.pagesCrawled ?? 0), pagesDiscovered: Number(event.pagesDiscovered ?? 0) });
        else if (event.type === "crawl_complete") await updateCrawlJobProgress(job.id, { state: "processing", pagesCrawled: Number(event.pagesCrawled ?? 0), pagesDiscovered: Number(event.pagesDiscovered ?? 0), crawlComplete: true, processingPercent: 70 });
        else if (event.type === "progress" && Number(event.percent ?? 0) >= 70) await updateCrawlJobProgress(job.id, { state: "processing", processingPercent: Number(event.percent ?? 70) });
        else if (event.type === "result") result = event;
        else if (event.type === "error") throw new Error(String((event.error as { message?: unknown } | undefined)?.message ?? "The website could not be imported."));
      }
      if (done) break;
    }
    if (!result) throw new Error("The background crawl completed without an import result.");
    await completeCrawlJob(job.id, result);
    return NextResponse.json({ ok: true, processed: true, jobId: job.id });
  } catch (error) { const message = error instanceof Error ? error.message : "The website could not be imported."; await failCrawlJob(job.id, message); return NextResponse.json({ ok: false, processed: true, jobId: job.id }, { status: 500 }); }
}
