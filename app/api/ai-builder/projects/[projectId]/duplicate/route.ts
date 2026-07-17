import { NextResponse } from "next/server";
import type { AiBuilderSession, ConversationMemory } from "@/app/lib/ai-engine/contracts";
import {
  getAiBuilderProject,
  persistAiBuilderProject,
} from "@/app/lib/db/ai-builder-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ projectId: string }> };

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export async function POST(_request: Request, context: RouteContext) {
  const { projectId } = await context.params;

  try {
    const source = await getAiBuilderProject(String(projectId ?? "").trim());
    if (!source) {
      return NextResponse.json(
        { ok: false, error: { message: "This AI Builder project could not be found." } },
        { status: 404 },
      );
    }

    const now = new Date().toISOString();
    const sessionId = id("session");
    const threadId = id("thread");
    const contextIds = new Map(source.session.contextEntries.map((entry) => [entry.id, id("context")]));
    const session: AiBuilderSession = {
      ...source.session,
      id: sessionId,
      intakeBlocks: source.session.intakeBlocks.map((block) => ({ ...block, id: id("intake"), createdAt: now, updatedAt: now })),
      contextEntries: source.session.contextEntries.map((entry) => ({ ...entry, id: contextIds.get(entry.id)!, sessionId, createdAt: now, updatedAt: now })),
      faqEntries: source.session.faqEntries.map((entry) => ({
        ...entry,
        id: id("faq"),
        sessionId,
        sourceEntryIds: entry.sourceEntryIds.map((entryId) => contextIds.get(entryId) ?? entryId),
        createdAt: now,
        updatedAt: now,
      })),
      conflicts: source.session.conflicts.map((conflict) => ({ ...conflict, id: id("conflict") })),
      missingInformation: source.session.missingInformation.map((item) => ({ ...item, id: id("missing") })),
      buildProgress: source.session.buildProgress.map((progress) => ({ ...progress, createdAt: now })),
      createdAt: now,
      updatedAt: now,
    };
    const memory: ConversationMemory = {
      threadId,
      currentSubject: null,
      customerGoal: null,
      selectedService: null,
      collectedDetails: [],
      unresolvedQuestions: [],
      recentClarifications: [],
      summary: "Thread not started.",
      updatedAt: now,
    };

    await persistAiBuilderProject({
      session,
      businessName: `${source.businessName} (Copy)`,
      industry: source.industry,
      website: source.website,
      initialThread: { id: threadId, memory },
    });

    return NextResponse.json({ ok: true, projectId: sessionId });
  } catch (error) {
    console.error("AI_BUILDER_PROJECT_DUPLICATE_FAILED", {
      projectId,
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.json(
      { ok: false, error: { message: "The project could not be duplicated." } },
      { status: 500 },
    );
  }
}
