import { NextResponse } from "next/server";
import type { ConversationMemory } from "@/app/lib/ai-engine/contracts";
import { runOpenAiIntakeModel } from "@/app/lib/ai-engine/providers";
import { runEngine } from "@/app/lib/ai-engine/runtime";
import { persistAiBuilderProject } from "@/app/lib/db/ai-builder-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UserKnowledgeRequest = {
  productsServices?: unknown;
  idealCustomers?: unknown;
  additionalKnowledge?: unknown;
};

type WebsiteKnowledgeRequest = {
  businessName?: unknown;
  industry?: unknown;
  website?: unknown;
  productsServices?: unknown;
  idealCustomers?: unknown;
  additionalKnowledge?: unknown;
  pages?: unknown;
  warnings?: unknown;
  importedAt?: unknown;
};

type IntakeRequestBody = {
  businessName?: unknown;
  industry?: unknown;
  website?: unknown;
  tone?: unknown;
  userKnowledge?: UserKnowledgeRequest;
  websiteKnowledge?: WebsiteKnowledgeRequest | null;
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

  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
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

function addKnowledgeBlock(
  blocks: Array<{
    id: string;
    label: string;
    content: string;
  }>,
  prefix: string,
  label: string,
  content: string,
) {
  if (!content) return;

  blocks.push({
    id: createId(prefix),
    label,
    content,
  });
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
  const tone = normalizeText(body.tone) || "Professional";

  const userProductsServices = normalizeText(
    body.userKnowledge?.productsServices,
  );
  const userIdealCustomers = normalizeText(
    body.userKnowledge?.idealCustomers,
  );
  const userAdditionalKnowledge = normalizeText(
    body.userKnowledge?.additionalKnowledge,
  );

  const websiteKnowledge = body.websiteKnowledge ?? null;
  const websiteBusinessName = normalizeText(websiteKnowledge?.businessName);
  const websiteIndustry = normalizeText(websiteKnowledge?.industry);
  const websiteSourceUrl = normalizeText(websiteKnowledge?.website);
  const websiteProductsServices = normalizeText(
    websiteKnowledge?.productsServices,
  );
  const websiteIdealCustomers = normalizeText(
    websiteKnowledge?.idealCustomers,
  );
  const websiteAdditionalKnowledge = normalizeText(
    websiteKnowledge?.additionalKnowledge,
  );
  const importedAt = normalizeText(websiteKnowledge?.importedAt);

  const effectiveProductsServices =
    userProductsServices || websiteProductsServices;
  const effectiveIdealCustomers =
    userIdealCustomers || websiteIdealCustomers;
  const assistantName = `${businessName} AI`;

  if (
    !businessName ||
    !industry ||
    !effectiveProductsServices ||
    !effectiveIdealCustomers
  ) {
    return errorResponse(
      400,
      "missing_required_fields",
      "Business name, industry, products or services, and ideal customers are required from either the website import or manual knowledge.",
    );
  }

  const totalKnowledgeLength =
    businessName.length +
    industry.length +
    website.length +
    userProductsServices.length +
    userIdealCustomers.length +
    userAdditionalKnowledge.length +
    websiteBusinessName.length +
    websiteIndustry.length +
    websiteSourceUrl.length +
    websiteProductsServices.length +
    websiteIdealCustomers.length +
    websiteAdditionalKnowledge.length;

  if (
    effectiveProductsServices.length < 40 ||
    effectiveIdealCustomers.length < 30
  ) {
    return errorResponse(
      400,
      "business_information_too_short",
      "Add more detail about what the business sells and who it serves so the system can build a useful assistant.",
    );
  }

  if (totalKnowledgeLength > 60000) {
    return errorResponse(
      400,
      "business_information_too_long",
      "The combined website and manual business information must be 60,000 characters or fewer.",
    );
  }

  const sessionId = createId("ai_builder_session");
  const threadId = createId("ai_builder_thread");
  const blocks: Array<{
    id: string;
    label: string;
    content: string;
  }> = [];

  addKnowledgeBlock(
    blocks,
    "business_profile_block",
    "Business profile",
    [
      `Business name: ${businessName}`,
      `Industry or business type: ${industry}`,
      website ? `Website: ${website}` : "Website: Not provided",
    ].join("\n"),
  );

  addKnowledgeBlock(
    blocks,
    "user_products_services_block",
    "USER-PROVIDED KNOWLEDGE: Products and services",
    userProductsServices,
  );
  addKnowledgeBlock(
    blocks,
    "user_ideal_customers_block",
    "USER-PROVIDED KNOWLEDGE: Ideal customers",
    userIdealCustomers,
  );
  addKnowledgeBlock(
    blocks,
    "user_additional_knowledge_block",
    "USER-PROVIDED KNOWLEDGE: Additional business knowledge",
    userAdditionalKnowledge,
  );

  addKnowledgeBlock(
    blocks,
    "website_profile_block",
    "WEBSITE KNOWLEDGE: Public business profile",
    [
      websiteBusinessName
        ? `Website business name: ${websiteBusinessName}`
        : "",
      websiteIndustry ? `Website industry: ${websiteIndustry}` : "",
      websiteSourceUrl ? `Website source: ${websiteSourceUrl}` : "",
      importedAt ? `Imported at: ${importedAt}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
  addKnowledgeBlock(
    blocks,
    "website_products_services_block",
    "WEBSITE KNOWLEDGE: Products and services",
    websiteProductsServices,
  );
  addKnowledgeBlock(
    blocks,
    "website_ideal_customers_block",
    "WEBSITE KNOWLEDGE: Ideal customers",
    websiteIdealCustomers,
  );
  addKnowledgeBlock(
    blocks,
    "website_additional_knowledge_block",
    "WEBSITE KNOWLEDGE: Additional business knowledge",
    websiteAdditionalKnowledge,
  );

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        const line = `${JSON.stringify(event)}\n`;
        const padding = " ".repeat(Math.max(0, 2048 - line.length));
        controller.enqueue(encoder.encode(`${line}${padding}\n`));
      };

      try {
        send({ type: "progress", percent: 0 });
        const initialMemory = buildEmptyConversationMemory(threadId);
        send({ type: "progress", percent: 20 });

        const session = await runEngine({
          request: {
            sessionId,
            blocks,
            assistantPurpose: [
              `Act as ${assistantName}, the business AI for ${businessName}.`,
              `The business operates in this industry: ${industry}.`,
              "Answer using approved business knowledge only.",
              "USER-PROVIDED KNOWLEDGE has higher authority than WEBSITE KNOWLEDGE.",
              "When the two sources conflict, follow the user-provided knowledge and do not repeat the conflicting website claim as current fact.",
              "Website knowledge may supplement topics the user did not address.",
              "Be accurate, useful, and transparent when information is missing.",
            ].join(" "),
            assistantTone: tone,
          },
          state: {
            conversationMemory: initialMemory,
          },
          dependencies: {
            runIntakeModel: runOpenAiIntakeModel,
          },
        });

        send({ type: "progress", percent: 80 });

        session.assistantConfiguration = {
          ...session.assistantConfiguration,
          name: assistantName,
          tone,
        };

        send({ type: "progress", percent: 90 });

        await persistAiBuilderProject({
          session,
          businessName,
          industry,
          website: website || null,
          initialThread: {
            id: threadId,
            memory: initialMemory,
          },
        });

        send({ type: "progress", percent: 100 });
        send({
          type: "result",
          ok: true,
          projectId: session.id,
          session,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "unknown_error";

        if (message === "openai_api_key_missing") {
          send({
            type: "error",
            error: {
              code: "openai_not_configured",
              message: "The AI builder is not configured yet.",
            },
          });
          return;
        }

        console.error("AI_BUILDER_INTAKE_FAILED", {
          message,
        });

        send({
          type: "error",
          error: {
            code: "intake_failed",
            message: "The AI builder could not process this business information.",
          },
        });
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "Content-Encoding": "none",
    },
  });
}