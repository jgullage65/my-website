export type ModelPurpose = "crawl" | "test-assistant";
export type ModelProvider = "openai" | "anthropic" | "google" | "xai" | "meta" | "deepseek";

export type ModelDefinition = Readonly<{
  id: string; provider: ModelProvider; displayName: string; gateway: "perplexity";
  gatewayModelId: string | null; enabled: boolean; recommended: boolean; highUsage: boolean;
  purposes: readonly ModelPurpose[]; supportsStreaming: boolean; supportsReasoning: boolean;
  sortOrder: number;
}>;

// This is the only product catalogue. Upstream identifiers are deliberately
// separate from stable IDs so gateway renames do not leak into stored data.
export const MODEL_REGISTRY = [
  ["gpt-5-mini","openai","GPT-5 mini","openai/gpt-5-mini",false,false,true],
  ["gpt-5","openai","GPT-5","openai/gpt-5",false,false,true],
  ["gpt-5-5","openai","GPT-5.5","openai/gpt-5.5",true,false,true],
  ["gpt-5-5-pro","openai","GPT-5.5 Pro","openai/gpt-5.5-pro",false,true,true],
  ["claude-haiku","anthropic","Claude Haiku","anthropic/claude-haiku-4-5",false,false,true],
  ["claude-sonnet","anthropic","Claude Sonnet","anthropic/claude-sonnet-4-6",true,false,true],
  ["claude-opus","anthropic","Claude Opus","anthropic/claude-opus-4-6",false,false,true],
  ["gemini-2-5-flash","google","Gemini 2.5 Flash","google/gemini-2.5-flash",false,false,true],
  ["gemini-2-5-pro","google","Gemini 2.5 Pro","google/gemini-2.5-pro",true,false,true],
  ["grok-fast","xai","Grok Fast","xai/grok-4-1-fast-non-reasoning",false,false,true],
  ["grok","xai","Grok","xai/grok-4",true,false,true],
  ["llama-flagship","meta","Llama flagship",null,false,false,false],
  ["deepseek-flagship","deepseek","DeepSeek flagship",null,false,false,false],
] .map(([id,provider,displayName,gatewayModelId,recommended,highUsage,enabled],sortOrder) => ({
  id,provider,displayName,gateway:"perplexity",gatewayModelId,recommended,highUsage,enabled,
  purposes:["crawl","test-assistant"],supportsStreaming:false,supportsReasoning:true,
  sortOrder,
})) as readonly ModelDefinition[];

export const DEFAULT_MODEL_IDS: Readonly<Record<ModelPurpose,string>> = { crawl:"gpt-5-5", "test-assistant":"claude-sonnet" };

export class ModelSelectionError extends Error {
  readonly code:"model_unknown"|"model_disabled"|"model_unavailable"|"model_purpose_incompatible";
  constructor(code:ModelSelectionError["code"]) { super(code); this.code=code; }
}

export function resolveModel(modelId: unknown, purpose: ModelPurpose): ModelDefinition {
  const id = modelId == null || modelId === "" ? DEFAULT_MODEL_IDS[purpose] : typeof modelId === "string" ? modelId : "";
  const model = MODEL_REGISTRY.find(item => item.id === id);
  if (!model) throw new ModelSelectionError("model_unknown");
  if (!model.enabled) throw new ModelSelectionError("model_disabled");
  if (!model.gatewayModelId) throw new ModelSelectionError("model_unavailable");
  if (!model.purposes.includes(purpose)) throw new ModelSelectionError("model_purpose_incompatible");
  return model;
}

export type PublicModel = Pick<ModelDefinition,"id"|"provider"|"displayName"|"recommended"|"highUsage"|"purposes"|"sortOrder">;
export function listAvailableModels(purpose: ModelPurpose): PublicModel[] {
  return MODEL_REGISTRY.filter(m=>m.enabled&&Boolean(m.gatewayModelId)&&m.purposes.includes(purpose)).map(({id,provider,displayName,recommended,highUsage,purposes,sortOrder})=>({id,provider,displayName,recommended,highUsage,purposes,sortOrder}));
}
