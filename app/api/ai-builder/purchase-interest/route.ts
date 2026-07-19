import { NextResponse } from "next/server";
import { ensureAiBuilderSchema } from "@/app/lib/db/ai-builder-schema";
import { getSql } from "@/app/lib/db/client";
import { requireClerkUserId } from "@/app/lib/auth/clerk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PurchaseInterestBody = {
  projectId?: string;
};

type DatabaseRow = Record<string, unknown>;

const PURCHASE_INTEREST_TO_EMAIL = "hello@jgcreativestudios.com";

function normalizeProjectId(value: unknown): string {
  return String(value ?? "").trim();
}

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    {
      ok: false,
      error: { code, message },
    },
    { status },
  );
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendPurchaseInterestEmail(
  project: DatabaseRow,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    console.info("AI_BUILDER_PURCHASE_INTEREST_EMAIL_SKIPPED", {
      projectId: String(project.id),
      reason: "RESEND_API_KEY is not configured.",
    });

    return false;
  }

  const fromEmail =
    process.env.AI_BUILDER_PURCHASE_FROM_EMAIL?.trim() ||
    "JG Creative Studios <hello@jgcreativestudios.com>";

  const projectId = String(project.id);
  const businessName = String(project.business_name || "Unnamed business");
  const industry = String(project.industry || "Not provided");
  const website = String(project.website || "Not provided");
  const requestedAt = new Date().toISOString();

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [PURCHASE_INTEREST_TO_EMAIL],
      subject: `AI Builder purchase interest: ${businessName}`,
      text: [
        "A visitor completed the AI Builder demo and requested to discuss purchasing the assistant.",
        "",
        `Business: ${businessName}`,
        `Industry: ${industry}`,
        `Website: ${website}`,
        `Project ID: ${projectId}`,
        `Requested at: ${requestedAt}`,
      ].join("\n"),
      html: `
        <h2>AI Builder purchase request</h2>
        <p>A visitor completed the AI Builder demo and requested to discuss purchasing the assistant.</p>
        <table cellpadding="6" cellspacing="0" style="border-collapse:collapse">
          <tr><td><strong>Business</strong></td><td>${escapeHtml(businessName)}</td></tr>
          <tr><td><strong>Industry</strong></td><td>${escapeHtml(industry)}</td></tr>
          <tr><td><strong>Website</strong></td><td>${escapeHtml(website)}</td></tr>
          <tr><td><strong>Project ID</strong></td><td>${escapeHtml(projectId)}</td></tr>
          <tr><td><strong>Requested at</strong></td><td>${escapeHtml(requestedAt)}</td></tr>
        </table>
      `,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(
      `Resend rejected the purchase-interest email (${response.status}): ${responseText}`,
    );
  }

  return true;
}

export async function GET(request: Request) {
  let clerkUserId: string;
  try { clerkUserId = await requireClerkUserId(); }
  catch { return errorResponse(401, "authentication_required", "Sign in to use AI Builder."); }
  const requestUrl = new URL(request.url);
  const projectId = normalizeProjectId(
    requestUrl.searchParams.get("projectId"),
  );

  if (!projectId) {
    return errorResponse(400, "missing_project_id", "A project ID is required.");
  }

  try {
    await ensureAiBuilderSchema();
    const sql = getSql();

    const projectRows = (await sql`
      SELECT id
      FROM ai_builder_projects
      WHERE id = ${projectId}
        AND clerk_user_id = ${clerkUserId}
        AND archived_at IS NULL
      LIMIT 1
    `) as DatabaseRow[];

    if (!projectRows[0]) {
      return errorResponse(
        404,
        "project_not_found",
        "This AI Builder project could not be found.",
      );
    }

    const interestRows = (await sql`
      SELECT id
      FROM ai_builder_purchase_interest
      WHERE project_id = ${projectId}
      LIMIT 1
    `) as DatabaseRow[];

    return NextResponse.json({
      ok: true,
      alreadySubmitted: Boolean(interestRows[0]),
    });
  } catch (error) {
    console.error("AI_BUILDER_PURCHASE_INTEREST_STATUS_FAILED", {
      projectId,
      message: error instanceof Error ? error.message : "unknown_error",
    });

    return errorResponse(
      500,
      "purchase_interest_status_failed",
      "The purchase-request status could not be loaded.",
    );
  }
}

export async function POST(request: Request) {
  let clerkUserId: string;
  try { clerkUserId = await requireClerkUserId(); }
  catch { return errorResponse(401, "authentication_required", "Sign in to use AI Builder."); }
  let body: PurchaseInterestBody;

  try {
    body = (await request.json()) as PurchaseInterestBody;
  } catch {
    return errorResponse(
      400,
      "invalid_json",
      "The request body must be valid JSON.",
    );
  }

  const projectId = normalizeProjectId(body.projectId);

  if (!projectId) {
    return errorResponse(400, "missing_project_id", "A project ID is required.");
  }

  try {
    await ensureAiBuilderSchema();
    const sql = getSql();

    const projectRows = (await sql`
      SELECT id, business_name, industry, website
      FROM ai_builder_projects
      WHERE id = ${projectId}
        AND clerk_user_id = ${clerkUserId}
        AND archived_at IS NULL
      LIMIT 1
    `) as DatabaseRow[];

    const project = projectRows[0];

    if (!project) {
      return errorResponse(
        404,
        "project_not_found",
        "This AI Builder project could not be found.",
      );
    }

    const requestId = crypto.randomUUID();
    const insertedRows = (await sql`
      INSERT INTO ai_builder_purchase_interest (id, project_id)
      VALUES (${requestId}, ${projectId})
      ON CONFLICT (project_id) DO NOTHING
      RETURNING id
    `) as DatabaseRow[];

    if (!insertedRows[0]) {
      return NextResponse.json({
        ok: true,
        alreadySubmitted: true,
        emailSent: false,
      });
    }

    let emailSent = false;

    try {
      emailSent = await sendPurchaseInterestEmail(project);
    } catch (emailError) {
      console.error("AI_BUILDER_PURCHASE_INTEREST_EMAIL_FAILED", {
        projectId,
        message:
          emailError instanceof Error ? emailError.message : "unknown_error",
      });
    }

    return NextResponse.json({
      ok: true,
      alreadySubmitted: false,
      emailSent,
    });
  } catch (error) {
    console.error("AI_BUILDER_PURCHASE_INTEREST_CREATE_FAILED", {
      projectId,
      message: error instanceof Error ? error.message : "unknown_error",
    });

    return errorResponse(
      500,
      "purchase_interest_create_failed",
      "Your purchase request could not be sent.",
    );
  }
}
