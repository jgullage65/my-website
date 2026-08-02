import { neon } from "@neondatabase/serverless";
import { createHash } from "node:crypto";

type PublicRateLimitInput = {
  scope: string;
  subject: string;
  limit: number;
  windowMs: number;
  concurrency: number;
};

type PublicRateLimitLease = {
  allowed: boolean;
  release: () => Promise<void>;
};

/**
 * Uses the application's shared Neon infrastructure so limits remain effective
 * across server instances. The lease contains no business or account data.
 */
export async function enforcePublicRateLimit(input: PublicRateLimitInput): Promise<PublicRateLimitLease> {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    console.error("PUBLIC_RATE_LIMIT_UNAVAILABLE", { scope: input.scope });
    return { allowed: false, release: async () => undefined };
  }

  const sql = neon(connectionString);
  const leaseId = crypto.randomUUID();
  const windowSeconds = Math.max(1, Math.ceil(input.windowMs / 1000));
  const subjectHash = createHash("sha256").update(input.subject).digest("hex");

  // The advisory lock, usage decision, and insert share one statement and one
  // transaction, preventing concurrent instances from exceeding the lease cap.
  const decision = await sql`
    WITH lock_scope AS (
      SELECT pg_advisory_xact_lock(hashtext(${`${input.scope}:${subjectHash}`}))
    ), cleaned AS (
      DELETE FROM public_api_rate_limit_leases
      WHERE scope = ${input.scope}
        AND subject_hash = ${subjectHash}
        AND requested_at < NOW() - INTERVAL '1 day'
      RETURNING lease_id
    ), usage AS (
      SELECT
        COUNT(*) FILTER (WHERE requested_at >= NOW() - (${windowSeconds} || ' seconds')::interval) AS requests,
        COUNT(*) FILTER (WHERE released_at IS NULL AND requested_at >= NOW() - INTERVAL '2 minutes') AS active
      FROM public_api_rate_limit_leases, lock_scope
      WHERE scope = ${input.scope} AND subject_hash = ${subjectHash}
        AND (SELECT COUNT(*) FROM cleaned) >= 0
    ), inserted AS (
      INSERT INTO public_api_rate_limit_leases (scope, subject_hash, lease_id)
      SELECT ${input.scope}, ${subjectHash}, ${leaseId}::uuid
      FROM usage
      WHERE usage.requests < ${input.limit} AND usage.active < ${input.concurrency}
      RETURNING lease_id
    )
    SELECT EXISTS(SELECT 1 FROM inserted) AS allowed
  ` as Array<{ allowed: boolean }>;

  const allowed = Boolean(decision[0]?.allowed);
  return {
    allowed,
    release: allowed
      ? async () => {
          await sql`
            UPDATE public_api_rate_limit_leases
            SET released_at = NOW()
            WHERE scope = ${input.scope}
              AND subject_hash = ${subjectHash}
              AND lease_id = ${leaseId}::uuid
              AND released_at IS NULL
          `;
        }
      : async () => undefined,
  };
}
