import { NextResponse } from "next/server";
import type { ConversationMemory } from "@/app/lib/ai-engine/contracts";
import { runOpenAiIntakeModel } from "@/app/lib/ai-engine/providers";
import { runEngine } from "@/app/lib/ai-engine/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IntakeRequestBody = {
  businessName?: unknown;
  industry?: unknown;
  website?: unknown;
  productsServices?: unknown;
  idealCustomers?: unknown;
  tone?: unknown;
  additionalKnowledge?: unknown;
};

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
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
  const industry = normalizeText(body.industry);
  const website = normalizeText(body.website);
  const productsServices = normalizeText(body.productsServices);
  const idealCustomers = normalizeText(body.idealCustomers);
  const tone = normalizeText(body.tone) || "Professional";
  const additionalKnowledge = normalizeText(body.additionalKnowledge);
  const assistantName = `${businessName} AI`;

  if (
    !businessName ||
    !industry ||
    !productsServices ||
    !idealCustomers
  ) {
    return errorResponse(
      400,
      "missing_required_fields",
      "Business name, industry, products or services, and ideal customers are required.",
    );
  }

  const totalKnowledgeLength =
    businessName.length +
    industry.length +
    website.length +
    productsServices.length +
    idealCustomers.length +
    additionalKnowledge.length;

  if (productsServices.length < 40 || idealCustomers.length < 30) {
    return errorResponse(
      400,
      "business_information_too_short",
      "Add more detail about what the business sells and who it serves so the system can build a useful assistant.",
    );
  }

  if (totalKnowledgeLength > 30000) {
    return errorResponse(
      400,
      "business_information_too_long",
      "The combined business information must be 30,000 characters or fewer.",
    );
  }

  const sessionId = createId("ai_builder_session");
  const threadId = createId("ai_builder_thread");

  const blocks = [
    {
      id: createId("business_profile_block"),
      label: "Business profile",
      content: [
        `Business name: ${businessName}`,
        `Industry or business type: ${industry}`,
        website ? `Website: ${website}` : "Website: Not provided",
      ].join("\n"),
    },
    {
      id: createId("products_services_block"),
      label: "Products and services",
      content: productsServices,
    },
    {
      id: createId("ideal_customers_block"),
      label: "Ideal customers",
      content: idealCustomers,
    },
  ];

  if (additionalKnowledge) {
    blocks.push({
      id: createId("additional_knowledge_block"),
      label: "Additional business knowledge",
      content: additionalKnowledge,
    });
  }

  try {
    const session = await runEngine({
      request: {
        sessionId,
        blocks,
        assistantPurpose: [
          `Act as ${assistantName}, the business AI for ${businessName}.`,
          `The business operates in this industry: ${industry}.`,
          "Answer using approved business knowledge only.",
          "Be accurate, useful, and transparent when information is missing.",
        ].join(" "),
        assistantTone: tone,
      },
      state: {
        conversationMemory: buildEmptyConversationMemory(threadId),
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
