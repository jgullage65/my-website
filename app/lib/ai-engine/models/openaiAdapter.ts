import OpenAI from "openai";
import type { AdapterInput, ModelCompletionStatus, NormalizedUsage } from "./perplexityAdapter";
import { ModelExecutionError } from "./perplexityAdapter";

function getOpenAiClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new ModelExecutionError("configuration", "model_gateway_not_configured");
  }

  return new OpenAI({ apiKey });
}

export async function runOpenAI(input: AdapterInput) {
  if (!input.model.gatewayModelId) {
    throw new ModelExecutionError("configuration", "model_gateway_model_missing");
  }

  const client = getOpenAiClient();
  const started = performance.now();

  try {
    const response = await client.responses.create(
      {
        model: input.model.gatewayModelId,
        instructions: input.instructions,
        input: input.messages,
      },
      { signal: input.signal, timeout: input.timeoutMs },
    );

    const providerResponse = response as unknown as {
      id?: string;
      _request_id?: string;
      status?: string;
      incomplete_details?: { reason?: string | null } | null;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        total_tokens?: number;
      } | null;
      output_text?: string;
    };

    const incompleteReason =
      typeof providerResponse.incomplete_details?.reason === "string"
        ? providerResponse.incomplete_details.reason
        : null;
    const status: ModelCompletionStatus =
      providerResponse.status === "incomplete" || incompleteReason
        ? "incomplete"
        : "completed";
    const text = String(providerResponse.output_text ?? "").trim();

    if (!text && status === "completed") {
      throw new ModelExecutionError("provider", "model_output_empty");
    }

    const rawUsage = providerResponse.usage;
    const inputTokens = Number(rawUsage?.input_tokens ?? 0);
    const outputTokens = Number(rawUsage?.output_tokens ?? 0);
    const usage: NormalizedUsage = {
      inputTokens,
      outputTokens,
      totalTokens: Number(rawUsage?.total_tokens ?? inputTokens + outputTokens),
    };

    return {
      text,
      usage,
      status,
      incompleteReason,
      requestId: providerResponse._request_id ?? providerResponse.id ?? null,
      durationMs: Math.round(performance.now() - started),
    };
  } catch (error) {
    if (error instanceof ModelExecutionError) throw error;

    if (input.signal?.aborted) {
      throw new ModelExecutionError("aborted");
    }

    const providerError = error as {
      status?: number;
      code?: string;
      name?: string;
    };
    const status = providerError.status;

    if (status === 401 || status === 403) {
      throw new ModelExecutionError("authentication");
    }
    if (status === 429) {
      throw new ModelExecutionError("rate_limit");
    }
    if (typeof status === "number" && status >= 500) {
      throw new ModelExecutionError("availability");
    }
    if (providerError.code === "ETIMEDOUT" || providerError.name === "APIConnectionTimeoutError") {
      throw new ModelExecutionError("timeout");
    }

    throw new ModelExecutionError("provider");
  }
}
