import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;
const db = databaseUrl ? test : test.skip;

db("crawl jobs enforce admission, lease ownership, stale recovery, and monotonic completion", async () => {
  process.env.DATABASE_URL = databaseUrl;
  const {
    CrawlJobAdmissionError,
    claimNextCrawlJob,
    completeCrawlJob,
    createCrawlJob,
    getOwnedCrawlJob,
    updateCrawlJobProgress,
  } = await import("./crawlJobStore");
  const pool = new Pool({ connectionString: databaseUrl });
  const owner = `crawl-owner-${randomUUID()}`;
  let jobId = "";
  try {
    const created = await createCrawlJob(owner, "https://example.test/location");
    jobId = created.id;
    assert.equal((await createCrawlJob(owner, "https://example.test/location")).id, jobId);
    await assert.rejects(() => createCrawlJob(owner, "https://example.test/other"), CrawlJobAdmissionError);

    await pool.query("UPDATE ai_builder_crawl_jobs SET created_at='2000-01-01'::timestamptz WHERE id=$1", [jobId]);
    const firstClaim = await claimNextCrawlJob();
    assert.equal(firstClaim?.id, jobId);
    assert.equal(firstClaim?.attemptCount, 1);
    assert.ok(firstClaim?.leaseOwner);
    await assert.rejects(() => updateCrawlJobProgress(jobId, "wrong-owner", { pagesCrawled: 1 }), /lease was lost/);

    await pool.query("UPDATE ai_builder_crawl_jobs SET lease_expires_at=NOW()-INTERVAL '1 second' WHERE id=$1", [jobId]);
    const recovered = await claimNextCrawlJob();
    assert.equal(recovered?.id, jobId);
    assert.equal(recovered?.attemptCount, 2);
    assert.notEqual(recovered?.leaseOwner, firstClaim?.leaseOwner);
    await assert.rejects(() => completeCrawlJob(jobId, firstClaim!.leaseOwner!, { stale: true }), /lease was lost/);

    await updateCrawlJobProgress(jobId, recovered!.leaseOwner!, { state: "processing", pagesDiscovered: 4, pagesCrawled: 3, crawlComplete: true, processingPercent: 70 });
    await updateCrawlJobProgress(jobId, recovered!.leaseOwner!, { state: "crawling", pagesDiscovered: 2, pagesCrawled: 1, processingPercent: 60 });
    await completeCrawlJob(jobId, recovered!.leaseOwner!, { ok: true });
    const completed = await getOwnedCrawlJob(jobId, owner);
    assert.equal(completed?.state, "completed");
    assert.equal(completed?.pagesDiscovered, 4);
    assert.equal(completed?.pagesCrawled, 3);
    assert.equal(completed?.processingPercent, 100);
    assert.deepEqual(completed?.result, { ok: true });
  } finally {
    if (jobId) await pool.query("DELETE FROM ai_builder_crawl_jobs WHERE id=$1", [jobId]);
    await pool.end();
  }
});

db("concurrent crawl claims assign each job to only one lease owner", async () => {
  process.env.DATABASE_URL = databaseUrl;
  const { claimNextCrawlJob, createCrawlJob } = await import("./crawlJobStore");
  const pool = new Pool({ connectionString: databaseUrl });
  const owners = [`claim-owner-${randomUUID()}`, `claim-owner-${randomUUID()}`];
  const jobs = await Promise.all(owners.map((owner, index) => createCrawlJob(owner, `https://example.test/${index}`)));
  try {
    await pool.query("UPDATE ai_builder_crawl_jobs SET created_at='1999-01-01'::timestamptz WHERE id=ANY($1::text[])", [jobs.map((job) => job.id)]);
    const claims = await Promise.all([claimNextCrawlJob(), claimNextCrawlJob()]);
    assert.deepEqual(new Set(claims.map((claim) => claim?.id)), new Set(jobs.map((job) => job.id)));
    assert.equal(new Set(claims.map((claim) => claim?.leaseOwner)).size, 2);
  } finally {
    await pool.query("DELETE FROM ai_builder_crawl_jobs WHERE id=ANY($1::text[])", [jobs.map((job) => job.id)]);
    await pool.end();
  }
});

db("crawl job failures back off transient retries and stop permanent retries", async () => {
  process.env.DATABASE_URL = databaseUrl;
  const { claimNextCrawlJob, createCrawlJob, failCrawlJob } = await import("./crawlJobStore");
  const pool = new Pool({ connectionString: databaseUrl });
  const owner = `retry-owner-${randomUUID()}`;
  const created = await createCrawlJob(owner, "https://example.test/retry");
  try {
    await pool.query("UPDATE ai_builder_crawl_jobs SET created_at='1998-01-01'::timestamptz WHERE id=$1", [created.id]);
    const first = await claimNextCrawlJob();
    assert.equal(first?.id, created.id);
    await failCrawlJob(created.id, first!.leaseOwner!, "temporary worker failure", { retryable: true });
    let row = (await pool.query("SELECT state,attempt_count,next_attempt_at FROM ai_builder_crawl_jobs WHERE id=$1", [created.id])).rows[0];
    assert.equal(row.state, "queued");
    assert.equal(Number(row.attempt_count), 1);
    assert.ok(new Date(row.next_attempt_at).getTime() > Date.now());

    await pool.query("UPDATE ai_builder_crawl_jobs SET next_attempt_at=NOW()-INTERVAL '1 second' WHERE id=$1", [created.id]);
    const second = await claimNextCrawlJob();
    assert.equal(second?.id, created.id);
    await failCrawlJob(created.id, second!.leaseOwner!, "invalid website", { retryable: false });
    row = (await pool.query("SELECT state,next_attempt_at FROM ai_builder_crawl_jobs WHERE id=$1", [created.id])).rows[0];
    assert.equal(row.state, "failed");
    assert.equal(row.next_attempt_at, null);
  } finally {
    await pool.query("DELETE FROM ai_builder_crawl_jobs WHERE id=$1", [created.id]);
    await pool.end();
  }
});
