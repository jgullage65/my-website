import { NextResponse } from "next/server";
import { isAuthenticationRequired } from "@/app/lib/auth/clerk";
import {
  getKnowledgeProvenanceDetail,
} from "@/app/lib/db/knowledge-provenance-repository";
import type {
  KnowledgeItemKind,
} from "@/app/lib/ai-engine/provenance/knowledgeProvenanceReadModel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    projectId: string;
    itemKind: string;
    itemId: string;
  }>;
};

function normalized(value: unknown): string {
  return String(value ?? "").trim();
}

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    { ok: false, error: { code, message } },
    { status },
  );
}

function itemKind(value: string): KnowledgeItemKind | null {
  return value === "context_entry" || value === "faq" ? value : null;
}

export async function GET(_request: Request, context: RouteContext) {
  const params = await context.params;
  const projectId = normalized(params.projectId);
  const itemId = normalized(params.itemId);
  const kind = itemKind(normalized(params.itemKind));

  if (!projectId) {
    return errorResponse(400, "missing_project_id", "A project ID is required.");
  }
  if (!kind) {
    return errorResponse(400, "invalid_item_kind", "The knowledge item kind is invalid.");
  }
  if (!itemId) {
    return errorResponse(400, "missing_item_id", "A knowledge item ID is required.");
  }

  try {
    const detail = await getKnowledgeProvenanceDetail({
      projectId,
      itemKind: kind,
      itemId,
    });

    if (!detail) {
      return errorResponse(
        404,
        "knowledge_item_not_found",
        "This knowledge item could not be found.",
      );
    }

    return NextResponse.json({ ok: true, detail });
  } catch (error) {
    if (isAuthenticationRequired(error)) {
      return errorResponse(401, "authentication_required", "Sign in to use AI Builder.");
    }

    console.error("AI_BUILDER_KNOWLEDGE_PROVENANCE_LOAD_FAILED", {
      projectId,
      itemKind: kind,
      itemId,
      message: error instanceof Error ? error.message : "unknown_error",
    });

    return errorResponse(
      500,
      "knowledge_provenance_load_failed",
      "The knowledge provenance could not be loaded.",
    );
  }
}
