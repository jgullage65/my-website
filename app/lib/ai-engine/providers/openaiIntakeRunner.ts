:
import OpenAI from "openai";
import type {
  IntakeModelInput,
  IntakeModelRunner,
} from "@/app/lib/ai-engine/intake";

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
          category: {
            type: "string",
            enum: BUSINESS_CONTEXT_CATEGORIES,
          },
          title: { type: "string" },
          content: { type: "string" },
          confidence: {
            type: "string",
            enum: CONFIDENCE_VALUES,
          },
          confidenceScore: {
            type: "number",
            minimum: 0,
            maximum: 1,
          },
          sourceBlockId: { type: "string" },
          sourceExcerpt: { type: "string" },
          tags: {
            type: "array",
            items: { type: "string" },
          },
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
          confidence: {
            type: "string",
            enum: CONFIDENCE_VALUES,
          },
          confidenceScore: {
            type: "number",
            minimum: 0,
            maximum: 1,
          },
          sourceBlockIds: {
            type: "array",
            items: { type: "string" },
          },
          sourceExcerpts: {
            type: "array",
            items: { type: "string" },
          },
          sourceFactIds: {
            type: "array",
            items: { type: "string" },
          },
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
          sourceBlockIds: {
            type: "array",
            items: { type: "string" },
          },
          sourceExcerpts: {
            type: "array",
            items: { type: "string" },
          },
          suggestedQuestion: { type: "string" },
        },
      },
    },
    missingInformation: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "temporaryId",
          "topic",
          "reason",
          "suggestedQuestion",
        ],
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
      required: [
        "businessName",
        "businessType",
        "primaryAudience",
      ],
      properties: {
        businessName: {
          type: ["string", "null"],
        },
        businessType: {
          type: ["string", "null"],
        },
        primaryAudience: {
          type: ["string", "null"],
        },
      },
    },
  },
} as const;

function getOpenAiClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("openai_api_key_missing");
  }

  return new OpenAI({ apiKey });
}

function parseStructuredOutput(outputText: string): unknown {
  const normalized = outputText.trim();

  if (!normalized) {
    throw new Error("openai_intake_output_empty");
  }

  try {
    return JSON.parse(normalized) as unknown;
  } catch {
    throw new Error("openai_intake_output_invalid_json");
  }
}

export const runOpenAiIntakeModel: IntakeModelRunner = async (
  input: IntakeModelInput,
): Promise<unknown> => {
  const client = getOpenAiClient();
  const model =
    process.env.AI_BUILDER_INTAKE_MODEL?.trim() || "gpt-5-mini";

  const response = await client.responses.create({
    model,
    instructions: input.systemPrompt,
    input: input.userPrompt,
    text: {
      format: {
        type: "json_schema",
        name: input.responseFormatName,
        strict: true,
        schema: intakeExtractionSchema,
      },
    },
  });

  return parseStructuredOutput(response.output_text);
};
