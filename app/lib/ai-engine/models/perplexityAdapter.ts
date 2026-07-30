import type { ModelDefinition } from "./registry";

export type NormalizedUsage={inputTokens:number;outputTokens:number;totalTokens:number};
export type ModelCompletionStatus="completed"|"incomplete";
export class ModelExecutionError extends Error {
  readonly category:"configuration"|"timeout"|"aborted"|"authentication"|"rate_limit"|"availability"|"provider";
  readonly status?:number;
  readonly providerCode?:string;
  readonly requestId?:string;
  readonly providerMessage?:string;
  constructor(
    category:ModelExecutionError["category"],
    message="model_execution_failed",
    details?:{status?:number;providerCode?:string;requestId?:string;providerMessage?:string},
  ) {
    super(message);
    this.category=category;
    this.status=details?.status;
    this.providerCode=details?.providerCode;
    this.requestId=details?.requestId;
    this.providerMessage=details?.providerMessage??message;
  }
}
export type AdapterInput={model:ModelDefinition;messages:{role:"user"|"assistant";content:string}[];instructions?:string;signal?:AbortSignal;timeoutMs:number};

export async function runPerplexity(input:AdapterInput) {
  const key=process.env.PERPLEXITY_API_KEY?.trim();
  if(!key) throw new ModelExecutionError("configuration","model_gateway_not_configured");
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort("timeout"),input.timeoutMs);
  const abort=()=>controller.abort("aborted"); input.signal?.addEventListener("abort",abort,{once:true});
  const started=performance.now();
  try {
    const response=await fetch("https://api.perplexity.ai/v1/responses",{method:"POST",headers:{authorization:`Bearer ${key}`,"content-type":"application/json"},body:JSON.stringify({model:input.model.gatewayModelId,instructions:input.instructions,input:input.messages}),signal:controller.signal});
    if(!response.ok) throw new ModelExecutionError(response.status===401||response.status===403?"authentication":response.status===429?"rate_limit":response.status>=500?"availability":"provider","model_request_failed",{status:response.status,requestId:response.headers.get("x-request-id")??undefined});
    const value=await response.json() as any;
    const incompleteReason=typeof value.incomplete_details?.reason==="string"?value.incomplete_details.reason:null;
    const status:ModelCompletionStatus=value.status==="incomplete"||incompleteReason?"incomplete":"completed";
    const text=String(value.output_text??value.output?.flatMap((x:any)=>x.content??[]).map((x:any)=>x.text??"").join("")??"").trim();
    if(!text&&status==="completed") throw new ModelExecutionError("provider","model_output_empty");
    const raw=value.usage??{},usage={inputTokens:Number(raw.input_tokens??0),outputTokens:Number(raw.output_tokens??0),totalTokens:Number(raw.total_tokens??Number(raw.input_tokens??0)+Number(raw.output_tokens??0))};
    return {text,usage,status,incompleteReason,requestId:response.headers.get("x-request-id")??(String(value.id??"")||null),durationMs:Math.round(performance.now()-started)};
  } catch(error) {
    if(error instanceof ModelExecutionError) throw error;
    if(controller.signal.aborted) throw new ModelExecutionError(input.signal?.aborted?"aborted":"timeout");
    throw new ModelExecutionError("provider");
  } finally { clearTimeout(timeout); input.signal?.removeEventListener("abort",abort); }
}