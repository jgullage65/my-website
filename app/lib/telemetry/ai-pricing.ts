export type AiTokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type AiCostEstimate = {
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
};

type ModelPricing = { inputUsdPerMillionTokens: number; outputUsdPerMillionTokens: number };

// Standard API list prices. Environment overrides make pricing updates deploy-time configuration.
export const AI_MODEL_PRICING_USD_PER_MILLION: Readonly<Record<string, ModelPricing>> = {
  "gpt-5-mini": { inputUsdPerMillionTokens: 0.25, outputUsdPerMillionTokens: 2 },
};

function configuredRate(name: string): number | undefined {
  const value = process.env[name]?.trim();
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function getAiModelPricing(model: string): ModelPricing | undefined {
  const inputOverride = configuredRate("AI_BUILDER_CRAWLER_INPUT_USD_PER_MILLION_TOKENS");
  const outputOverride = configuredRate("AI_BUILDER_CRAWLER_OUTPUT_USD_PER_MILLION_TOKENS");
  if (inputOverride !== undefined && outputOverride !== undefined) {
    return { inputUsdPerMillionTokens: inputOverride, outputUsdPerMillionTokens: outputOverride };
  }

  const normalized = model.trim().toLowerCase();
  const matchedModel = Object.keys(AI_MODEL_PRICING_USD_PER_MILLION)
    .find((name) => normalized === name || normalized.startsWith(`${name}-`));
  return matchedModel ? AI_MODEL_PRICING_USD_PER_MILLION[matchedModel] : undefined;
}

export function estimateAiTokenCost(model: string, usage: AiTokenUsage): AiCostEstimate | undefined {
  const pricing = getAiModelPricing(model);
  if (!pricing) return undefined;
  const inputTokens = Math.max(0, usage.inputTokens ?? 0);
  const outputTokens = Math.max(0, usage.outputTokens ?? 0);
  const inputCostUsd = inputTokens * pricing.inputUsdPerMillionTokens / 1_000_000;
  const outputCostUsd = outputTokens * pricing.outputUsdPerMillionTokens / 1_000_000;
  return { inputCostUsd, outputCostUsd, totalCostUsd: inputCostUsd + outputCostUsd };
}
