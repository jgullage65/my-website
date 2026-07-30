import { resolveModel, type ModelPurpose } from "./registry";
import { runPerplexity } from "./perplexityAdapter";

export type RunModelInput={modelId?:string;purpose:ModelPurpose;messages:{role:"user"|"assistant";content:string}[];instructions?:string;signal?:AbortSignal};
export async function runModel(input:RunModelInput) {
  const model=resolveModel(input.modelId,input.purpose);
  const result=await runPerplexity({...input,model,timeoutMs:60_000});
  return {...result,modelId:model.id,provider:model.provider,gateway:model.gateway,upstreamModelId:model.gatewayModelId};
}
