import { NextResponse } from "next/server";
import { getAiBuilderProject } from "@/app/lib/db/ai-builder-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  const normalizedProjectId = String(projectId ?? "").trim();

  if (!normalizedProjectId) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "missing_project_id",
          message: "A project ID is required.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const project = await getAiBuilderProject(normalizedProjectId);

    if (!project) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "project_not_found",
            message: "This AI Builder project could not be found.",
          },
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      projectId: project.session.id,
      session: project.session,
      builder: {
        businessName: project.businessName,
        industry: project.industry,
        website: project.website ?? "",
        tone: project.session.assistantConfiguration.tone,
      },
    });
  } catch (error) {
    console.error("AI_BUILDER_PROJECT_LOAD_FAILED", {
      projectId: normalizedProjectId,
      message: error instanceof Error ? error.message : "unknown_error",
    });

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "project_load_failed",
          message: "The AI Builder project could not be loaded.",
        },
      },
      { status: 500 },
    );
  }
}
