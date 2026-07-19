import { NextResponse } from "next/server";
import { listAiBuilderProjects } from "@/app/lib/db/ai-builder-repository";
import { isAuthenticationRequired } from "@/app/lib/auth/clerk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const projects = await listAiBuilderProjects();
    return NextResponse.json({ ok: true, projects });
  } catch (error) {
    if (isAuthenticationRequired(error)) {
      return NextResponse.json(
        { ok: false, error: { code: "authentication_required", message: "Sign in to view AI Builder projects." } },
        { status: 401 },
      );
    }
    console.error("AI_BUILDER_PROJECT_LIST_FAILED", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.json(
      { ok: false, error: { message: "Your AI Builder projects could not be loaded." } },
      { status: 500 },
    );
  }
}
