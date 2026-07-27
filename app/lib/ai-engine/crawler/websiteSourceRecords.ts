import { createHash } from "node:crypto";

export const WEBSITE_SOURCE_SCHEMA_VERSION = 1 as const;
export const CRAWLER_VERSION = "ai-builder-crawler/13";
export const EXTRACTION_VERSION = "website-source-blocks/1";
export type CrawlAttemptStatus = "completed" | "partial" | "failed";
export type WebsiteSourceType = "html" | "rendered_html" | "pdf";
export type WebsiteDiscoveryMethod = "submitted" | "priority_path" | "html_link" | "sitemap" | "alternate" | "pdf_link" | "unknown";
export type WebsiteSourceBlockType = "heading" | "paragraph" | "list_item" | "table_row" | "table_cell" | "definition" | "faq_question" | "faq_answer" | "json_ld_fact" | "pdf_page_text";
export type SourceCoordinates = { lineStart?:number;lineEnd?:number;pageNumber?:number;row?:number;column?:number };

export type WebsiteCrawlAttemptRecord = {
  schemaVersion: typeof WEBSITE_SOURCE_SCHEMA_VERSION; id:string; requestedUrl:string; normalizedSubmittedUrl:string;
  resolvedEntryUrl:string; startedAt:string; completedAt:string; crawlerVersion:string; extractionVersion:string;
  status:CrawlAttemptStatus; budgets:Record<string,number>; restrictions:{type:string;url:string;status?:number}[];
};
export type WebsiteSourceDocumentRecord = {
  schemaVersion:typeof WEBSITE_SOURCE_SCHEMA_VERSION; id:string;crawlAttemptId:string;actualFetchedUrl:string;canonicalUrl:string|null;
  redirectChain:string[];sourceType:WebsiteSourceType;contentType:string;status:"retained"|"skipped"|"failed";fetchedAt:string;
  sourceContentHash:string;extractedContentHash:string;language:string|null;sourceTruncated:boolean;extractionTruncated:boolean;
  discoveryMethod:WebsiteDiscoveryMethod;discoveredFromUrl:string|null;
};
export type WebsiteSourceBlockRecord = {
  schemaVersion:typeof WEBSITE_SOURCE_SCHEMA_VERSION;id:string;sourceDocumentId:string;crawlAttemptId:string;type:WebsiteSourceBlockType;
  normalizedText:string;coordinates:SourceCoordinates;extractionMethod:"semantic_html"|"json_ld"|"pdf_text";
};

export const sha256=(value:string|Uint8Array)=>createHash("sha256").update(value).digest("hex");
export const stableSourceDocumentId=(attemptId:string,actualUrl:string,sourceHash:string)=>`website_source_${sha256(`${attemptId}\0${actualUrl}\0${sourceHash}`).slice(0,32)}`;
export const stableSourceBlockId=(documentId:string,type:WebsiteSourceBlockType,index:number,text:string)=>`website_block_${sha256(`${documentId}\0${type}\0${index}\0${text.replace(/\s+/g," ").trim()}`).slice(0,32)}`;

const sourceTypes=new Set<WebsiteSourceType>(["html","rendered_html","pdf"]);
const documentStatuses=new Set<WebsiteSourceDocumentRecord["status"]>(["retained","skipped","failed"]);
const discoveryMethods=new Set<WebsiteDiscoveryMethod>(["submitted","priority_path","html_link","sitemap","alternate","pdf_link","unknown"]);
const blockTypes=new Set<WebsiteSourceBlockType>(["heading","paragraph","list_item","table_row","table_cell","definition","faq_question","faq_answer","json_ld_fact","pdf_page_text"]);
const extractionMethods=new Set<WebsiteSourceBlockRecord["extractionMethod"]>(["semantic_html","json_ld","pdf_text"]);
const hashPattern=/^[a-f0-9]{64}$/;
const bounded=(value:unknown,max:number)=>typeof value==="string"?value.replace(/\0/g,"").trim().slice(0,max):"";
const webUrl=(value:unknown)=>{const candidate=bounded(value,2_048);try{const url=new URL(candidate);return url.protocol==="http:"||url.protocol==="https:"?url.toString():null;}catch{return null;}};
const timestamp=(value:unknown)=>{const candidate=bounded(value,100);const milliseconds=Date.parse(candidate);return candidate&&Number.isFinite(milliseconds)?new Date(milliseconds).toISOString():null;};
const boolean=(value:unknown)=>typeof value==="boolean"?value:null;

/** Normalize untrusted source artifacts before they enter persisted Website Knowledge. */
export function normalizeWebsiteSourceDocuments(value:unknown,crawlAttemptId:string,maximum=2_000):WebsiteSourceDocumentRecord[]{
  return (Array.isArray(value)?value:[]).slice(0,maximum).flatMap(entry=>{
    if(!entry||typeof entry!=="object"||Array.isArray(entry))return [];
    const item=entry as Record<string,unknown>,id=bounded(item.id,200),attempt=bounded(item.crawlAttemptId,200);
    const actualFetchedUrl=webUrl(item.actualFetchedUrl),canonicalUrl=item.canonicalUrl===null?null:webUrl(item.canonicalUrl),fetchedAt=timestamp(item.fetchedAt);
    const sourceType=bounded(item.sourceType,32) as WebsiteSourceType,status=bounded(item.status,32) as WebsiteSourceDocumentRecord["status"],discoveryMethod=bounded(item.discoveryMethod,32) as WebsiteDiscoveryMethod;
    const redirectChain=(Array.isArray(item.redirectChain)?item.redirectChain:[]).slice(0,20).map(webUrl);
    const discoveredFromUrl=item.discoveredFromUrl===null?null:webUrl(item.discoveredFromUrl);
    const sourceTruncated=boolean(item.sourceTruncated),extractionTruncated=boolean(item.extractionTruncated);
    if(item.schemaVersion!==1||!id||attempt!==crawlAttemptId||!actualFetchedUrl||(item.canonicalUrl!==null&&!canonicalUrl)||!fetchedAt||!bounded(item.contentType,200)||
      !sourceTypes.has(sourceType)||!documentStatuses.has(status)||!discoveryMethods.has(discoveryMethod)||!Array.isArray(item.redirectChain)||redirectChain.some(url=>!url)||
      (item.discoveredFromUrl!==null&&!discoveredFromUrl)||(item.language!==null&&typeof item.language!=="string")||!hashPattern.test(bounded(item.sourceContentHash,64))||!hashPattern.test(bounded(item.extractedContentHash,64))||
      sourceTruncated===null||extractionTruncated===null)return [];
    return [{schemaVersion:1,id,crawlAttemptId:attempt,actualFetchedUrl,canonicalUrl,redirectChain:redirectChain as string[],sourceType,
      contentType:bounded(item.contentType,200),status,fetchedAt,sourceContentHash:bounded(item.sourceContentHash,64),extractedContentHash:bounded(item.extractedContentHash,64),
      language:item.language===null?null:bounded(item.language,64)||null,sourceTruncated,extractionTruncated,discoveryMethod,discoveredFromUrl}];
  });
}

export function normalizeWebsiteSourceBlocks(value:unknown,crawlAttemptId:string,documents:readonly WebsiteSourceDocumentRecord[],maximum=20_000):WebsiteSourceBlockRecord[]{
  const documentIds=new Set(documents.map(document=>document.id));
  return (Array.isArray(value)?value:[]).slice(0,maximum).flatMap(entry=>{
    if(!entry||typeof entry!=="object"||Array.isArray(entry))return [];
    const item=entry as Record<string,unknown>,id=bounded(item.id,200),sourceDocumentId=bounded(item.sourceDocumentId,200),attempt=bounded(item.crawlAttemptId,200);
    const type=bounded(item.type,32) as WebsiteSourceBlockType,extractionMethod=bounded(item.extractionMethod,32) as WebsiteSourceBlockRecord["extractionMethod"];
    const normalizedText=bounded(item.normalizedText,50_000).replace(/\s+/g," ").trim();
    const rawCoordinates=item.coordinates&&typeof item.coordinates==="object"&&!Array.isArray(item.coordinates)?item.coordinates as Record<string,unknown>:null;
    const coordinates:SourceCoordinates={};
    if(rawCoordinates)for(const key of ["lineStart","lineEnd","pageNumber","row","column"] as const){const number=rawCoordinates[key];if(typeof number==="number"&&Number.isSafeInteger(number)&&number>=1)coordinates[key]=number;}
    const coordinateKeys=rawCoordinates?Object.keys(rawCoordinates):[];
    if(item.schemaVersion!==1||!id||attempt!==crawlAttemptId||!documentIds.has(sourceDocumentId)||!blockTypes.has(type)||!extractionMethods.has(extractionMethod)||!normalizedText||
      !rawCoordinates||coordinateKeys.some(key=>!["lineStart","lineEnd","pageNumber","row","column"].includes(key))||coordinateKeys.length!==Object.keys(coordinates).length||
      (coordinates.lineStart&&coordinates.lineEnd&&coordinates.lineEnd<coordinates.lineStart)||
      (type==="pdf_page_text"?(extractionMethod!=="pdf_text"||!coordinates.pageNumber):extractionMethod==="pdf_text")||
      (type==="json_ld_fact"?extractionMethod!=="json_ld":extractionMethod==="json_ld"))return [];
    return [{schemaVersion:1,id,sourceDocumentId,crawlAttemptId:attempt,type,normalizedText,coordinates,extractionMethod}];
  });
}

export function buildTextBlocks(input:{documentId:string;attemptId:string;text:string;method:"semantic_html"|"json_ld"|"pdf_text";type?:WebsiteSourceBlockType;pageNumber?:number;preserveWhole?:boolean}):WebsiteSourceBlockRecord[]{
  const values=input.preserveWhole?[input.text]:input.text.split(/\n+/);
  const lineCount=input.text.split(/\n+/).filter(line=>line.trim()).length;
  return values.map(x=>x.replace(/\s+/g," ").trim()).filter(Boolean).map((text,index)=>({schemaVersion:1,id:stableSourceBlockId(input.documentId,input.type??"paragraph",index,text),sourceDocumentId:input.documentId,crawlAttemptId:input.attemptId,type:input.type??"paragraph",normalizedText:text,coordinates:input.pageNumber?{pageNumber:input.pageNumber}:{lineStart:index+1,lineEnd:input.preserveWhole?Math.max(1,lineCount):index+1},extractionMethod:input.method}));
}

const comparableUrl=(value:string)=>{try{const url=new URL(value);url.hash="";if(url.pathname!=="/")url.pathname=url.pathname.replace(/\/+$/g,"");return url.toString();}catch{return value;}};
export function locateWebsiteEvidence(url:string,excerpt:string,documents:WebsiteSourceDocumentRecord[],blocks:WebsiteSourceBlockRecord[],crawlAttemptId:string){
  const document=documents.find(item=>[item.actualFetchedUrl,item.canonicalUrl].filter((value):value is string=>Boolean(value)).some(value=>comparableUrl(value)===comparableUrl(url)));
  if(!document)return {};
  const needle=excerpt.replace(/\s+/g," ").trim().toLowerCase();
  const block=needle?blocks.find(item=>{const text=item.normalizedText.replace(/\s+/g," ").trim().toLowerCase();return item.sourceDocumentId===document.id&&text.includes(needle);}):undefined;
  return {sourceDocumentId:document.id,crawlAttemptId,...(block?{sourceBlockId:block.id,sourceCoordinates:block.coordinates}:{})};
}
