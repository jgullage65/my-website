import assert from "node:assert/strict";
import test, { after, beforeEach, mock } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { researchPublicBusiness } from "./engine";
import { gleifAdapter, type SourceAdapter } from "./adapters";
import { GLEIF_POLICY } from "./policy";
import { ResearchFetcher } from "./transport";
import { publicResearchSubjectKey } from "./identityKey";
import { researchSchedule, RESEARCH_REFRESH_MS, RESEARCH_RETRY_MS } from "./scheduling";
import type { BusinessIdentity, ResearchSnapshot } from "./contracts";

const db = new PGlite();
const sql = async (parts: TemplateStringsArray, ...values: unknown[]) =>
  (await db.query(parts.reduce((q, p, i) => q + (i ? `$${i}` : "") + p, ""), values)).rows;
let calls = 0, persisted = 0;
let run: (identity: BusinessIdentity, previous: ResearchSnapshot | null) => Promise<ResearchSnapshot>;
let hold: (() => Promise<void>) | undefined;
let historyError = false;
const client = async (parts: TemplateStringsArray, ...values: unknown[]) => {
  if (historyError && parts[0]!.startsWith("INSERT INTO ai_builder_public_research_history")) throw new Error("history unavailable");
  return sql(parts, ...values);
};
mock.module("../../db/client.ts", { namedExports: { getSql: () => client } });
mock.module("../crawler/websiteSourceRecordStore.ts", { namedExports: { persistWebsiteSourceRecords: async () => { persisted++; } } });
mock.module("./engine.ts", { namedExports: { researchPublicBusiness: async (identity: BusinessIdentity, options: { previous: ResearchSnapshot | null }) => {
  calls++; await hold?.(); return run(identity, options.previous);
} } });
const { runStoredPublicResearch } = await import("./store");
const identity = { name: "Acme LLC", address: "123 Main St", city: "Austin", state: "TX", country: "US" };
const record = { id: "ABCDEFGHIJKLMNOPQRST", attributes: { entity: { legalName: { name: identity.name }, legalAddress: { addressLines: [identity.address], city: identity.city, region: "US-TX", country: "US" } }, registration: { status: "ISSUED" } } };
const response = (value: unknown, status = 200, plain = false) => ({status, ok: status === 200,
  headers: new Headers({"content-type": plain ? "text/plain" : "application/json"}),
  body: new ReadableStream<Uint8Array>({start(c) { c.enqueue(new TextEncoder().encode(plain ? String(value) : JSON.stringify(value))); c.close(); }})});
function fixture(mode = "success", previous: ResearchSnapshot | null = null, extra: SourceAdapter[] = []) {
  return researchPublicBusiness(identity, { previous, adapters: [gleifAdapter, ...extra], fetcher: new ResearchFetcher(undefined, async url => {
    if (mode === "DNS") throw new Error("getaddrinfo EAI_AGAIN api.gleif.org");
    if (mode === "timeout") throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    if (url.pathname === "/robots.txt") return response("", mode === "robots" ? 503 : 200, true);
    if (mode === "429" || mode === "503") return response({}, Number(mode));
    if (mode === "insufficient") return response({ data: [] });
    return response({ data: url.pathname.endsWith("lei-records") ? [record] : record });
  }, async () => true) });
}
async function state() {
  return (await db.query<{consecutive_failures: number; delay: number; snapshot: ResearchSnapshot; lease_owner: string | null}>(
    "SELECT *, extract(epoch from (next_attempt_at - now()))::float8 AS delay FROM ai_builder_public_research_state")).rows[0]!;
}
async function due() { await db.exec("UPDATE ai_builder_public_research_state SET next_attempt_at=now()-interval '1 second'"); }
async function interval(ms: number, failures: number) {
  const row = await state(); assert.equal(row.consecutive_failures, failures);
  assert.ok(row.delay <= ms / 1000 && row.delay > ms / 1000 - 5, `unexpected delay ${row.delay}`);
  assert.equal(row.lease_owner, null);
}
beforeEach(async () => {
  await db.exec("DROP TABLE IF EXISTS ai_builder_public_research_history; CREATE TABLE ai_builder_public_research_history (attempt_id text PRIMARY KEY,subject_key text NOT NULL,fingerprint text NOT NULL,snapshot jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now())");
  await db.exec("CREATE TABLE IF NOT EXISTS ai_builder_public_research_state (subject_key text PRIMARY KEY,lease_owner text,lease_until timestamptz,next_attempt_at timestamptz,snapshot jsonb,updated_at timestamptz NOT NULL DEFAULT now()); TRUNCATE ai_builder_public_research_state");
  calls = persisted = 0; hold = undefined; historyError = false;
  process.env.PUBLIC_RESEARCH_IDENTITY_HASH_SECRET = "scheduling-test";
  run = (_identity, previous) => fixture("success", previous);
});
after(() => db.close());

test("production schema upgrade preserves a populated legacy cache and defaults its failure counter", async () => {
  const previous = await fixture();
  const key = publicResearchSubjectKey(identity, process.env.PUBLIC_RESEARCH_IDENTITY_HASH_SECRET!);
  await db.query("INSERT INTO ai_builder_public_research_state(subject_key,snapshot,next_attempt_at) VALUES($1,$2::jsonb,now()+interval '1 hour')", [key, JSON.stringify(previous)]);
  const view = await runStoredPublicResearch(identity);
  assert.deepEqual(view?.facts, previous.facts); assert.equal(calls, 0);
  assert.equal((await state()).consecutive_failures, 0);
});
test("complete success: six hours, validated cached reads and no early requests", async () => {
  const result = await runStoredPublicResearch(identity); assert.ok(result?.facts.length);
  await interval(RESEARCH_REFRESH_MS, 0);
  const cached = await runStoredPublicResearch(identity);
  assert.deepEqual(cached?.facts, result.facts); assert.equal(calls, 1); assert.equal(persisted, 1);
});
for (const mode of ["DNS", "timeout", "429", "503", "robots"]) test(`${mode}: five-minute recovery gate and no early retry`, async () => {
  run = (_i, previous) => fixture(mode, previous);
  const result = await runStoredPublicResearch(identity);
  assert.equal(result?.attempt.status, "partial");
  assert.ok(result?.outcomes.some(o => o.state === "source_unavailable"));
  await interval(RESEARCH_RETRY_MS[0], 1);
  await runStoredPublicResearch(identity); assert.equal(calls, 1);
});
test("partial success keeps new useful facts and retries the unavailable source early", async () => {
  const unavailable: SourceAdapter = {...gleifAdapter, id: "offline", policy: {...GLEIF_POLICY,id:"offline"}, discover: async () => {throw new Error("ECONNRESET");}};
  run = (_i, previous) => fixture("success", previous, [unavailable]);
  const result = await runStoredPublicResearch(identity);
  assert.ok(result?.facts.length); assert.equal(result.attempt.status, "partial");
  await interval(RESEARCH_RETRY_MS[0], 1);
});
test("all sources insufficient: six hours without an expedited retry loop", async () => {
  run = () => fixture("insufficient");
  assert.equal((await runStoredPublicResearch(identity))?.facts.length, 0);
  await interval(RESEARCH_REFRESH_MS, 0);
});
test("repeated failures persist 5m, 15m, 1h, 6h, 6h; due recovery resets failures", async () => {
  run = () => fixture("DNS");
  for (let i = 0; i < 6; i++) {
    await runStoredPublicResearch(identity);
    await interval(RESEARCH_RETRY_MS[Math.min(i, 3)]!, Math.min(i + 1, 4));
    await runStoredPublicResearch(identity); assert.equal(calls, i + 1);
    await due();
  }
  run = () => fixture();
  assert.ok((await runStoredPublicResearch(identity))?.facts.length);
  await interval(RESEARCH_REFRESH_MS, 0);
});
test("concurrent refresh requests run once; active readers return validated previous research", async () => {
  await runStoredPublicResearch(identity); await due();
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { entered = resolve; });
  hold = () => { entered(); return gate; };
  const owner = runStoredPublicResearch(identity); await started;
  const readers = await Promise.all(Array.from({length: 5}, () => runStoredPublicResearch(identity)));
  assert.ok(readers.every(r => r?.facts.length)); assert.equal(calls, 2);
  release(); await owner; assert.equal(persisted, 2);
});
test("expired worker cannot change a replacement owner's snapshot, retry count or lease", async () => {
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>(resolve => {release = resolve;});
  const started = new Promise<void>(resolve => {entered = resolve;});
  hold = () => {entered(); return gate;}; run = () => fixture("DNS");
  const late = runStoredPublicResearch(identity); await started;
  await db.exec("UPDATE ai_builder_public_research_state SET lease_until=now()-interval '1 second'");
  hold = undefined; run = () => fixture();
  await runStoredPublicResearch(identity); const saved = JSON.stringify(await state());
  release(); assert.equal(await late, null);
  const row = await state(); assert.equal(row.consecutive_failures, 0); assert.ok(row.snapshot.facts.length);
  assert.equal(JSON.parse(saved).snapshot.attempt.id, row.snapshot.attempt.id);
});
test("thrown refresh retains valid previous research and applies backoff", async () => {
  const previous = await runStoredPublicResearch(identity); await due();
  run = async () => { throw new Error("unexpected network failure"); };
  assert.deepEqual((await runStoredPublicResearch(identity))?.facts, previous?.facts);
  await interval(RESEARCH_RETRY_MS[0], 1);
});
test("transient failure preserves original evidence age; repeated failures cannot freshen it", async () => {
  const previous = await runStoredPublicResearch(identity); await due();
  run = (_i, prior) => fixture("DNS", prior);
  const current = await runStoredPublicResearch(identity);
  assert.deepEqual(current?.facts, previous?.facts);
  assert.equal(current?.documents[0]?.id, previous?.documents[0]?.id);
  const saved = await state();
  saved.snapshot.facts.forEach(f => {f.research.retrievedAt = "2020-01-01T00:00:00Z"; delete f.research.validatedAt;});
  await db.query("UPDATE ai_builder_public_research_state SET snapshot=$1::jsonb", [JSON.stringify(saved.snapshot)]);
  assert.equal((await runStoredPublicResearch(identity))?.facts.length, 0);
  await due(); assert.equal((await runStoredPublicResearch(identity))?.facts.length, 0);
});
test("revoked or expired cached permissions never enter a new partial publication", async () => {
  for (const variant of ["expiry", "rights"]) {
    run = () => fixture(); await due(); await runStoredPublicResearch(identity); await due();
    const expires = GLEIF_POLICY.expiresAt, rights = GLEIF_POLICY.rights.commercialUse;
    try {
      if (variant === "expiry") GLEIF_POLICY.expiresAt = "2020-01-01"; else GLEIF_POLICY.rights.commercialUse = false;
      run = (_i, prior) => fixture("DNS", prior);
      const result = await runStoredPublicResearch(identity);
      assert.equal(result?.facts.length, 0); assert.equal(result?.blocks.length, 0); assert.equal(result?.documents.length, 0);
      const cached = await runStoredPublicResearch(identity); assert.equal(cached?.facts.length, 0);
    } finally { GLEIF_POLICY.expiresAt = expires; GLEIF_POLICY.rights.commercialUse = rights; }
  }
});
test("history failure after publication cannot undo success or change its schedule", async () => {
  historyError = true;
  assert.ok((await runStoredPublicResearch(identity))?.facts.length);
  await interval(RESEARCH_REFRESH_MS, 0);
});
test("schema upgrade preserves existing rows and defaults counters; schedule clamps retry counts", async () => {
  await runStoredPublicResearch(identity);
  await db.exec("ALTER TABLE ai_builder_public_research_state ADD COLUMN IF NOT EXISTS consecutive_failures integer NOT NULL DEFAULT 0");
  assert.ok((await state()).snapshot.facts.length);
  assert.equal(researchSchedule(null, 999).failures, 4);
  assert.equal(researchSchedule(null, -3).delayMs, RESEARCH_RETRY_MS[0]);
});

test("concurrent initial requests have one owner and empty readers cannot start another crawl", async () => {
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>(resolve => {release = resolve;});
  const started = new Promise<void>(resolve => {entered = resolve;});
  hold = () => {entered(); return gate;};
  const owner = runStoredPublicResearch(identity); await started;
  assert.deepEqual(await Promise.all([runStoredPublicResearch(identity), runStoredPublicResearch(identity)]), [null, null]);
  assert.equal(calls, 1); release(); assert.ok((await owner)?.facts.length);
});
test("a thrown late worker cannot reschedule or release a replacement active lease", async () => {
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>(resolve => {release = resolve;});
  const started = new Promise<void>(resolve => {entered = resolve;});
  run = async () => {entered(); await gate; throw new Error("late failure");};
  const late = runStoredPublicResearch(identity); await started;
  await db.exec("UPDATE ai_builder_public_research_state SET lease_owner='replacement',lease_until=now()+interval '45 seconds',consecutive_failures=2,next_attempt_at=now()+interval '15 minutes'");
  release(); assert.equal(await late, null);
  const row = await state(); assert.equal(row.lease_owner, "replacement"); assert.equal(row.consecutive_failures, 2);
  assert.ok(row.delay > 895);
});

test("candidate-stage robots failures are unavailable while identity rejection uses normal freshness", async () => {
  const direct: SourceAdapter = {...gleifAdapter, discover: async () => [{url: "https://api.gleif.org/api/v1/lei-records/ABCDEFGHIJKLMNOPQRST",policyId:GLEIF_POLICY.id,discoveredBy:"fixture",discoveredFrom:GLEIF_POLICY.origin}]};
  run = () => researchPublicBusiness(identity, {adapters:[direct], fetcher:new ResearchFetcher(undefined, async () => response("", 503, true), async () => true)});
  const partial = await runStoredPublicResearch(identity);
  assert.equal(partial?.outcomes[0]?.state, "source_unavailable");
  assert.equal(partial?.outcomes[0]?.reason, "robots_unavailable");
  await interval(RESEARCH_RETRY_MS[0], 1); await due();
  run = () => researchPublicBusiness(identity, {adapters:[direct], fetcher:new ResearchFetcher(undefined, async url => url.pathname === "/robots.txt" ? response("",200,true) : response({data:{id:record.id,attributes:{entity:{legalName:{name:"Unrelated Business"}}}}}), async () => true)});
  const insufficient = await runStoredPublicResearch(identity);
  assert.equal(insufficient?.facts.length, 0); assert.equal(insufficient?.attempt.status, "completed");
  await interval(RESEARCH_REFRESH_MS, 0);
});
test("fresh partial refresh cannot exceed the supported-fact budget while retaining cached evidence", async () => {
  const { preserveAvailableResearch } = await import("./reuse");
  const previous = await fixture();
  const current = await fixture();
  current.facts = Array.from({length:60}, () => structuredClone(current.facts[0]!));
  current.outcomes = [{url:GLEIF_POLICY.origin,policyId:GLEIF_POLICY.id,state:"source_unavailable"}];
  assert.equal(preserveAvailableResearch(current, previous, identity).facts.length, 60);
});
