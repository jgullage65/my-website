import { NextResponse } from "next/server";
import { requireClerkUserId } from "@/app/lib/auth/clerk";
import { crawlBusinessWebsite, resolveCrawledBusinessName } from "@/app/lib/ai-engine/crawler/crawlBusinessWebsite";
import { persistWebsiteSourceRecords } from "@/app/lib/ai-engine/crawler/websiteSourceRecordStore";
import { buildDeterministicBrain, normalizeWebsiteSources } from "@/app/lib/ai-engine/deterministic";
import * as repository from "@/app/lib/db/ai-builder-repository";
import { persistMergedWebsiteKnowledge } from "@/app/lib/db/ai-builder-repository";
import type { PersistedWebsiteKnowledge, WebsiteKnowledgeFact } from "@/app/lib/ai-engine/knowledge/websiteKnowledge";

export const runtime="nodejs"; export const dynamic="force-dynamic"; export const maxDuration=800;
const text=(v:unknown)=>String(v??"").replace(/\u0000/g,"").trim();
const summary=(facts:WebsiteKnowledgeFact[],categories:string[])=>facts.filter((f)=>categories.includes(f.category)).map((f)=>f.value).slice(0,12).join("\n\n");
const error=(status:number,code:string,message:string)=>NextResponse.json({ok:false,error:{code,message}},{status});

export async function POST(request:Request){
  try{await requireClerkUserId();}catch{return error(401,"authentication_required","Sign in to use AI Builder.");}
  let body:{website?:unknown;projectId?:unknown};try{body=await request.json();}catch{return error(400,"invalid_json","The request body must be valid JSON.");}
  const website=text(body.website),projectId=text(body.projectId); if(!website)return error(400,"website_required","Add a website before importing business information.");
  const project=projectId?await repository.getAiBuilderProject(projectId):null;if(projectId&&!project)return error(404,"project_not_found","This AI Builder project could not be found.");
  const encoder=new TextEncoder(); const attemptId=crypto.randomUUID();
  const stream=new ReadableStream({async start(controller){const send=(event:unknown)=>controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));try{
    send({type:"progress",percent:5});
    const crawl=await crawlBusinessWebsite(website,(pagesCrawled,pagesDiscovered)=>send({type:"crawl_progress",pagesCrawled,pagesDiscovered}),{crawlAttemptId:attemptId,crawlStartedAt:new Date().toISOString()});
    await persistWebsiteSourceRecords(crawl.crawlAttempt,crawl.sourceDocuments,crawl.sourceBlocks);
    send({type:"crawl_complete",pagesCrawled:crawl.pages.length,pagesDiscovered:crawl.diagnostics.pagesDiscovered});send({type:"progress",percent:75});
    const sources=normalizeWebsiteSources(crawl.sourceDocuments,crawl.sourceBlocks,crawl.pages);const brain=buildDeterministicBrain(sources);
    const current:PersistedWebsiteKnowledge={schema_version:2,document_version:(project?.websiteKnowledge?.document_version??0)+1,current_crawl_attempt_id:attemptId,imported_at:new Date().toISOString(),requested_url:crawl.requestedUrl,resolved_url:crawl.resolvedUrl,pages:crawl.pages.map((p)=>({url:p.url,title:p.title,pageType:p.pageType,sourceDocumentId:p.sourceDocumentId})),warnings:crawl.warnings,knowledge:{facts:brain.facts,coverage:brain.coverage,unresolvedQuestions:brain.unresolvedQuestions},source_documents:crawl.sourceDocuments,source_blocks:crawl.sourceBlocks};
    if(projectId)await persistMergedWebsiteKnowledge(projectId,current);
    const facts=brain.facts;send({type:"progress",percent:100});send({type:"result",ok:true,import:{businessName:resolveCrawledBusinessName("",crawl),industry:summary(facts,["industry_served"]),website:crawl.resolvedUrl,requestedUrl:crawl.requestedUrl,resolvedUrl:crawl.resolvedUrl,productsServices:summary(facts,["product","service","feature_capability"]),idealCustomers:summary(facts,["customer_segment","industry_served"]),additionalKnowledge:summary(facts,["policy","support_onboarding","competitive_differentiator","contact_information"])},knowledge:current.knowledge,pages:current.pages,warnings:current.warnings,sourceDocuments:crawl.sourceDocuments,sourceBlocks:crawl.sourceBlocks,crawlAttemptId:attemptId,conflicts:brain.conflicts});
  }catch(cause){console.error("AI_BUILDER_WEBSITE_CRAWL_FAILED",{message:cause instanceof Error?cause.message:String(cause)});send({type:"error",error:{code:"website_import_failed",message:"The public website could not be imported safely."},crawlAttemptId:attemptId});}finally{controller.close();}}});
  return new Response(stream,{headers:{"Content-Type":"application/x-ndjson; charset=utf-8","Cache-Control":"no-cache, no-transform"}});
}
