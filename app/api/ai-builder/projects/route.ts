import { NextResponse } from "next/server";
import { listAiBuilderProjects } from "@/app/lib/db/ai-builder-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const projects = await listAiBuilderProjects();
    return NextResponse.json({ ok: true, projects });
  } catch (error) {
    console.error("AI_BUILDER_PROJECT_LIST_FAILED", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.json(
      { ok: false, error: { message: "Your AI Builder projects could not be loaded." } },
      { status: 500 },
    );
  }
}
