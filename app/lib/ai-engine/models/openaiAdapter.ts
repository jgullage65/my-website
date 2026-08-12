import OpenAI from "openai";
import type { AdapterInput, ModelCompletionStatus, NormalizedUsage } from "./perplexityAdapter";
import { ModelExecutionError } from "./perplexityAdapter";

function classifyOpenAiError(error: unknown): ModelExecutionError {
  if (error instanceof ModelExecutionError) return error;

  const candidate = error as {
    status?: number;
    message?: string;
  };
  const status = typeof candidate?.status === "number" ? candidate.status : undefined;
  const providerMessage = typeof candidate?.message === "string" ? candidate.message : "openai_request_failed";

  const category =
    status === 401 || status === 403
      ? "authentication"
      : status === 429
        ? "rate_limit"
        : status === 404 || (status !== undefined && status >= 500)
          ? "availability"
          : "provider";

  return new ModelExecutionError(category, providerMessage);
}

function resolveOpenAiApiKey(input: AdapterInput): string | undefined {
  if (input.model.id === "leadforge-gpt-5-5") {
    return process.env.LEADFORGE_OPENAI_API_KEY?.trim();
  }
  return process.env.OPENAI_API_KEY?.trim();
}

export async function runOpenAI(input: AdapterInput) {
  const apiKey = resolveOpenAiApiKey(input);
  if (!apiKey) {
    throw new ModelExecutionError(
      "configuration",
      input.model.id === "leadforge-gpt-5-5"
        ? "leadforge_model_gateway_not_configured"
        : "model_gateway_not_configured",
    );
  }

  const model = input.model.gatewayModelId;
  if (!model) {
    throw new ModelExecutionError("configuration", "model_unavailable");
  }

  const client = new OpenAI({ apiKey, timeout: input.timeoutMs });
  const started = performance.now();

  try {
    const response = await client.responses.create(
      {
        model,
        instructions: input.instructions,
        input: input.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      },
      { signal: input.signal },
    );

    const incompleteReason =
      response.status === "incomplete" && response.incomplete_details?.reason
        ? String(response.incomplete_details.reason)
        : null;
    const status: ModelCompletionStatus =
      response.status === "incomplete" || incompleteReason ? "incomplete" : "completed";
    const text = response.output_text.trim();

    if (!text && status === "completed") {
      throw new ModelExecutionError("provider", "model_output_empty");
    }

    const rawUsage = response.usage;
    const usage: NormalizedUsage = {
      inputTokens: Number(rawUsage?.input_tokens ?? 0),
      outputTokens: Number(rawUsage?.output_tokens ?? 0),
      totalTokens: Number(rawUsage?.total_tokens ?? 0),
    };

    return {
      text,
      usage,
      status,
      incompleteReason,
      requestId: response._request_id ?? null,
      durationMs: Math.round(performance.now() - started),
    };
  } catch (error) {
    if (input.signal?.aborted) {
      throw new ModelExecutionError("aborted", "model_request_aborted");
    }
    throw classifyOpenAiError(error);
  }
}
