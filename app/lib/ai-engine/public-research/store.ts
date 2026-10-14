import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { getSql } from "../../db/client";
import { persistWebsiteSourceRecords } from "../crawler/websiteSourceRecordStore";
import { type BusinessIdentity, type ResearchSnapshot } from "./contracts";
import { researchPublicBusiness } from "./engine";
import { ResearchFetcher, type Slot } from "./transport";
import { snapshotFingerprint } from "./reconciliation";

let schema: Promise<void> | undefined;
async function ensureSchema() {
  if (!schema)
    schema = (async () => {
      const sql = getSql();
      await sql`CREATE TABLE IF NOT EXISTS ai_builder_public_research_state (
      subject_key text PRIMARY KEY, lease_owner text, lease_until timestamptz, next_attempt_at timestamptz,
      snapshot jsonb, updated_at timestamptz NOT NULL DEFAULT now())`;
      await sql`CREATE TABLE IF NOT EXISTS ai_builder_public_research_history (
      attempt_id text PRIMARY KEY, subject_key text NOT NULL, fingerprint text NOT NULL,
      snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`;
      await sql`CREATE INDEX IF NOT EXISTS ai_builder_public_research_history_subject ON ai_builder_public_research_history(subject_key,created_at DESC)`;
      await sql`CREATE TABLE IF NOT EXISTS ai_builder_public_research_host_slots (host text PRIMARY KEY, next_slot timestamptz NOT NULL)`;
      await sql`ALTER TABLE ai_builder_public_research_host_slots ADD COLUMN IF NOT EXISTS lease_owner text, ADD COLUMN IF NOT EXISTS lease_until timestamptz`;
    })().catch((error) => {
      schema = undefined;
      throw error;
    });
  await schema;
}
// Rate interval and in-flight concurrency are separate. A crashed worker's lease expires after the 5s request deadline.
const distributedSlot: Slot = async (host, interval) => {
  const owner = randomUUID(), sql = getSql();
  const rows = await sql`INSERT INTO ai_builder_public_research_host_slots(host,next_slot,lease_owner,lease_until)
    VALUES(${host},now()+(${interval}*interval '1 millisecond'),${owner},now()+interval '6 seconds')
    ON CONFLICT(host) DO UPDATE SET next_slot=excluded.next_slot,lease_owner=excluded.lease_owner,lease_until=excluded.lease_until
    WHERE ai_builder_public_research_host_slots.next_slot<=now()
      AND coalesce(ai_builder_public_research_host_slots.lease_until,'epoch')<=now() RETURNING host`;
  if (!Array.isArray(rows) || rows.length !== 1) return false;
  return { release: async () => {
    await sql`UPDATE ai_builder_public_research_host_slots SET lease_owner=null,lease_until=null WHERE host=${host} AND lease_owner=${owner}`;
  } };
};
export async function runStoredPublicResearch(
  identity: BusinessIdentity,
  signal?: AbortSignal,
): Promise<ResearchSnapshot | null> {
  await ensureSchema();
  const secret =
    process.env.PUBLIC_RESEARCH_IDENTITY_HASH_SECRET ??
    process.env.LEADFORGE_RESEARCH_API_SECRET;
  if (!secret) throw new Error("research_identity_hash_secret_missing");
  // No Discovery/Google input values or Place payloads are stored. The matching key is a keyed digest only.
  const subjectKey = createHmac("sha256", secret)
      .update(JSON.stringify(identity))
      .digest("hex"),
    owner = randomUUID(),
    sql = getSql();
  const claimed =
    await sql`INSERT INTO ai_builder_public_research_state(subject_key,lease_owner,lease_until)
    VALUES(${subjectKey},${owner},now()+interval '45 seconds')
    ON CONFLICT(subject_key) DO UPDATE SET lease_owner=excluded.lease_owner,lease_until=excluded.lease_until
    WHERE coalesce(ai_builder_public_research_state.lease_until,'epoch')<now()
      AND coalesce(ai_builder_public_research_state.next_attempt_at,'epoch')<=now() RETURNING snapshot`;
  if (!Array.isArray(claimed) || !claimed.length) {
    const existing =
      await sql`SELECT snapshot FROM ai_builder_public_research_state WHERE subject_key=${subjectKey}`;
    return (
      ((Array.isArray(existing)
        ? (existing[0] as Record<string, unknown>)?.snapshot
        : null) as ResearchSnapshot) ?? null
    );
  }
  const previous =
    ((claimed[0] as Record<string, unknown>)?.snapshot as ResearchSnapshot) ??
    null;
  try {
    const current = await researchPublicBusiness(identity, {
      signal,
      previous,
      fetcher: new ResearchFetcher(signal, undefined, distributedSlot),
    });
    const value = JSON.stringify(current);
    if (Buffer.byteLength(value, "utf8") > 1_000_000) throw new Error("research_snapshot_storage_budget_exhausted");
    // Only new immutable records belong to the new attempt; 304 and stale evidence keep their original IDs.
    await persistWebsiteSourceRecords(
      current.attempt,
      current.documents.filter((d) => d.crawlAttemptId === current.attempt.id),
      current.blocks.filter((b) => b.crawlAttemptId === current.attempt.id),
    );
    const fingerprint = snapshotFingerprint(current);
    // Lease comparison fences late workers from overwriting newer research.
    const updated =
      await sql`UPDATE ai_builder_public_research_state SET snapshot=${value}::jsonb,
      lease_owner=null,lease_until=null,next_attempt_at=now()+interval '6 hours',updated_at=now()
      WHERE subject_key=${subjectKey} AND lease_owner=${owner} AND lease_until>now() RETURNING subject_key`;
    if (!Array.isArray(updated) || !updated.length) return null;
    await sql`INSERT INTO ai_builder_public_research_history(attempt_id,subject_key,fingerprint,snapshot)
      VALUES(${current.attempt.id},${subjectKey},${fingerprint},${value}::jsonb) ON CONFLICT(attempt_id) DO NOTHING`;
    // Bound redundant snapshot copies. Immutable evidence is retained under the existing source-record lifecycle.
    await sql`DELETE FROM ai_builder_public_research_history WHERE subject_key=${subjectKey} AND attempt_id IN (
      SELECT attempt_id FROM ai_builder_public_research_history WHERE subject_key=${subjectKey} ORDER BY created_at DESC,attempt_id DESC OFFSET 32)`;
    return current;
  } catch (error) {
    await sql`UPDATE ai_builder_public_research_state SET lease_owner=null,lease_until=null,next_attempt_at=now()+interval '6 hours'
      WHERE subject_key=${subjectKey} AND lease_owner=${owner}`.catch(
      () => undefined,
    );
    throw error;
  }
}
