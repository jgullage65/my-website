import "server-only";
import { ensureAiBuilderSchema } from "@/app/lib/db/ai-builder-schema";
import { getSql } from "@/app/lib/db/client";
import { canonicalWebsiteRecrawlJson, type WebsiteRecrawlReconciliation } from "./websiteRecrawlReconciliation";
import { sha256 } from "./websiteSourceRecords";

const idFor=(projectId:string,result:WebsiteRecrawlReconciliation)=>`website_recrawl_${sha256(`${projectId}\0${result.previousCrawlAttemptId}\0${result.currentCrawlAttemptId}`).slice(0,32)}`;

/** Identical retries are idempotent; a different result for the same crawl pair fails closed. */
export async function persistWebsiteRecrawlReconciliation(projectId:string,result:WebsiteRecrawlReconciliation):Promise<string>{
  if(!projectId||result.previousCrawlAttemptId===result.currentCrawlAttemptId)throw new Error("invalid_website_recrawl_reconciliation");
  const expectedFingerprint=sha256(canonicalWebsiteRecrawlJson({...result,fingerprint:undefined}));
  if(expectedFingerprint!==result.fingerprint)throw new Error("invalid_website_recrawl_fingerprint");
  await ensureAiBuilderSchema();const sql=getSql(),id=idFor(projectId,result),serialized=canonicalWebsiteRecrawlJson(result);
  await sql`INSERT INTO ai_builder_website_recrawl_reconciliations (id,schema_version,project_id,previous_crawl_attempt_id,current_crawl_attempt_id,fingerprint,result)
    VALUES (${id},${result.schemaVersion},${projectId},${result.previousCrawlAttemptId},${result.currentCrawlAttemptId},${result.fingerprint},${serialized}::jsonb)
    ON CONFLICT (project_id,previous_crawl_attempt_id,current_crawl_attempt_id) DO NOTHING`;
  const rows=await sql`SELECT id,schema_version,fingerprint,result FROM ai_builder_website_recrawl_reconciliations WHERE project_id=${projectId} AND previous_crawl_attempt_id=${result.previousCrawlAttemptId} AND current_crawl_attempt_id=${result.currentCrawlAttemptId}` as unknown as Array<Record<string,unknown>>;
  const row=rows[0];if(!row||row.id!==id||row.schema_version!==result.schemaVersion||row.fingerprint!==result.fingerprint||canonicalWebsiteRecrawlJson(row.result)!==serialized)throw new Error(`website_recrawl_immutable_collision:${id}`);
  return id;
}
