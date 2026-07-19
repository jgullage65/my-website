import "server-only";

import { ensureAiBuilderSchema } from "@/app/lib/db/ai-builder-schema";
import { getSql } from "@/app/lib/db/client";
import { requireClerkUserId } from "@/app/lib/auth/clerk";

type JsonItem = Record<string, unknown>;
const safeMessage=(error:unknown)=>error instanceof Error?error.message.slice(0,500):"Unknown error";
const redact=(value:unknown)=>String(value??"").replace(/sk-[a-z0-9_-]+/gi,"[redacted]").replace(/bearer\s+[^\s]+/gi,"Bearer [redacted]").replace(/postgres(?:ql)?:\/\/[^\s]+/gi,"[redacted database URL]").slice(0,500);
const safeItems=(items:JsonItem[]|undefined)=>(items??[]).map(item=>({stage:item.stage?redact(item.stage):undefined,code:item.code?redact(item.code):undefined,message:redact(item.message)}));
type ProviderMetadata={model?:string;responseId?:string;requestId?:string;providerStatus?:string;usage?:{inputTokens?:number;outputTokens?:number;totalTokens?:number}};
const safeProviderMetadata=(metadata:ProviderMetadata|undefined)=>metadata?{...(metadata.model?{model:redact(metadata.model)}:{}),...(metadata.responseId?{responseId:redact(metadata.responseId)}:{}),...(metadata.requestId?{requestId:redact(metadata.requestId)}:{}),...(metadata.providerStatus?{status:redact(metadata.providerStatus)}:{}),...(metadata.usage?{usage:{inputTokens:metadata.usage.inputTokens,outputTokens:metadata.usage.outputTokens,totalTokens:metadata.usage.totalTokens}}:{})}:{};
type CrawlRestriction={type:string;url:string;status?:number};
const safePublicUrl=(value:string)=>{try{const url=new URL(value);url.username="";url.password="";url.search="";url.hash="";return url.toString().slice(0,500);}catch{return redact(value);}};
const safeRestrictions=(items:CrawlRestriction[]|undefined)=>(items??[]).map(item=>({type:redact(item.type),url:safePublicUrl(item.url),...(typeof item.status==="number"?{status:item.status}:{})}));

async function safely(label:string, work:()=>Promise<void>) { try { await ensureAiBuilderSchema(); await work(); } catch(error) { console.error(label,{message:safeMessage(error)}); } }

export async function startCrawlTelemetry(id:string,requestedUrl:string,startedAt:string){
  await safely("AI_BUILDER_CRAWL_TELEMETRY_START_FAILED",async()=>{const sql=getSql();await sql`
    INSERT INTO ai_builder_crawl_telemetry (id,requested_url,status,attempt_number,started_at)
    VALUES (${id},${requestedUrl},'running',(SELECT COUNT(*)::integer+1 FROM ai_builder_crawl_telemetry WHERE requested_url=${requestedUrl}),${startedAt}::timestamptz)
    ON CONFLICT (id) DO NOTHING`;});
}

export async function finishCrawlTelemetry(id:string,data:{status:string;resolvedUrl?:string;startedAt:string;completedAt:string;pagesDiscovered?:number;pagesProcessed?:number;pagesSkipped?:number;pagesFailed?:number;finalUrls?:string[];warnings?:JsonItem[];errors?:JsonItem[];restrictions?:CrawlRestriction[];failureStage?:string}){
  await safely("AI_BUILDER_CRAWL_TELEMETRY_FINISH_FAILED",async()=>{const sql=getSql();await sql`
    UPDATE ai_builder_crawl_telemetry SET status=${data.status},resolved_url=${data.resolvedUrl??null},started_at=${data.startedAt}::timestamptz,completed_at=${data.completedAt}::timestamptz,
      duration_ms=${Math.max(0,new Date(data.completedAt).getTime()-new Date(data.startedAt).getTime())},pages_discovered=${data.pagesDiscovered??null},
      pages_processed=${data.pagesProcessed??null},pages_skipped=${data.pagesSkipped??null},pages_failed=${data.pagesFailed??null},
      final_urls=${JSON.stringify(data.finalUrls??[])}::jsonb,warnings=${JSON.stringify(safeItems(data.warnings))}::jsonb,
      errors=${JSON.stringify(safeItems(data.errors))}::jsonb,restrictions=${data.restrictions?.length?JSON.stringify(safeRestrictions(data.restrictions)):null}::jsonb,failure_stage=${data.failureStage??null} WHERE id=${id}`;});
}

export async function linkCrawlTelemetry(id:string,projectId:string){const clerkUserId=await requireClerkUserId();await safely("AI_BUILDER_CRAWL_TELEMETRY_LINK_FAILED",async()=>{const sql=getSql();await sql`UPDATE ai_builder_crawl_telemetry SET project_id=${projectId} WHERE id=${id} AND project_id IS NULL AND EXISTS (SELECT 1 FROM ai_builder_projects WHERE id=${projectId} AND clerk_user_id=${clerkUserId})`;});}

export async function startGenerationTelemetry(id:string,projectId:string,startedAt:string){await safely("AI_BUILDER_GENERATION_TELEMETRY_START_FAILED",async()=>{const sql=getSql();await sql`
  INSERT INTO ai_builder_generation_telemetry (id,project_id,status,attempt_number,started_at)
  VALUES (${id},${projectId},'running',(SELECT COUNT(*)::integer+1 FROM ai_builder_generation_telemetry WHERE project_id=${projectId}),${startedAt}::timestamptz) ON CONFLICT(id) DO NOTHING`;});}

export async function finishGenerationTelemetry(id:string,data:{status:string;startedAt:string;completedAt:string;model?:string;knowledgeCount?:number;faqCount?:number;usage?:{inputTokens?:number;outputTokens?:number;totalTokens?:number};providerMetadata?:ProviderMetadata;errors?:JsonItem[];warnings?:JsonItem[];failureStage?:string}){await safely("AI_BUILDER_GENERATION_TELEMETRY_FINISH_FAILED",async()=>{const sql=getSql();await sql`
  UPDATE ai_builder_generation_telemetry SET status=${data.status},started_at=${data.startedAt}::timestamptz,completed_at=${data.completedAt}::timestamptz,duration_ms=${Math.max(0,new Date(data.completedAt).getTime()-new Date(data.startedAt).getTime())},
    model=${data.model??null},knowledge_count=${data.knowledgeCount??null},faq_count=${data.faqCount??null},input_tokens=${data.usage?.inputTokens??null},
    output_tokens=${data.usage?.outputTokens??null},total_tokens=${data.usage?.totalTokens??null},warnings=${JSON.stringify(safeItems(data.warnings))}::jsonb,
    errors=${JSON.stringify(safeItems(data.errors))}::jsonb,provider_metadata=${JSON.stringify(safeProviderMetadata(data.providerMetadata))}::jsonb,failure_stage=${data.failureStage??null} WHERE id=${id}`;});}
