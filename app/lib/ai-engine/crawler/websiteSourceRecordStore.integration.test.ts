import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "@neondatabase/serverless";
const databaseUrl=process.env.DATABASE_URL,db=databaseUrl?test:test.skip;

db("persists immutable source versions by crawl attempt",async()=>{
  const {persistWebsiteSourceRecords}=await import("./websiteSourceRecordStore"); const pool=new Pool({connectionString:databaseUrl});
  const id=`crawl_source_${randomUUID()}`,documentId=`website_source_${randomUUID()}`,blockId=`website_block_${randomUUID()}`,time=new Date().toISOString();
  const attempt={schemaVersion:1 as const,id,requestedUrl:"https://example.test/submitted",normalizedSubmittedUrl:"https://example.test/submitted",resolvedEntryUrl:"https://example.test/final",startedAt:time,completedAt:time,crawlerVersion:"test",extractionVersion:"test",status:"completed" as const,budgets:{pages:1},restrictions:[]};
  const document={schemaVersion:1 as const,id:documentId,crawlAttemptId:id,actualFetchedUrl:"https://example.test/final",canonicalUrl:"https://example.test/canonical",redirectChain:["https://example.test/submitted"],sourceType:"html" as const,contentType:"text/html",status:"retained" as const,fetchedAt:time,sourceContentHash:"a".repeat(64),extractedContentHash:"b".repeat(64),language:"en",sourceTruncated:false,extractionTruncated:false,discoveryMethod:"submitted" as const,discoveredFromUrl:null};
  const block={schemaVersion:1 as const,id:blockId,sourceDocumentId:documentId,crawlAttemptId:id,type:"paragraph" as const,normalizedText:"Original immutable evidence",coordinates:{lineStart:1,lineEnd:1},extractionMethod:"semantic_html" as const};
  try{await persistWebsiteSourceRecords(attempt,[document],[block]);
    await assert.rejects(persistWebsiteSourceRecords({...attempt,status:"failed"},[document],[block]),/website_source_immutable_collision:crawl_attempt/);
    await assert.rejects(persistWebsiteSourceRecords(attempt,[{...document,canonicalUrl:"https://changed.test"}],[block]),/website_source_immutable_collision:source_document/);
    await assert.rejects(persistWebsiteSourceRecords(attempt,[document],[{...block,normalizedText:"Changed"}]),/website_source_immutable_collision:source_block/);
    const storedAttempt=(await pool.query("SELECT status FROM ai_builder_website_crawl_attempts WHERE id=$1",[id])).rows[0];
    const storedDocument=(await pool.query("SELECT canonical_url FROM ai_builder_website_source_documents WHERE id=$1",[documentId])).rows[0];
    const storedBlock=(await pool.query("SELECT normalized_text FROM ai_builder_website_source_blocks WHERE id=$1",[blockId])).rows[0];
    assert.equal(storedAttempt.status,"completed");assert.equal(storedDocument.canonical_url,document.canonicalUrl);assert.equal(storedBlock.normalized_text,block.normalizedText);
  }finally{await pool.query("DELETE FROM ai_builder_website_source_blocks WHERE crawl_attempt_id=$1",[id]);await pool.query("DELETE FROM ai_builder_website_source_documents WHERE crawl_attempt_id=$1",[id]);await pool.query("DELETE FROM ai_builder_website_crawl_attempts WHERE id=$1",[id]);await pool.end();}
});
