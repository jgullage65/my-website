import "server-only";

import { Pool } from "@neondatabase/serverless";
import { ensureAiBuilderSchema } from "@/app/lib/db/ai-builder-schema";
import { NeonBusinessMemoryReconciliationStore } from "../persistence/neon-reconciliation-store";
import { NeonBusinessMemoryReconciliationStateStore } from "../persistence/neon-reconciliation-state-store";
import { BusinessMemoryReconciliationService, type ReconciliationResult } from "../reconciliation/reconciliation-service";
import { RepairExecutor } from "../reconciliation/repair-executor";

let pool: Pool | null = null;
const transactionPool = () => (pool ??= new Pool({ connectionString: process.env.DATABASE_URL }));

/** Server-only production boundary.  Ownership is checked before any state is read. */
export async function reconcileBusinessMemory(input: { projectId: string; clerkUserId: string; expectedRevision?: number }): Promise<ReconciliationResult> {
  await ensureAiBuilderSchema();
  const client = await transactionPool().connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
    const owned = (await client.query("SELECT id FROM ai_builder_projects WHERE id=$1 AND clerk_user_id=$2 FOR UPDATE", [input.projectId, input.clerkUserId])).rows[0];
    if (!owned) throw new Error("business_memory_project_not_found_or_not_owned");
    const states = new NeonBusinessMemoryReconciliationStateStore(client);
    const service = new BusinessMemoryReconciliationService(new RepairExecutor(new NeonBusinessMemoryReconciliationStore(client, input.projectId)), states);
    const result = await service.reconcile({ projectId: input.projectId, expectedRevision: input.expectedRevision });
    await client.query("COMMIT");
    return result;
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
  finally { client.release(); }
}
