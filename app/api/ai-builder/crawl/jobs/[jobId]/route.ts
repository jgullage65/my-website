import { NextResponse } from "next/server";
import { requireClerkUserId } from "@/app/lib/auth/clerk";
import { getOwnedCrawlJob } from "@/app/lib/ai-engine/crawler/crawlJobStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { jobId: string } }) {
  let clerkUserId: string;
  try { clerkUserId = await requireClerkUserId(); } catch { return NextResponse.json({ ok: false }, { status: 401 }); }
  const job = await getOwnedCrawlJob(params.jobId, clerkUserId);
  if (!job) return NextResponse.json({ ok: false, error: { code: "crawl_job_not_found", message: "The crawl job could not be found." } }, { status: 404 });
  return NextResponse.json({ ok: true, job: { id: job.id, state: job.state, pagesDiscovered: job.pagesDiscovered, pagesCrawled: job.pagesCrawled, crawlComplete: job.crawlComplete, processingPercent: job.processingPercent, result: job.state === "completed" ? job.result : null, errorMessage: job.errorMessage } });
}
