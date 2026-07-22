import { NextResponse } from "next/server";
import { requireClerkUserId, isAuthenticationRequired } from "@/app/lib/auth/clerk";
import { executePersistedReviewCommand, PersistedReviewCommandError } from "@/app/lib/ai-engine/business-memory/services/execute-persisted-review-command";
import type { ReviewCommandRequest } from "@/app/lib/ai-engine/business-memory/review-commands";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const error = (status: number, code: string, message: string) => NextResponse.json({ ok: false, error: { code, message } }, { status });

/** Thin HTTP transport adapter; persistence and canonical execution live in the service. */
export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const projectId = (await context.params).projectId.trim();
  let body: ReviewCommandRequest;
  try { body = await request.json() as ReviewCommandRequest; } catch { return error(400, "invalid_json", "The request body must be valid JSON."); }
  if (!projectId || body.projectId !== projectId || !body.commandId || !body.itemId) return error(400, "invalid_review_command", "The review command is incomplete.");
  try {
    const clerkUserId = await requireClerkUserId();
    const result = await executePersistedReviewCommand({ projectId, clerkUserId, request: body });
    return NextResponse.json({ ok: true, ...result });
  } catch (cause) {
    if (isAuthenticationRequired(cause)) return error(401, "authentication_required", "Sign in to use AI Builder.");
    if (cause instanceof PersistedReviewCommandError) return error(cause.status, cause.code, cause.message);
    return error(500, "review_command_failed", cause instanceof Error ? cause.message : "The review command could not be saved.");
  }
}
