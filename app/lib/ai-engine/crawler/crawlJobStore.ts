import "server-only";

import { ensureAiBuilderSchema } from "@/app/lib/db/ai-builder-schema";
import { getSql } from "@/app/lib/db/client";

export type CrawlJobState = "queued" | "crawling" | "processing" | "completed" | "failed";
export type CrawlJob = { id: string; clerkUserId: string; requestedUrl: string; state: CrawlJobState; pagesDiscovered: number; pagesCrawled: number; crawlComplete: boolean; processingPercent: number | null; result: Record<string, unknown> | null; errorMessage: string | null };

const job = (row: Record<string, unknown>): CrawlJob => ({ id: String(row.id), clerkUserId: String(row.clerk_user_id), requestedUrl: String(row.requested_url), state: row.state as CrawlJobState, pagesDiscovered: Number(row.pages_discovered ?? 0), pagesCrawled: Number(row.pages_crawled ?? 0), crawlComplete: Boolean(row.crawl_complete), processingPercent: row.processing_percent == null ? null : Number(row.processing_percent), result: row.result && typeof row.result === "object" ? row.result as Record<string, unknown> : null, errorMessage: row.error_message == null ? null : String(row.error_message) });

const firstRow = (value: unknown): Record<string, unknown> | null => {
  if (!Array.isArray(value) || !value.length) return null;
  const row = value[0];
  return row && typeof row === "object" && !Array.isArray(row)
    ? row as Record<string, unknown>
    : null;
};

export async function createCrawlJob(clerkUserId: string, requestedUrl: string): Promise<CrawlJob> { await ensureAiBuilderSchema(); const id = crypto.randomUUID(); const rows = await getSql()`INSERT INTO ai_builder_crawl_jobs (id,clerk_user_id,requested_url,state) VALUES (${id},${clerkUserId},${requestedUrl},'queued') RETURNING *`; const row = firstRow(rows); if (!row) throw new Error("The crawl job could not be created."); return job(row); }
export async function getOwnedCrawlJob(id: string, clerkUserId: string): Promise<CrawlJob | null> { await ensureAiBuilderSchema(); const row = firstRow(await getSql()`SELECT * FROM ai_builder_crawl_jobs WHERE id=${id} AND clerk_user_id=${clerkUserId}`); return row ? job(row) : null; }
export async function claimNextCrawlJob(): Promise<CrawlJob | null> { await ensureAiBuilderSchema(); const row = firstRow(await getSql()`UPDATE ai_builder_crawl_jobs SET state='crawling',started_at=COALESCE(started_at,NOW()),updated_at=NOW(),error_message=NULL WHERE id=(SELECT id FROM ai_builder_crawl_jobs WHERE state='queued' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED) AND state='queued' RETURNING *`); return row ? job(row) : null; }
export async function updateCrawlJobProgress(id: string, data: { state?: CrawlJobState; pagesDiscovered?: number; pagesCrawled?: number; crawlComplete?: boolean; processingPercent?: number }): Promise<void> { await ensureAiBuilderSchema(); await getSql()`UPDATE ai_builder_crawl_jobs SET state=COALESCE(${data.state ?? null},state),pages_discovered=GREATEST(pages_discovered,${data.pagesDiscovered ?? 0}),pages_crawled=GREATEST(pages_crawled,${data.pagesCrawled ?? 0}),crawl_complete=CASE WHEN ${data.crawlComplete ?? false} THEN TRUE ELSE crawl_complete END,processing_percent=COALESCE(${data.processingPercent ?? null},processing_percent),updated_at=NOW() WHERE id=${id}`; }
export async function completeCrawlJob(id: string, result: Record<string, unknown>): Promise<void> { await ensureAiBuilderSchema(); await getSql()`UPDATE ai_builder_crawl_jobs SET state='completed',crawl_complete=TRUE,processing_percent=100,result=${JSON.stringify(result)}::jsonb,error_message=NULL,completed_at=NOW(),updated_at=NOW() WHERE id=${id}`; }
export async function failCrawlJob(id: string, message: string): Promise<void> { await ensureAiBuilderSchema(); await getSql()`UPDATE ai_builder_crawl_jobs SET state='failed',error_message=${message.slice(0,500)},completed_at=NOW(),updated_at=NOW() WHERE id=${id}`; }
