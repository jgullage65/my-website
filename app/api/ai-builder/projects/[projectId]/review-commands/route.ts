import { NextResponse } from "next/server";
import { requireClerkUserId, isAuthenticationRequired } from "@/app/lib/auth/clerk";
import { executePersistedReviewCommand, PersistedReviewCommandError } from "@/app/lib/ai-engine/business-memory/services/execute-persisted-review-command";
import { parseReviewCommandRequest, ReviewCommandRequestParseError, isReviewCommandIdentifier } from "@/app/lib/ai-engine/business-memory/review-command-request-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const error = (status: number, code: string, message: string) => NextResponse.json({ ok: false, error: { code, message } }, { status });

/** Thin HTTP transport adapter; persistence and canonical execution live in the service. */
export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const projectId = (await context.params).projectId.trim();
  let body;
  try { body = parseReviewCommandRequest(await request.json()); } catch (cause) {
    if (cause instanceof SyntaxError) return error(400, "invalid_json", "The request body must be valid JSON.");
    if (cause instanceof ReviewCommandRequestParseError) return error(400, cause.code, cause.message);
    return error(400, "invalid_review_command", "The review command payload is invalid.");
  }
  if (!isReviewCommandIdentifier(projectId) || body.projectId !== projectId) return error(400, "invalid_review_command", "The project ID does not match the request path.");
  try {
    const clerkUserId = await requireClerkUserId();
    const result = await executePersistedReviewCommand({ projectId, clerkUserId, request: body });
    return NextResponse.json({ ok: true, ...result });
  } catch (cause) {
    if (isAuthenticationRequired(cause)) return error(401, "authentication_required", "Sign in to use AI Builder.");
    if (cause instanceof PersistedReviewCommandError) return error(cause.status, cause.code, cause.message);
    return error(500, "review_command_failed", "The review command could not be saved.");
  }
}
