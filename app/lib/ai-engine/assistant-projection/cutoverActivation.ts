import "server-only";

import { Pool, type PoolClient } from "@neondatabase/serverless";
import { cutoverEligibilityFailure } from "./cutover";
import { getPersistedAssistantProjectionForUpdate } from "./persistence";

type QueryClient = Pick<PoolClient, "query" | "release">;

export class AssistantProjectionCutoverActivationError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; this.name = "AssistantProjectionCutoverActivationError"; }
}

let pool: Pick<Pool, "connect"> | null = null;
const activationPool = () => (pool ??= new Pool({ connectionString: process.env.DATABASE_URL }));
/** Test seam only; activation remains an internal, offline operator boundary. */
export function setAssistantProjectionCutoverPoolForTests(nextPool: Pick<Pool, "connect"> | null): void { pool = nextPool; }

/**
 * Atomically authorizes canonical-only chat after an offline parity job has
 * proven MATCH for the exact persisted artifact. Setting legacy is the
 * emergency stop; it never restores a legacy runtime read path.
 */
export async function activateAssistantProjectionCanonicalRuntime(projectId: string): Promise<void> {
  const client = await activationPool().connect() as QueryClient;
  try {
    await client.query("BEGIN");
    const project = (await client.query("SELECT id FROM ai_builder_projects WHERE id=$1 FOR UPDATE", [projectId])).rows[0];
    if (!project) throw new AssistantProjectionCutoverActivationError("assistant_projection_project_not_found");
    const artifact = await getPersistedAssistantProjectionForUpdate(client, projectId);
    if (!artifact) throw new AssistantProjectionCutoverActivationError("assistant_projection_runtime_unavailable_missing");
    const report = (await client.query("SELECT status,assistant_projection_version,assistant_projection_schema_version,active_runtime_authority,compared_at,artifact_fingerprint FROM ai_builder_assistant_projection_parity_reports WHERE project_id=$1 FOR UPDATE", [projectId])).rows[0] as Record<string, unknown> | undefined;
    const failure = cutoverEligibilityFailure({
      // This is the proposed authority. The UPDATE below happens only after
      // all artifact/evidence checks in this same transaction succeed.
      runtimeAuthority: "canonical",
      artifact,
      evidence: report ? { status: report.status, projectionVersion: report.assistant_projection_version, schemaVersion: report.assistant_projection_schema_version, activeRuntimeAuthority: report.active_runtime_authority, comparedAt: report.compared_at, artifactFingerprint: report.artifact_fingerprint } : null,
    });
    if (failure) throw new AssistantProjectionCutoverActivationError(failure);
    await client.query("UPDATE ai_builder_projects SET runtime_authority='canonical',updated_at=NOW() WHERE id=$1", [projectId]);
    await client.query("COMMIT");
  } catch (cause) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw cause;
  } finally { client.release(); }
}
