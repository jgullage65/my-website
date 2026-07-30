import { resolveModel, type ModelPurpose } from "./registry";
import { runOpenAI } from "./openaiAdapter";
import { runPerplexity } from "./perplexityAdapter";

export type RunModelInput = {
  modelId?: string;
  purpose: ModelPurpose;
  messages: { role: "user" | "assistant"; content: string }[];
  instructions?: string;
  signal?: AbortSignal;
};

export async function runModel(input: RunModelInput) {
  const model = resolveModel(input.modelId, input.purpose);
  const adapterInput = { ...input, model, timeoutMs: 60_000 };

  const result =
    model.gateway === "openai"
      ? await runOpenAI(adapterInput)
      : await runPerplexity(adapterInput);

  return {
    ...result,
    modelId: model.id,
    provider: model.provider,
    gateway: model.gateway,
    upstreamModelId: model.gatewayModelId,
  };
}
