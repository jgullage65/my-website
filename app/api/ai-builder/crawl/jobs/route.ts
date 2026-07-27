import { NextResponse } from "next/server";
import { requireClerkUserId } from "@/app/lib/auth/clerk";
import { CrawlJobAdmissionError, createCrawlJob } from "@/app/lib/ai-engine/crawler/crawlJobStore";
import { normalizeWebsiteCrawlInput } from "@/app/lib/ai-engine/crawler/crawlBusinessWebsite";
import { configuredCrawlEndpoint } from "@/app/lib/ai-engine/crawler/crawlJobProcessor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const text = (value: unknown) => String(value ?? "").replace(/\u0000/g, "").trim();

export async function POST(request: Request) {
  let clerkUserId: string;
  try { clerkUserId = await requireClerkUserId(); } catch { return NextResponse.json({ ok: false, error: { code: "authentication_required", message: "Sign in to use AI Builder." } }, { status: 401 }); }
  const body = await request.json().catch(() => ({})) as { website?: unknown };
  const website = text(body.website);
  if (!website) return NextResponse.json({ ok: false, error: { code: "website_required", message: "Add a website before importing business information." } }, { status: 400 });
  try { if (!process.env.CRON_SECRET?.trim()) throw new Error("Missing worker secret"); configuredCrawlEndpoint(process.env.AI_BUILDER_INTERNAL_ORIGIN); }
  catch { return NextResponse.json({ ok: false, error: { code: "crawl_worker_not_configured", message: "The background website importer is not configured yet." } }, { status: 503 }); }
  let normalizedWebsite: string;
  try { normalizedWebsite = normalizeWebsiteCrawlInput(website).toString(); }
  catch (error) { return NextResponse.json({ ok: false, error: { code: "invalid_website", message: error instanceof Error ? error.message : "Enter a valid public website URL." } }, { status: 400 }); }
  try {
    const job = await createCrawlJob(clerkUserId, normalizedWebsite);
    return NextResponse.json({ ok: true, job: { id: job.id, state: job.state, pagesDiscovered: job.pagesDiscovered, pagesCrawled: job.pagesCrawled, crawlComplete: job.crawlComplete, attemptCount: job.attemptCount, nextAttemptAt: job.nextAttemptAt } }, { status: 202 });
  } catch (error) {
    if (error instanceof CrawlJobAdmissionError) return NextResponse.json({ ok: false, error: { code: "crawl_job_active", message: error.message } }, { status: 409 });
    throw error;
  }
}
