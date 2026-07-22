import { backfillCanonicalProvenanceDatabase } from "../app/lib/db/canonical-provenance-reconciliation";

const truthy = (value: string | undefined) => value === "1" || value === "true";

async function main() {
  const clerkUserId = process.env.CANONICAL_RECONCILIATION_CLERK_USER_ID?.trim();
  if (!clerkUserId) throw new Error("CANONICAL_RECONCILIATION_CLERK_USER_ID is required");
  const batchSize = Number(process.env.CANONICAL_RECONCILIATION_BATCH_SIZE ?? "50");
  const cursor = process.env.CANONICAL_RECONCILIATION_CURSOR?.trim() || null;
  const dryRun = truthy(process.env.CANONICAL_RECONCILIATION_DRY_RUN);
  const repair = truthy(process.env.CANONICAL_RECONCILIATION_REPAIR);
  if (dryRun && repair) throw new Error("dry-run and repair cannot be enabled together");

  const result = await backfillCanonicalProvenanceDatabase(clerkUserId, { dryRun, repair, batchSize, cursor });
  for (const item of result.reports) console.log(JSON.stringify(item));
  console.log(JSON.stringify({ nextCursor: result.nextCursor, dryRun, repair, batchSize }));
  if (result.reports.some((item) => "error" in item || ("report" in item && (item.report.integrityFailures.length || item.report.repairFailures.length)))) process.exitCode = 1;
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
