export type ModelPurpose = "crawl" | "test-assistant";
export type ModelProvider = "openai" | "anthropic" | "google" | "xai" | "meta" | "deepseek";
export type ModelGateway = "perplexity" | "openai";

export type ModelDefinition = Readonly<{
  id: string; provider: ModelProvider; displayName: string; gateway: ModelGateway;
  gatewayModelId: string | null; enabled: boolean; recommended: boolean; highUsage: boolean;
  purposes: readonly ModelPurpose[]; selectablePurposes: readonly ModelPurpose[];
  supportsStreaming: boolean; supportsReasoning: boolean; sortOrder: number;
}>;

type RegistryRow = readonly [string,ModelProvider,string,ModelGateway,string|null,boolean,boolean,boolean,readonly ModelPurpose[],readonly ModelPurpose[]];

// Stable product IDs remain separate from provider model IDs so saved choices survive upstream renames.
const rows: readonly RegistryRow[] = [
  ["gpt-5-mini","openai","GPT-5 Mini","perplexity","openai/gpt-5-mini",false,false,true,["crawl","test-assistant"],["crawl","test-assistant"]],
  ["gpt-5","openai","GPT-5","perplexity","openai/gpt-5",false,false,true,["crawl","test-assistant"],["crawl","test-assistant"]],
  ["gpt-5-5","openai","GPT-5.5","perplexity","openai/gpt-5.5",true,false,true,["crawl","test-assistant"],["crawl","test-assistant"]],
  ["gpt-5-5-pro","openai","GPT-5.5 Pro","openai","gpt-5.5-pro",false,true,true,["crawl","test-assistant"],["crawl","test-assistant"]],
  ["claude-haiku","anthropic","Claude Haiku","perplexity","anthropic/claude-haiku-4-5",false,false,true,["test-assistant"],["crawl","test-assistant"]],
  ["claude-sonnet","anthropic","Claude Sonnet","perplexity","anthropic/claude-sonnet-4-6",true,false,true,["test-assistant"],["crawl","test-assistant"]],
  ["claude-opus","anthropic","Claude Opus","perplexity","anthropic/claude-opus-4-6",false,true,true,["test-assistant"],["crawl","test-assistant"]],
  ["gemini-2-5-flash","google","Gemini 3 Flash","perplexity","google/gemini-3-flash-preview",false,false,true,["crawl","test-assistant"],["crawl","test-assistant"]],
  ["gemini-2-5-pro","google","Gemini 3.1 Pro","perplexity","google/gemini-3.1-pro-preview",true,false,true,["crawl","test-assistant"],["crawl","test-assistant"]],
  ["grok-fast","xai","Grok 4.20 Non-Reasoning","perplexity","xai/grok-4.20-non-reasoning",false,false,true,["crawl","test-assistant"],["crawl","test-assistant"]],
  ["grok","xai","Grok 4.3","perplexity","xai/grok-4.3",true,false,true,["crawl","test-assistant"],["crawl","test-assistant"]],
  ["llama-flagship","meta","Llama flagship","perplexity",null,false,false,false,[],[]],
  ["deepseek-flagship","deepseek","DeepSeek flagship","perplexity",null,false,false,false,[],[]],
];

export const MODEL_REGISTRY = rows.map(([id,provider,displayName,gateway,gatewayModelId,recommended,highUsage,enabled,purposes,selectablePurposes],sortOrder) => ({
  id,provider,displayName,gateway,gatewayModelId,recommended,highUsage,enabled,purposes,selectablePurposes,
  supportsStreaming:false,supportsReasoning:true,sortOrder,
})) as readonly ModelDefinition[];

export const DEFAULT_MODEL_IDS: Readonly<Record<ModelPurpose,string>> = { crawl:"gpt-5-5", "test-assistant":"claude-sonnet" };

const COMPATIBILITY_MODEL_IDS: Readonly<Record<string,string>> = {
  "gpt-5.5":"gpt-5-5",
  "gpt-5.5-pro":"gpt-5-5-pro",
  "gemini-flash":"gemini-2-5-flash",
  "gemini-pro":"gemini-2-5-pro",
};

export function normalizeModelId(modelId: unknown): string {
  if (typeof modelId !== "string") return "";
  return COMPATIBILITY_MODEL_IDS[modelId] ?? modelId;
}

export class ModelSelectionError extends Error {
  readonly code:"model_unknown"|"model_disabled"|"model_unavailable"|"model_purpose_incompatible";
  constructor(code:ModelSelectionError["code"]) { super(code); this.code=code; }
}

export function resolveModel(modelId: unknown, purpose: ModelPurpose): ModelDefinition {
  const normalized = modelId == null || modelId === "" ? DEFAULT_MODEL_IDS[purpose] : normalizeModelId(modelId);
  const model = MODEL_REGISTRY.find(item => item.id === normalized);
  if (!model) throw new ModelSelectionError("model_unknown");
  if (!model.enabled) throw new ModelSelectionError("model_disabled");
  if (!model.gatewayModelId) throw new ModelSelectionError("model_unavailable");
  if (!model.purposes.includes(purpose)) throw new ModelSelectionError("model_purpose_incompatible");
  return model;
}

export type PublicModel = Pick<ModelDefinition,"id"|"provider"|"displayName"|"recommended"|"highUsage"|"purposes"|"sortOrder">;
export function listAvailableModels(purpose: ModelPurpose): PublicModel[] {
  return MODEL_REGISTRY.filter(m=>m.enabled&&Boolean(m.gatewayModelId)&&m.selectablePurposes.includes(purpose)).map(({id,provider,displayName,recommended,highUsage,purposes,sortOrder})=>({id,provider,displayName,recommended,highUsage,purposes,sortOrder}));
}
