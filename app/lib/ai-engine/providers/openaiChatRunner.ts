import OpenAI from "openai";

type OpenAiChatInput = {
  systemPrompt: string;
  message: string;
};

function getOpenAiClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("openai_api_key_missing");
  }

  return new OpenAI({ apiKey });
}

export async function runOpenAiChat({
  systemPrompt,
  message,
}: OpenAiChatInput): Promise<string> {
  const client = getOpenAiClient();
  const model =
    process.env.AI_BUILDER_CHAT_MODEL?.trim() || "gpt-5-mini";

  const response = await client.responses.create({
    model,
    instructions: systemPrompt,
    input: message,
  });

  const answer = response.output_text.trim();

  if (!answer) {
    throw new Error("openai_chat_output_empty");
  }

  return answer;
}
