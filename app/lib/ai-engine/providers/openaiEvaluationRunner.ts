import OpenAI from "openai";

export type OpenAiEvaluationInput = {
  prompt: string;
  model?: string | null;
};

export type OpenAiEvaluationOutput = {
  provider: "openai";
  model: string;
  response: string;
};

function getOpenAiClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("openai_api_key_missing");
  }

  return new OpenAI({ apiKey });
}

export async function runOpenAiEvaluation({
  prompt,
  model,
}: OpenAiEvaluationInput): Promise<OpenAiEvaluationOutput> {
  const normalizedPrompt = prompt.trim();

  if (!normalizedPrompt) {
    throw new Error("invalid_openai_evaluation_prompt");
  }

  const selectedModel =
    model?.trim() ||
    process.env.AI_BUILDER_QUALITY_MODEL?.trim() ||
    "gpt-5-mini";
  const client = getOpenAiClient();
  const result = await client.responses.create({
    model: selectedModel,
    instructions:
      "Follow the supplied evaluation contract exactly. Return one valid JSON object and no markdown or surrounding commentary.",
    input: normalizedPrompt,
  });
  const response = result.output_text.trim();

  if (!response) {
    throw new Error("openai_evaluation_output_empty");
  }

  return {
    provider: "openai",
    model: selectedModel,
    response,
  };
}
