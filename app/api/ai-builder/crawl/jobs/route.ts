import { NextResponse } from "next/server";
import { requireClerkUserId } from "@/app/lib/auth/clerk";
import { createCrawlJob } from "@/app/lib/ai-engine/crawler/crawlJobStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const text = (value: unknown) => String(value ?? "").replace(/\u0000/g, "").trim();

export async function POST(request: Request) {
  let clerkUserId: string;
  try { clerkUserId = await requireClerkUserId(); } catch { return NextResponse.json({ ok: false, error: { code: "authentication_required", message: "Sign in to use AI Builder." } }, { status: 401 }); }
  const body = await request.json().catch(() => ({})) as { website?: unknown };
  const website = text(body.website);
  if (!website) return NextResponse.json({ ok: false, error: { code: "website_required", message: "Add a website before importing business information." } }, { status: 400 });
  if (!process.env.CRON_SECRET?.trim()) return NextResponse.json({ ok: false, error: { code: "crawl_worker_not_configured", message: "The background website importer is not configured yet." } }, { status: 503 });
  const job = await createCrawlJob(clerkUserId, website);
  return NextResponse.json({ ok: true, job: { id: job.id, state: job.state, pagesDiscovered: 0, pagesCrawled: 0, crawlComplete: false } }, { status: 202 });
}
