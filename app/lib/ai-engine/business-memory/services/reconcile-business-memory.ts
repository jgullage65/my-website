import "server-only";

import { Pool } from "@neondatabase/serverless";
import { ensureAiBuilderSchema } from "@/app/lib/db/ai-builder-schema";
import { NeonBusinessMemoryReconciliationStore } from "../persistence/neon-reconciliation-store";
import { NeonBusinessMemoryReconciliationStateStore } from "../persistence/neon-reconciliation-state-store";
import { BusinessMemoryReconciliationService, type ReconciliationResult } from "../reconciliation/reconciliation-service";
import { RepairExecutor } from "../reconciliation/repair-executor";
import { safeOperationalError, writeOperationalEvent, writeOperationalFailureAfterRollback } from "../../operations/operational-events";

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
    await writeOperationalEvent(client,{projectId:input.projectId,eventType:"reconciliation_started",category:"reconciliation",severity:"info",outcome:"started",sourceComponent:"reconcileBusinessMemory",metadata:{expectedRevision:input.expectedRevision ?? null}});
    const states = new NeonBusinessMemoryReconciliationStateStore(client);
    const service = new BusinessMemoryReconciliationService(new RepairExecutor(new NeonBusinessMemoryReconciliationStore(client, input.projectId)), states);
    const result = await service.reconcile({ projectId: input.projectId, expectedRevision: input.expectedRevision });
    const categories=Object.fromEntries(Object.entries(result.driftItems?.reduce<Record<string,number>>((out,item)=>(out[item.category]=(out[item.category]??0)+1,out),{})??{}).slice(0,20));
    await writeOperationalEvent(client,{projectId:input.projectId,eventType:result.disposition==="no_op"?"reconciliation_no_op":result.disposition==="repaired"?"reconciliation_repaired":"reconciliation_blocked",category:"reconciliation",severity:result.disposition==="blocked"?"warning":"info",outcome:result.disposition==="repaired"?"succeeded":result.disposition,sourceComponent:"reconcileBusinessMemory",trustedKnowledgeRevision:result.trustedKnowledgeRevision,businessMemoryRevision:result.resultingRevision,metadata:{driftDetected:result.driftDetected,driftRepaired:result.driftRepaired,unresolvedDrift:result.unresolvedDrift,categories,changedCounts:{entities:result.changedEntityIds.length,assertions:result.changedAssertionIds.length,relationships:result.changedRelationshipIds.length,conflicts:result.changedConflictIds.length,aliases:result.changedAliasIds.length,identityKeys:result.changedIdentityKeyIds.length,sources:result.changedSourceIds.length,evidence:result.changedEvidenceIds.length}}});
    if(result.driftDetected) { const driftMetadata={findingCount:result.driftDetected,unresolvedCount:result.unresolvedDrift,categories,signature:result.materialStateFingerprint}; await writeOperationalEvent(client,{projectId:input.projectId,eventType:"drift_detected",category:"drift",severity:"warning",outcome:"detected",sourceComponent:"reconcileBusinessMemory",trustedKnowledgeRevision:result.trustedKnowledgeRevision,businessMemoryRevision:result.resultingRevision,metadata:driftMetadata}); await writeOperationalEvent(client,{projectId:input.projectId,eventType:result.unresolvedDrift?"drift_unresolved":"drift_resolved",category:"drift",severity:result.unresolvedDrift?"warning":"info",outcome:result.unresolvedDrift?"detected":"resolved",sourceComponent:"reconcileBusinessMemory",trustedKnowledgeRevision:result.trustedKnowledgeRevision,businessMemoryRevision:result.resultingRevision,metadata:driftMetadata}); }
    await client.query("COMMIT");
    return result;
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); const safe=safeOperationalError(error); await writeOperationalFailureAfterRollback({projectId:input.projectId,eventType:"reconciliation_failed",category:"reconciliation",severity:"error",outcome:"failed",sourceComponent:"reconcileBusinessMemory",businessMemoryRevision:input.expectedRevision,errorCode:safe.errorCode,errorMessage:safe.errorMessage},error); throw error; }
  finally { client.release(); }
}
