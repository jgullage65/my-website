import { cookies } from "next/headers";
import type { IntakeModelInput } from "@/app/lib/ai-engine/intake";
import { runModel } from "@/app/lib/ai-engine/models/runModel";
import { resolveModel } from "@/app/lib/ai-engine/models/registry";
import {
  AI_BUILDER_MAX_FINAL_INPUT_CHARACTERS,
  AiBuilderInputBatchingError,
} from "@/app/lib/ai-engine/knowledge/websiteExtractionBatching";
import type { OpenAiIntakeCallMetadata } from "./openaiIntakeRunner";

const BUSINESS_CONTEXT_CATEGORIES = [
  "business_profile",
  "audience",
  "service",
  "pricing",
  "policy",
  "process",
  "differentiator",
  "faq",
  "behavior_rule",
  "prohibited_claim",
] as const;

const CONFIDENCE_VALUES = ["high", "medium", "low"] as const;

const intakeExtractionSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "facts",
    "faqCandidates",
    "conflicts",
    "missingInformation",
    "summary",
  ],
  properties: {
    facts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "temporaryId",
          "category",
          "title",
          "content",
          "confidence",
          "confidenceScore",
          "sourceBlockId",
          "sourceExcerpt",
          "tags",
        ],
        properties: {
          temporaryId: { type: "string" },
          category: { type: "string", enum: BUSINESS_CONTEXT_CATEGORIES },
          title: { type: "string" },
          content: { type: "string" },
          confidence: { type: "string", enum: CONFIDENCE_VALUES },
          confidenceScore: { type: "number", minimum: 0, maximum: 1 },
          sourceBlockId: { type: "string" },
          sourceExcerpt: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
        },
      },
    },
    faqCandidates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "temporaryId",
          "question",
          "answer",
          "confidence",
          "confidenceScore",
          "sourceBlockIds",
          "sourceExcerpts",
          "sourceFactIds",
        ],
        properties: {
          temporaryId: { type: "string" },
          question: { type: "string" },
          answer: { type: "string" },
          confidence: { type: "string", enum: CONFIDENCE_VALUES },
          confidenceScore: { type: "number", minimum: 0, maximum: 1 },
          sourceBlockIds: { type: "array", items: { type: "string" } },
          sourceExcerpts: { type: "array", items: { type: "string" } },
          sourceFactIds: { type: "array", items: { type: "string" } },
        },
      },
    },
    conflicts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "temporaryId",
          "topic",
          "firstStatement",
          "secondStatement",
          "sourceBlockIds",
          "sourceExcerpts",
          "suggestedQuestion",
        ],
        properties: {
          temporaryId: { type: "string" },
          topic: { type: "string" },
          firstStatement: { type: "string" },
          secondStatement: { type: "string" },
          sourceBlockIds: { type: "array", items: { type: "string" } },
          sourceExcerpts: { type: "array", items: { type: "string" } },
          suggestedQuestion: { type: "string" },
        },
      },
    },
    missingInformation: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["temporaryId", "topic", "reason", "suggestedQuestion"],
        properties: {
          temporaryId: { type: "string" },
          topic: { type: "string" },
          reason: { type: "string" },
          suggestedQuestion: { type: "string" },
        },
      },
    },
    summary: {
      type: "object",
      additionalProperties: false,
      required: ["businessName", "businessType", "primaryAudience"],
      properties: {
        businessName: { type: ["string", "null"] },
        businessType: { type: ["string", "null"] },
        primaryAudience: { type: ["string", "null"] },
      },
    },
  },
} as const;

function parseStructuredOutput(outputText: string): unknown {
  const normalized = outputText.trim();
  if (!normalized) throw new Error("intake_output_empty");

  const unfenced = normalized
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    return JSON.parse(unfenced) as unknown;
  } catch {
    throw new Error("intake_output_invalid_json");
  }
}

export const runOpenAiIntakeModel = async (
  input: IntakeModelInput,
  onComplete?: (metadata: OpenAiIntakeCallMetadata) => void,
): Promise<unknown> => {
  const cookieStore = await cookies();
  const requestedModelId = cookieStore.get("ai_builder_model_id")?.value;
  const selectedModel = resolveModel(requestedModelId, "crawl");
  const schemaInstruction = [
    input.systemPrompt,
    "Return only valid JSON. Do not use markdown fences or add commentary.",
    `The JSON must exactly match this schema: ${JSON.stringify(intakeExtractionSchema)}`,
  ].join("\n\n");

  const finalInputCharacterCount = JSON.stringify({
    instructions: schemaInstruction,
    input: input.userPrompt,
  }).length;

  if (finalInputCharacterCount > AI_BUILDER_MAX_FINAL_INPUT_CHARACTERS) {
    throw new AiBuilderInputBatchingError(
      `intake extraction input is ${finalInputCharacterCount} characters`,
    );
  }

  const response = await runModel({
    modelId: selectedModel.id,
    purpose: "crawl",
    instructions: schemaInstruction,
    messages: [{ role: "user", content: input.userPrompt }],
  });

  onComplete?.({
    model: response.modelId,
    requestId: response.requestId ?? undefined,
    providerStatus: response.status,
    usage: {
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      totalTokens: response.usage.totalTokens,
    },
  });

  return parseStructuredOutput(response.text);
};
