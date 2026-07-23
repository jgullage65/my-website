import assert from "node:assert/strict";
import test from "node:test";
import { estimateAiTokenCost, getAiModelPricing } from "./ai-pricing";

test("estimates input and output cost for dated model names", () => {
  assert.deepEqual(estimateAiTokenCost("gpt-5-mini-2025-08-07", { inputTokens: 1_000_000, outputTokens: 500_000 }), {
    inputCostUsd: 0.25,
    outputCostUsd: 1,
    totalCostUsd: 1.25,
  });
});

test("does not guess pricing for an unknown model", () => {
  assert.equal(getAiModelPricing("unknown-model"), undefined);
});
