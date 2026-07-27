import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "@neondatabase/serverless";
import { WEBSITE_KNOWLEDGE_COVERAGE_FIELDS, type PersistedWebsiteKnowledge } from "../knowledge/websiteKnowledge";
import { reconcileWebsiteRecrawl } from "./websiteRecrawlReconciliation";

const databaseUrl=process.env.DATABASE_URL,db=databaseUrl?test:test.skip;
db("persists one immutable deterministic reconciliation per project and crawl pair",async()=>{
  const {persistWebsiteRecrawlReconciliation}=await import("./websiteRecrawlReconciliationStore"),pool=new Pool({connectionString:databaseUrl});
  const {ensureAiBuilderSchema}=await import("../../db/ai-builder-schema");await ensureAiBuilderSchema();
  const suffix=randomUUID(),projectId=`project-${suffix}`,previousId=`crawl-previous-${suffix}`,currentId=`crawl-current-${suffix}`,time=new Date().toISOString();
  const coverage=Object.fromEntries(WEBSITE_KNOWLEDGE_COVERAGE_FIELDS.map(field=>[field,0])) as PersistedWebsiteKnowledge["knowledge"]["coverage"];
  const knowledge=(id:string):PersistedWebsiteKnowledge=>({schema_version:2,document_version:1,current_crawl_attempt_id:id,imported_at:time,requested_url:"https://example.test/",resolved_url:"https://example.test/",pages:[],warnings:[],knowledge:{facts:[],coverage,unresolvedQuestions:[]},source_documents:[],source_blocks:[]});
  const result=reconcileWebsiteRecrawl({previous:knowledge(previousId),current:knowledge(currentId)});
  try{
    await pool.query("INSERT INTO ai_builder_projects (id,status,business_name,industry,created_at,updated_at) VALUES ($1,'active','Test','Test',$2,$2)",[projectId,time]);
    for(const id of [previousId,currentId])await pool.query("INSERT INTO ai_builder_website_crawl_attempts (id,schema_version,requested_url,normalized_submitted_url,resolved_entry_url,started_at,completed_at,crawler_version,extraction_version,status,budgets,restrictions) VALUES ($1,1,'https://example.test/','https://example.test/','https://example.test/',$2,$2,'test','test','completed','{}','[]')",[id,time]);
    const first=await persistWebsiteRecrawlReconciliation(projectId,result),second=await persistWebsiteRecrawlReconciliation(projectId,result);assert.equal(first,second);
    const stored=await pool.query("SELECT fingerprint,result FROM ai_builder_website_recrawl_reconciliations WHERE project_id=$1",[projectId]);assert.equal(stored.rowCount,1);assert.equal(stored.rows[0]?.fingerprint,result.fingerprint);assert.deepEqual(stored.rows[0]?.result,result);
    await pool.query("UPDATE ai_builder_website_recrawl_reconciliations SET result='{}'::jsonb WHERE project_id=$1",[projectId]);await assert.rejects(persistWebsiteRecrawlReconciliation(projectId,result),/website_recrawl_immutable_collision/);
  }finally{await pool.query("DELETE FROM ai_builder_projects WHERE id=$1",[projectId]);await pool.query("DELETE FROM ai_builder_website_crawl_attempts WHERE id=ANY($1)",[[previousId,currentId]]);await pool.end();}
});
