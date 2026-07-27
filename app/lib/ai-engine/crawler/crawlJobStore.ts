import "server-only";

import { ensureAiBuilderSchema } from "@/app/lib/db/ai-builder-schema";
import { getSql } from "@/app/lib/db/client";

export type CrawlJobState = "queued" | "crawling" | "processing" | "completed" | "failed";
export type CrawlJob = {
  id: string;
  clerkUserId: string;
  requestedUrl: string;
  state: CrawlJobState;
  pagesDiscovered: number;
  pagesCrawled: number;
  crawlComplete: boolean;
  processingPercent: number | null;
  result: Record<string, unknown> | null;
  errorMessage: string | null;
  attemptCount: number;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  nextAttemptAt: string | null;
};

export class CrawlJobAdmissionError extends Error {
  constructor(message: string) { super(message); this.name = "CrawlJobAdmissionError"; }
}

const MAX_JOB_ATTEMPTS = 3;
const LEASE_SECONDS = 20 * 60;
const count = (value: number | undefined) => Number.isFinite(value) ? Math.max(0, Math.floor(value!)) : 0;
const percent = (value: number | undefined) => Number.isFinite(value) ? Math.min(100, Math.max(0, Math.floor(value!))) : undefined;

const job = (row: Record<string, unknown>): CrawlJob => ({
  id: String(row.id), clerkUserId: String(row.clerk_user_id), requestedUrl: String(row.requested_url), state: row.state as CrawlJobState,
  pagesDiscovered: Number(row.pages_discovered ?? 0), pagesCrawled: Number(row.pages_crawled ?? 0), crawlComplete: Boolean(row.crawl_complete),
  processingPercent: row.processing_percent == null ? null : Number(row.processing_percent),
  result: row.result && typeof row.result === "object" ? row.result as Record<string, unknown> : null,
  errorMessage: row.error_message == null ? null : String(row.error_message), attemptCount: Number(row.attempt_count ?? 0),
  leaseOwner: row.lease_owner == null ? null : String(row.lease_owner), leaseExpiresAt: row.lease_expires_at == null ? null : new Date(String(row.lease_expires_at)).toISOString(),
  nextAttemptAt: row.next_attempt_at == null ? null : new Date(String(row.next_attempt_at)).toISOString(),
});

const firstRow = (value: unknown): Record<string, unknown> | null => {
  if (!Array.isArray(value) || !value.length) return null;
  const row = value[0];
  return row && typeof row === "object" && !Array.isArray(row) ? row as Record<string, unknown> : null;
};

async function activeJob(clerkUserId: string): Promise<CrawlJob | null> {
  const row = firstRow(await getSql()`SELECT * FROM ai_builder_crawl_jobs WHERE clerk_user_id=${clerkUserId} AND state IN ('queued','crawling','processing') ORDER BY created_at,id LIMIT 1`);
  return row ? job(row) : null;
}

export async function createCrawlJob(clerkUserId: string, requestedUrl: string): Promise<CrawlJob> {
  await ensureAiBuilderSchema();
  const existing = await activeJob(clerkUserId);
  if (existing) {
    if (existing.requestedUrl === requestedUrl) return existing;
    throw new CrawlJobAdmissionError("Finish the active website import before starting another one.");
  }
  const id = crypto.randomUUID();
  try {
    const row = firstRow(await getSql()`INSERT INTO ai_builder_crawl_jobs (id,clerk_user_id,requested_url,state) VALUES (${id},${clerkUserId},${requestedUrl},'queued') RETURNING *`);
    if (!row) throw new Error("The crawl job could not be created.");
    return job(row);
  } catch (error) {
    // The partial unique index is the final authority for concurrent requests.
    const raced = await activeJob(clerkUserId);
    if (!raced) throw error;
    if (raced.requestedUrl === requestedUrl) return raced;
    throw new CrawlJobAdmissionError("Finish the active website import before starting another one.");
  }
}

export async function getOwnedCrawlJob(id: string, clerkUserId: string): Promise<CrawlJob | null> {
  await ensureAiBuilderSchema();
  const row = firstRow(await getSql()`SELECT * FROM ai_builder_crawl_jobs WHERE id=${id} AND clerk_user_id=${clerkUserId}`);
  return row ? job(row) : null;
}

export async function claimNextCrawlJob(): Promise<CrawlJob | null> {
  await ensureAiBuilderSchema();
  const sql = getSql();
  await sql`
    UPDATE ai_builder_crawl_jobs SET state='failed',error_message=COALESCE(error_message,'The crawl worker stopped before completing the job.'),completed_at=NOW(),updated_at=NOW(),lease_owner=NULL,lease_expires_at=NULL
    WHERE state IN ('crawling','processing') AND lease_expires_at < NOW() AND attempt_count >= ${MAX_JOB_ATTEMPTS}
  `;
  const leaseOwner = crypto.randomUUID();
  const row = firstRow(await sql`
    UPDATE ai_builder_crawl_jobs SET state='crawling',started_at=COALESCE(started_at,NOW()),updated_at=NOW(),error_message=NULL,
      attempt_count=attempt_count+1,lease_owner=${leaseOwner},lease_expires_at=NOW()+(${LEASE_SECONDS}*INTERVAL '1 second'),
      pages_discovered=0,pages_crawled=0,crawl_complete=FALSE,processing_percent=NULL,result=NULL,next_attempt_at=NULL
    WHERE id=(
      SELECT id FROM ai_builder_crawl_jobs
      WHERE (state='queued' AND COALESCE(next_attempt_at,NOW()) <= NOW()) OR (state IN ('crawling','processing') AND lease_expires_at < NOW() AND attempt_count < ${MAX_JOB_ATTEMPTS})
      ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `);
  return row ? job(row) : null;
}

export async function updateCrawlJobProgress(id: string, leaseOwner: string, data: { state?: "crawling" | "processing"; pagesDiscovered?: number; pagesCrawled?: number; crawlComplete?: boolean; processingPercent?: number }): Promise<void> {
  await ensureAiBuilderSchema();
  const pagesDiscovered = count(data.pagesDiscovered);
  const pagesCrawled = count(data.pagesCrawled);
  const processingPercent = percent(data.processingPercent);
  const row = firstRow(await getSql()`
    UPDATE ai_builder_crawl_jobs SET
      state=CASE WHEN ${data.state ?? null}='processing' AND (${data.crawlComplete ?? false} OR crawl_complete) THEN 'processing' ELSE state END,
      pages_discovered=GREATEST(pages_discovered,${pagesDiscovered}),pages_crawled=GREATEST(pages_crawled,${pagesCrawled}),
      crawl_complete=CASE WHEN ${data.crawlComplete ?? false} THEN TRUE ELSE crawl_complete END,
      processing_percent=CASE WHEN ${processingPercent ?? null}::integer IS NULL OR NOT (${data.crawlComplete ?? false} OR crawl_complete) THEN processing_percent ELSE GREATEST(COALESCE(processing_percent,0),${processingPercent ?? null}::integer) END,
      lease_expires_at=NOW()+(${LEASE_SECONDS}*INTERVAL '1 second'),updated_at=NOW()
    WHERE id=${id} AND lease_owner=${leaseOwner} AND lease_expires_at > NOW() AND state IN ('crawling','processing')
      AND (${data.state ?? null}::text IS NULL OR ${data.state ?? null}='crawling' OR state IN ('crawling','processing'))
    RETURNING id
  `);
  if (!row) throw new Error("The crawl job lease was lost.");
}

export async function completeCrawlJob(id: string, leaseOwner: string, result: Record<string, unknown>): Promise<void> {
  await ensureAiBuilderSchema();
  const row = firstRow(await getSql()`
    UPDATE ai_builder_crawl_jobs SET state='completed',crawl_complete=TRUE,processing_percent=100,result=${JSON.stringify(result)}::jsonb,error_message=NULL,
      completed_at=NOW(),updated_at=NOW(),lease_owner=NULL,lease_expires_at=NULL
    WHERE id=${id} AND lease_owner=${leaseOwner} AND lease_expires_at > NOW() AND state='processing' AND crawl_complete=TRUE RETURNING id
  `);
  if (!row) throw new Error("The crawl job lease was lost before completion.");
}

export async function failCrawlJob(id: string, leaseOwner: string, message: string, options: { retryable?: boolean } = {}): Promise<void> {
  await ensureAiBuilderSchema();
  const retryable = options.retryable !== false;
  const row = firstRow(await getSql()`
    UPDATE ai_builder_crawl_jobs SET
      state=CASE WHEN ${retryable} AND attempt_count < ${MAX_JOB_ATTEMPTS} THEN 'queued' ELSE 'failed' END,
      error_message=${message.slice(0,500)},completed_at=CASE WHEN ${retryable} AND attempt_count < ${MAX_JOB_ATTEMPTS} THEN NULL ELSE NOW() END,
      next_attempt_at=CASE WHEN ${retryable} AND attempt_count < ${MAX_JOB_ATTEMPTS} THEN NOW()+(CASE WHEN attempt_count=1 THEN INTERVAL '30 seconds' ELSE INTERVAL '2 minutes' END) ELSE NULL END,
      updated_at=NOW(),lease_owner=NULL,lease_expires_at=NULL,processing_percent=NULL,crawl_complete=FALSE
    WHERE id=${id} AND lease_owner=${leaseOwner} AND lease_expires_at > NOW() AND state IN ('crawling','processing') RETURNING id
  `);
  if (!row) throw new Error("The crawl job lease was lost before failure handling.");
}
