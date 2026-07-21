import { NextResponse } from "next/server";
import type { ConversationMemory } from "@/app/lib/ai-engine/contracts";
import { runOpenAiIntakeModel } from "@/app/lib/ai-engine/providers";
import type { OpenAiIntakeCallMetadata } from "@/app/lib/ai-engine/providers/openaiIntakeRunner";
import { runEngine } from "@/app/lib/ai-engine/runtime";
import { persistAiBuilderProject } from "@/app/lib/db/ai-builder-repository";
import { finishGenerationTelemetry, linkCrawlTelemetry, startGenerationTelemetry } from "@/app/lib/telemetry/ai-builder-telemetry";
import { requireClerkUserId } from "@/app/lib/auth/clerk";
import {
  WEBSITE_KNOWLEDGE_CATEGORIES,
  WEBSITE_KNOWLEDGE_CONFIDENCE_LEVELS,
  WEBSITE_KNOWLEDGE_COVERAGE_FIELDS,
  type PersistedWebsiteKnowledge,
  type StructuredWebsiteKnowledge,
  reconcileStructuredWebsiteKnowledge,
} from "@/app/lib/ai-engine/knowledge/websiteKnowledge";

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
  knowledge?: unknown;
  pages?: unknown;
  warnings?: unknown;
  importedAt?: unknown;
  crawlAttemptId?: unknown;
};

type IntakeRequestBody = {
  businessName?: unknown;
  industry?: unknown;
  website?: unknown;
  tone?: unknown;
  userKnowledge?: UserKnowledgeRequest;
  websiteKnowledge?: WebsiteKnowledgeRequest | null;
  crawlAttemptIds?: unknown;
};

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeBoundedText(value: unknown, maximumLength: number): string {
  return normalizeText(value).slice(0, maximumLength);
}

function normalizeWebsiteUrl(value: unknown): string {
  const url = normalizeBoundedText(value, 2_048);
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

const websiteKnowledgeCategories = new Set<string>(WEBSITE_KNOWLEDGE_CATEGORIES);
const websiteKnowledgeConfidenceLevels = new Set<string>(WEBSITE_KNOWLEDGE_CONFIDENCE_LEVELS);

function normalizeSubmittedWebsiteKnowledge(value: unknown): StructuredWebsiteKnowledge | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const raw = value as Record<string, unknown>;
  let hasValidValue = false;
  const facts = (Array.isArray(raw.facts) ? raw.facts : []).slice(0, 100).flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const fact = item as Record<string, unknown>;
    const category = normalizeBoundedText(fact.category, 64);
    const title = normalizeBoundedText(fact.title, 300);
    const factValue = normalizeBoundedText(fact.value, 4_000);
    const confidence = normalizeBoundedText(fact.confidence, 32);
    const evidence = (Array.isArray(fact.evidence) ? fact.evidence : []).slice(0, 8).flatMap((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
      const item = entry as Record<string, unknown>;
      const url = normalizeWebsiteUrl(item.url);
      const excerpt = normalizeBoundedText(item.excerpt, 1_000);
      return url && excerpt ? [{ url, excerpt }] : [];
    });

    if (!websiteKnowledgeCategories.has(category) || !title || !factValue || !websiteKnowledgeConfidenceLevels.has(confidence) || !evidence.length) return [];
    hasValidValue = true;
    return [{ category, title, value: factValue, confidence, evidence }] as StructuredWebsiteKnowledge["facts"];
  });

  const rawCoverage = raw.coverage && typeof raw.coverage === "object" && !Array.isArray(raw.coverage)
    ? raw.coverage as Record<string, unknown>
    : {};
  const coverage = Object.fromEntries(WEBSITE_KNOWLEDGE_COVERAGE_FIELDS.map((field) => {
    const rawValue = rawCoverage[field];
    const number = typeof rawValue === "number" ? rawValue : Number(rawValue);
    if (Number.isFinite(number)) hasValidValue = true;
    return [field, Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : 0];
  })) as StructuredWebsiteKnowledge["coverage"];
  const unresolvedQuestions = (Array.isArray(raw.unresolvedQuestions) ? raw.unresolvedQuestions : [])
    .slice(0, 100)
    .map((item) => normalizeBoundedText(item, 500))
    .filter(Boolean);
  if (unresolvedQuestions.length) hasValidValue = true;

  return hasValidValue ? { facts, coverage, unresolvedQuestions } : null;
}

function normalizePersistedWebsiteKnowledge(params: {
  knowledge: unknown;
  crawlAttemptId: string;
  importedAt: string;
  requestedUrl: string;
  resolvedUrl: string;
  pages: unknown;
  warnings: unknown;
}): PersistedWebsiteKnowledge | null {
  const knowledge = normalizeSubmittedWebsiteKnowledge(params.knowledge);
  if (!knowledge) return null;

  const pages = (Array.isArray(params.pages) ? params.pages : []).slice(0, 20).flatMap((page) => {
    if (!page || typeof page !== "object" || Array.isArray(page)) return [];
    const item = page as Record<string, unknown>;
    const url = normalizeWebsiteUrl(item.url);
    const title = normalizeBoundedText(item.title, 500);
    const pageType = normalizeBoundedText(item.pageType, 100);
    return url ? [{ url, title, pageType }] : [];
  });
  const warnings = (Array.isArray(params.warnings) ? params.warnings : []).slice(0, 100)
    .map((warning) => normalizeBoundedText(warning, 500))
    .filter(Boolean);

  return {
    schema_version: 1,
    document_version: 1,
    current_crawl_attempt_id: normalizeBoundedText(params.crawlAttemptId, 200) || null,
    imported_at: normalizeBoundedText(params.importedAt, 100) || null,
    requested_url: normalizeWebsiteUrl(params.requestedUrl) || null,
    resolved_url: normalizeWebsiteUrl(params.resolvedUrl) || null,
    pages,
    warnings,
    knowledge,
  };
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
  try {
    await requireClerkUserId();
  } catch {
    return errorResponse(401, "authentication_required", "Sign in to use AI Builder.");
  }

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
  const crawlAttemptId = normalizeText(websiteKnowledge?.crawlAttemptId);
  const crawlAttemptIds = Array.isArray(body.crawlAttemptIds)
    ? body.crawlAttemptIds.map(normalizeText).filter(Boolean).slice(0, 20)
    : [];
  if (crawlAttemptId && !crawlAttemptIds.includes(crawlAttemptId)) {
    crawlAttemptIds.push(crawlAttemptId);
  }
  const persistedWebsiteKnowledge = normalizePersistedWebsiteKnowledge({
    knowledge: websiteKnowledge?.knowledge,
    crawlAttemptId,
    importedAt,
    requestedUrl: website,
    resolvedUrl: websiteSourceUrl,
    pages: websiteKnowledge?.pages,
    warnings: websiteKnowledge?.warnings,
  });

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
  const generationAttemptId = crypto.randomUUID();
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
      let generationStartedAt = new Date().toISOString();
      let generationFinished = false;
      let generationStage = "initialization";
      let providerMetadata: OpenAiIntakeCallMetadata | undefined;
      const send = (event: Record<string, unknown>) => {
        const line = `${JSON.stringify(event)}\n`;
        const padding = " ".repeat(Math.max(0, 2048 - line.length));
        controller.enqueue(encoder.encode(`${line}${padding}\n`));
      };

      try {
        await startGenerationTelemetry(generationAttemptId,sessionId,generationStartedAt);
        send({ type: "progress", percent: 0 });
        const initialMemory = buildEmptyConversationMemory(threadId);
        send({ type: "progress", percent: 20 });

        generationStartedAt = new Date().toISOString();
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
            runIntakeModel: (input) => { generationStage="provider_request"; return runOpenAiIntakeModel(input,(metadata)=>{providerMetadata=metadata;generationStage="output_validation";}); },
          },
        });
        await finishGenerationTelemetry(generationAttemptId,{status:"completed",startedAt:generationStartedAt,completedAt:new Date().toISOString(),model:providerMetadata?.model||process.env.AI_BUILDER_INTAKE_MODEL?.trim()||"gpt-5-mini",usage:providerMetadata?.usage,providerMetadata,knowledgeCount:session.contextEntries.length,faqCount:session.faqEntries.length});
        generationFinished = true;

        send({ type: "progress", percent: 80 });

        session.assistantConfiguration = {
          ...session.assistantConfiguration,
          name: assistantName,
          tone,
        };

        // The stream and the database must agree: website facts become durable
        // review rows before this session is ever returned to the browser.
        const reconciledSession = reconcileStructuredWebsiteKnowledge(
          session,
          persistedWebsiteKnowledge?.knowledge,
          { defaultStatus: "proposed" },
        );

        send({ type: "progress", percent: 90 });

        await persistAiBuilderProject({
          session: reconciledSession,
          businessName,
          industry,
          website: website || null,
          websiteKnowledge: persistedWebsiteKnowledge,
          initialThread: {
            id: threadId,
            memory: initialMemory,
          },
        });
        await Promise.all(
          crawlAttemptIds.map((attemptId) =>
            linkCrawlTelemetry(attemptId, session.id),
          ),
        );

        send({ type: "progress", percent: 100 });
        send({
          type: "result",
          ok: true,
          projectId: reconciledSession.id,
          session: reconciledSession,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "unknown_error";
        if (!generationFinished) await finishGenerationTelemetry(generationAttemptId,{status:"failed",startedAt:generationStartedAt,completedAt:new Date().toISOString(),model:providerMetadata?.model||process.env.AI_BUILDER_INTAKE_MODEL?.trim()||"gpt-5-mini",usage:providerMetadata?.usage,providerMetadata,errors:[{stage:generationStage,message:message.slice(0,500)}],failureStage:generationStage});

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
