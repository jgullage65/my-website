import "server-only";
import type { PoolClient } from "@neondatabase/serverless";
import { writeOperationalEvent } from "./operational-events";
type QueryClient = Pick<PoolClient, "query">;
export type DriftFinding = { code: string; expectedValue: string | null; observedValue: string | null; severity: "warning" | "error"; repairability: "repairable" | "blocked"; relatedJobId?: string };
/** Read-only comparison of existing durable artifacts; it never initiates repair. */
export async function inspectProjectDrift(client: QueryClient, projectId: string) {
 const [project, memory, projection, parity, jobs] = await Promise.all([
  client.query("SELECT trusted_knowledge_revision,business_memory_revision,runtime_authority,migration_state FROM ai_builder_projects WHERE id=$1",[projectId]),
  client.query("SELECT revision,trusted_knowledge_revision,state_fingerprint FROM ai_builder_business_memory WHERE project_id=$1",[projectId]),
  client.query("SELECT business_memory_fingerprint,projection_version,schema_version,invalidation_state FROM ai_builder_assistant_projections WHERE project_id=$1",[projectId]),
  client.query("SELECT artifact_fingerprint,status,active_runtime_authority FROM ai_builder_assistant_projection_parity_reports WHERE project_id=$1",[projectId]),
  client.query("SELECT id,status FROM ai_builder_downstream_synchronization_jobs WHERE project_id=$1 AND status IN ('pending','running','retry_scheduled','failed','dead_letter')",[projectId])
 ]); const p:any=project.rows[0], m:any=memory.rows[0], a:any=projection.rows[0], parityRow:any=parity.rows[0]; const findings: DriftFinding[]=[];
 if (!m) findings.push({code:"business_memory_missing",expectedValue:String(p?.trusted_knowledge_revision ?? ""),observedValue:null,severity:"error",repairability:"repairable"});
 else { if (Number(m.trusted_knowledge_revision)!==Number(p.trusted_knowledge_revision)) findings.push({code:"trusted_knowledge_revision_mismatch",expectedValue:String(p.trusted_knowledge_revision),observedValue:String(m.trusted_knowledge_revision),severity:"error",repairability:"repairable"}); if(Number(m.revision)!==Number(p.business_memory_revision)) findings.push({code:"business_memory_revision_mismatch",expectedValue:String(p.business_memory_revision),observedValue:String(m.revision),severity:"error",repairability:"repairable"}); }
 if (!a) findings.push({code:"assistant_projection_missing",expectedValue:m?.state_fingerprint ?? null,observedValue:null,severity:"error",repairability:"repairable"}); else { if (m && a.business_memory_fingerprint!==m.state_fingerprint) findings.push({code:"projection_fingerprint_mismatch",expectedValue:m.state_fingerprint,observedValue:a.business_memory_fingerprint,severity:"error",repairability:"repairable"}); if(a.invalidation_state!=="valid") findings.push({code:"projection_invalidated",expectedValue:"valid",observedValue:a.invalidation_state,severity:"warning",repairability:"repairable"}); }
 if (p?.runtime_authority==="canonical" && (!parityRow || parityRow.status!=="MATCH" || parityRow.artifact_fingerprint!==a?.business_memory_fingerprint)) findings.push({code:"runtime_parity_mismatch",expectedValue:"MATCH active artifact",observedValue:parityRow?.status ?? null,severity:"error",repairability:"blocked"});
 for(const job of jobs.rows as any[]) findings.push({code:"synchronization_job_"+job.status,expectedValue:"succeeded",observedValue:job.status,severity:"warning",repairability:"repairable",relatedJobId:job.id});
 const signature=JSON.stringify(findings.map(f=>f.code).sort()); if(findings.length) await writeOperationalEvent(client,{projectId,eventType:"drift_detected",category:"drift",severity:"warning",outcome:"detected",sourceComponent:"inspectProjectDrift",metadata:{findingCount:findings.length,signature}});
 return {healthy:findings.length===0,drifted:findings.length>0,blocked:findings.some(f=>f.repairability==="blocked"),migration_pending:Boolean(p && p.migration_state!=="canonical_runtime" && p.migration_state!=="legacy_retired"),findings};
}
