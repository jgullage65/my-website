:
import { NextResponse } from "next/server";
import type { ConversationMemory } from "@/app/lib/ai-engine/contracts";
import { runOpenAiIntakeModel } from "@/app/lib/ai-engine/providers";
import { runEngine } from "@/app/lib/ai-engine/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IntakeRequestBody = {
  businessName?: unknown;
  assistantName?: unknown;
  tone?: unknown;
  description?: unknown;
};

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function createId(prefix: string): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random()
    .toString(16)
    .slice(2)}`;
}

function buildEmptyConversationMemory(
  threadId: string,
): ConversationMemory {
  return {
    threadId,
    currentSubject: null,
    customerGoal: null,
    selectedService: null,
    collectedDetails: [],
    unresolvedQuestions: [],
    recentClarifications: [],
    summary: "Thread not started.",
    updatedAt: new Date().toISOString(),
  };
}

function errorResponse(
  status: number,
  code: string,
  message: string,
) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
      },
    },
    { status },
  );
}

export async function POST(request: Request) {
  let body: IntakeRequestBody;

  try {
    body = (await request.json()) as IntakeRequestBody;
  } catch {
    return errorResponse(
      400,
      "invalid_json",
      "The request body must be valid JSON.",
    );
  }

  const businessName = normalizeText(body.businessName);
  const assistantName = normalizeText(body.assistantName);
  const tone = normalizeText(body.tone) || "Professional";
  const description = normalizeText(body.description);

  if (!businessName || !assistantName || !description) {
    return errorResponse(
      400,
      "missing_required_fields",
      "Business name, assistant name, and business description are required.",
    );
  }

  if (description.length < 80) {
    return errorResponse(
      400,
      "description_too_short",
      "Add more business information so the system has enough context to build a useful assistant.",
    );
  }

  if (description.length > 30000) {
    return errorResponse(
      400,
      "description_too_long",
      "The business description must be 30,000 characters or fewer.",
    );
  }

  const sessionId = createId("ai_builder_session");
  const threadId = createId("ai_builder_thread");

  try {
    const session = await runEngine({
      request: {
        sessionId,
        blocks: [
          {
            id: createId("intake_block"),
            label: `${businessName} business information`,
            content: description,
          },
        ],
        assistantPurpose: `Act as ${assistantName}, a business assistant for ${businessName}.`,
        assistantTone: tone,
      },
      state: {
        conversationMemory:
          buildEmptyConversationMemory(threadId),
      },
      dependencies: {
        runIntakeModel: runOpenAiIntakeModel,
      },
    });

    session.assistantConfiguration = {
      ...session.assistantConfiguration,
      name: assistantName,
      tone,
    };

    return NextResponse.json({
      ok: true,
      session,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown_error";

    if (message === "openai_api_key_missing") {
      return errorResponse(
        503,
        "openai_not_configured",
        "The AI builder is not configured yet.",
      );
    }

    console.error("AI_BUILDER_INTAKE_FAILED", {
      message,
    });

    return errorResponse(
      500,
      "intake_failed",
      "The AI builder could not process this business information.",
    );
  }
}
