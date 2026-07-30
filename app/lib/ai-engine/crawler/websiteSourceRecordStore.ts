import "server-only";
import { ensureAiBuilderSchema } from "@/app/lib/db/ai-builder-schema";
import { getSql } from "@/app/lib/db/client";
import type { WebsiteCrawlAttemptRecord, WebsiteSourceBlockRecord, WebsiteSourceDocumentRecord } from "./websiteSourceRecords";

const canonicalJson=(value:unknown):string=>JSON.stringify(value&&typeof value==="object"&&!Array.isArray(value)
  ?Object.fromEntries(Object.entries(value as Record<string,unknown>).sort(([left],[right])=>left.localeCompare(right)).map(([key,item])=>[key,JSON.parse(canonicalJson(item))]))
  :Array.isArray(value)?value.map(item=>JSON.parse(canonicalJson(item))):value);
const sameJson=(left:unknown,right:unknown)=>canonicalJson(left)===canonicalJson(right);
const iso=(value:unknown)=>new Date(String(value)).toISOString();
const collision=(kind:string,id:string):never=>{throw new Error(`website_source_immutable_collision:${kind}:${id}`);};

export async function persistWebsiteSourceRecords(attempt:WebsiteCrawlAttemptRecord,documents:WebsiteSourceDocumentRecord[],blocks:WebsiteSourceBlockRecord[]):Promise<void>{
  const inputDocuments=new Map<string,string>();
  for(const document of documents){if(document.crawlAttemptId!==attempt.id||inputDocuments.has(document.id)&&inputDocuments.get(document.id)!==canonicalJson(document))collision("source_document",document.id);inputDocuments.set(document.id,canonicalJson(document));}
  const inputBlocks=new Map<string,string>();
  for(const block of blocks){if(block.crawlAttemptId!==attempt.id||!inputDocuments.has(block.sourceDocumentId)||inputBlocks.has(block.id)&&inputBlocks.get(block.id)!==canonicalJson(block))collision("source_block",block.id);inputBlocks.set(block.id,canonicalJson(block));}
  await ensureAiBuilderSchema();
  const sql=getSql();
  await sql`INSERT INTO ai_builder_website_crawl_attempts (id,schema_version,requested_url,normalized_submitted_url,resolved_entry_url,started_at,completed_at,crawler_version,extraction_version,status,budgets,restrictions)
    VALUES (${attempt.id},${attempt.schemaVersion},${attempt.requestedUrl},${attempt.normalizedSubmittedUrl},${attempt.resolvedEntryUrl},${attempt.startedAt}::timestamptz,${attempt.completedAt}::timestamptz,${attempt.crawlerVersion},${attempt.extractionVersion},${attempt.status},${JSON.stringify(attempt.budgets)}::jsonb,${JSON.stringify(attempt.restrictions)}::jsonb) ON CONFLICT (id) DO NOTHING`;
  const attemptMatches=await sql`SELECT EXISTS(
    SELECT 1 FROM ai_builder_website_crawl_attempts
    WHERE id=${attempt.id}
      AND schema_version=${attempt.schemaVersion}
      AND requested_url=${attempt.requestedUrl}
      AND normalized_submitted_url=${attempt.normalizedSubmittedUrl}
      AND resolved_entry_url=${attempt.resolvedEntryUrl}
      AND started_at=${attempt.startedAt}::timestamptz
      AND completed_at=${attempt.completedAt}::timestamptz
      AND crawler_version=${attempt.crawlerVersion}
      AND extraction_version=${attempt.extractionVersion}
      AND status=${attempt.status}
      AND budgets=${JSON.stringify(attempt.budgets)}::jsonb
      AND restrictions=${JSON.stringify(attempt.restrictions)}::jsonb
  ) AS matches` as unknown as Array<{matches:boolean}>;
  if(!attemptMatches[0]?.matches)collision("crawl_attempt",attempt.id);

  const existingDocuments=documents.length?await sql`SELECT * FROM ai_builder_website_source_documents WHERE crawl_attempt_id=${attempt.id}` as unknown as Record<string,unknown>[]:[];
  const verifyDocument=(document:WebsiteSourceDocumentRecord,row:Record<string,unknown>|undefined)=>Boolean(row&&row.schema_version===document.schemaVersion&&row.crawl_attempt_id===document.crawlAttemptId&&row.actual_fetched_url===document.actualFetchedUrl&&row.canonical_url===document.canonicalUrl&&
    sameJson(row.redirect_chain,document.redirectChain)&&row.source_type===document.sourceType&&row.content_type===document.contentType&&row.status===document.status&&iso(row.fetched_at)===iso(document.fetchedAt)&&row.source_content_hash===document.sourceContentHash&&
    row.extracted_content_hash===document.extractedContentHash&&row.language===document.language&&row.source_truncated===document.sourceTruncated&&row.extraction_truncated===document.extractionTruncated&&row.discovery_method===document.discoveryMethod&&row.discovered_from_url===document.discoveredFromUrl);
  const existingDocumentsById=new Map(existingDocuments.map(row=>[String(row.id),row]));
  for(const document of documents){const existing=existingDocumentsById.get(document.id);if(existing&&!verifyDocument(document,existing))collision("source_document",document.id);}
  if(documents.length)await sql`INSERT INTO ai_builder_website_source_documents (id,schema_version,crawl_attempt_id,actual_fetched_url,canonical_url,redirect_chain,source_type,content_type,status,fetched_at,source_content_hash,extracted_content_hash,language,source_truncated,extraction_truncated,discovery_method,discovered_from_url)
    SELECT id,schema_version,crawl_attempt_id,actual_fetched_url,canonical_url,redirect_chain,source_type,content_type,status,fetched_at::timestamptz,source_content_hash,extracted_content_hash,language,source_truncated,extraction_truncated,discovery_method,discovered_from_url FROM jsonb_to_recordset(${JSON.stringify(documents.map(d=>({id:d.id,schema_version:d.schemaVersion,crawl_attempt_id:d.crawlAttemptId,actual_fetched_url:d.actualFetchedUrl,canonical_url:d.canonicalUrl,redirect_chain:d.redirectChain,source_type:d.sourceType,content_type:d.contentType,status:d.status,fetched_at:d.fetchedAt,source_content_hash:d.sourceContentHash,extracted_content_hash:d.extractedContentHash,language:d.language,source_truncated:d.sourceTruncated,extraction_truncated:d.extractionTruncated,discovery_method:d.discoveryMethod,discovered_from_url:d.discoveredFromUrl})))}::jsonb) AS x(id text,schema_version integer,crawl_attempt_id text,actual_fetched_url text,canonical_url text,redirect_chain jsonb,source_type text,content_type text,status text,fetched_at text,source_content_hash text,extracted_content_hash text,language text,source_truncated boolean,extraction_truncated boolean,discovery_method text,discovered_from_url text) ON CONFLICT (id) DO NOTHING`;
  const storedDocuments=documents.length?await sql`SELECT * FROM ai_builder_website_source_documents WHERE crawl_attempt_id=${attempt.id}` as unknown as Record<string,unknown>[]:[];
  const documentsById=new Map(storedDocuments.map(row=>[String(row.id),row]));
  for(const document of documents)if(!verifyDocument(document,documentsById.get(document.id)))collision("source_document",document.id);

  const verifyBlock=(block:WebsiteSourceBlockRecord,row:Record<string,unknown>|undefined)=>Boolean(row&&row.schema_version===block.schemaVersion&&row.source_document_id===block.sourceDocumentId&&row.crawl_attempt_id===block.crawlAttemptId&&row.block_type===block.type&&row.normalized_text===block.normalizedText&&sameJson(row.coordinates,block.coordinates)&&row.extraction_method===block.extractionMethod);
  const existingBlocks=blocks.length?await sql`SELECT * FROM ai_builder_website_source_blocks WHERE crawl_attempt_id=${attempt.id}` as unknown as Record<string,unknown>[]:[];
  const existingBlocksById=new Map(existingBlocks.map(row=>[String(row.id),row]));
  for(const block of blocks){const existing=existingBlocksById.get(block.id);if(existing&&!verifyBlock(block,existing))collision("source_block",block.id);}
  if(blocks.length)await sql`INSERT INTO ai_builder_website_source_blocks (id,schema_version,source_document_id,crawl_attempt_id,block_type,normalized_text,coordinates,extraction_method)
    SELECT id,schema_version,source_document_id,crawl_attempt_id,block_type,normalized_text,coordinates,extraction_method FROM jsonb_to_recordset(${JSON.stringify(blocks.map(b=>({id:b.id,schema_version:b.schemaVersion,source_document_id:b.sourceDocumentId,crawl_attempt_id:b.crawlAttemptId,block_type:b.type,normalized_text:b.normalizedText,coordinates:b.coordinates,extraction_method:b.extractionMethod})))}::jsonb) AS x(id text,schema_version integer,source_document_id text,crawl_attempt_id text,block_type text,normalized_text text,coordinates jsonb,extraction_method text) ON CONFLICT (id) DO NOTHING`;
  const storedBlocks=blocks.length?await sql`SELECT * FROM ai_builder_website_source_blocks WHERE crawl_attempt_id=${attempt.id}` as unknown as Record<string,unknown>[]:[];
  const blocksById=new Map(storedBlocks.map(row=>[String(row.id),row]));
  for(const block of blocks)if(!verifyBlock(block,blocksById.get(block.id)))collision("source_block",block.id);
}
