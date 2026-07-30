import { resolveModel, type ModelDefinition, type ModelGateway, type ModelPurpose } from "./registry";
import { runOpenAI } from "./openaiAdapter";
import { ModelExecutionError, runPerplexity } from "./perplexityAdapter";

export type RunModelInput = {
  modelId?: string;
  purpose: ModelPurpose;
  messages: { role: "user" | "assistant"; content: string }[];
  instructions?: string;
  signal?: AbortSignal;
};

function runGateway(
  gateway: ModelGateway,
  input: RunModelInput,
  model: ModelDefinition,
) {
  const adapterInput = { ...input, model, timeoutMs: 60_000 };
  return gateway === "openai"
    ? runOpenAI(adapterInput)
    : runPerplexity(adapterInput);
}

function normalizeStructuredResponseText(
  purpose: ModelPurpose,
  text: string,
): string {
  if (purpose !== "crawl") return text;

  const trimmed = text.trim();
  const fencedJson = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fencedJson?.[1]?.trim() ?? text;
}

function shouldFallback(error: unknown): error is ModelExecutionError {
  if (!(error instanceof ModelExecutionError)) return false;
  if (error.category === "availability" || error.category === "timeout" || error.category === "rate_limit") {
    return true;
  }

  if (error.category !== "provider") return false;

  const code = error.providerCode?.toLowerCase() ?? "";
  const message = error.providerMessage?.toLowerCase() ?? "";
  return (
    error.status === 404 ||
    code.includes("model_not_found") ||
    code.includes("model_unavailable") ||
    code.includes("unsupported_model") ||
    message.includes("model not found") ||
    message.includes("model is not available") ||
    message.includes("model unavailable") ||
    message.includes("no longer supported") ||
    message.includes("deprecated")
  );
}

function logFailure(model: ModelDefinition, error: unknown, fallbackAttempted: boolean) {
  const executionError = error instanceof ModelExecutionError ? error : null;
  console.error("AI_MODEL_EXECUTION_FAILED", {
    modelId: model.id,
    provider: model.provider,
    gateway: model.gateway,
    upstreamModelId: model.gatewayModelId,
    fallbackGateway: model.fallbackGateway,
    fallbackUpstreamModelId: model.fallbackGatewayModelId,
    fallbackAttempted,
    category: executionError?.category ?? "unknown",
    status: executionError?.status ?? null,
    providerCode: executionError?.providerCode ?? null,
    requestId: executionError?.requestId ?? null,
    providerMessage: executionError?.providerMessage ?? (error instanceof Error ? error.message : String(error)),
  });
}

export async function runModel(input: RunModelInput) {
  const model = resolveModel(input.modelId, input.purpose);

  try {
    const result = await runGateway(model.gateway, input, model);
    return {
      ...result,
      text: normalizeStructuredResponseText(input.purpose, result.text),
      modelId: model.id,
      provider: model.provider,
      gateway: model.gateway,
      upstreamModelId: model.gatewayModelId,
      primaryGateway: model.gateway,
      fallbackUsed: false,
      fallbackReason: null,
      primaryFailure: null,
    };
  } catch (error) {
    if (
      !model.fallbackGateway ||
      !model.fallbackGatewayModelId ||
      !shouldFallback(error)
    ) {
      logFailure(model, error, false);
      throw error;
    }

    const fallbackModel: ModelDefinition = {
      ...model,
      gateway: model.fallbackGateway,
      gatewayModelId: model.fallbackGatewayModelId,
      fallbackGateway: null,
      fallbackGatewayModelId: null,
    };

    try {
      const result = await runGateway(model.fallbackGateway, input, fallbackModel);
      return {
        ...result,
        text: normalizeStructuredResponseText(input.purpose, result.text),
        modelId: model.id,
        provider: model.provider,
        gateway: model.fallbackGateway,
        upstreamModelId: model.fallbackGatewayModelId,
        primaryGateway: model.gateway,
        fallbackUsed: true,
        fallbackReason: error.category,
        primaryFailure: {
          category: error.category,
          status: error.status,
          providerCode: error.providerCode,
          requestId: error.requestId,
          providerMessage: error.providerMessage,
        },
      };
    } catch (fallbackError) {
      logFailure(fallbackModel, fallbackError, true);
      throw fallbackError;
    }
  }
}
