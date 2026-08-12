import { NextResponse } from "next/server";
import { requireClerkUserId } from "@/app/lib/auth/clerk";
import { runBusinessWebsiteResearchRequest } from "@/app/lib/ai-engine/research/businessKnowledgePack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

export async function POST(request: Request) {
  const workerSecret = process.env.CRON_SECRET?.trim();
  const internalWorker = Boolean(workerSecret && request.headers.get("authorization") === `Bearer ${workerSecret}`);
  if (!internalWorker) {
    try { await requireClerkUserId(); }
    catch { return NextResponse.json({ ok: false, error: { code: "authentication_required", message: "Sign in to use AI Builder." } }, { status: 401 }); }
  }

  return runBusinessWebsiteResearchRequest(request, { internalWorker });
}
