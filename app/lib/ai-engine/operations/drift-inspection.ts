import "server-only";
import { createHash } from "node:crypto";
import type { PoolClient } from "@neondatabase/serverless";
import { ASSISTANT_PROJECTION_SCHEMA_VERSION, ASSISTANT_PROJECTION_VERSION } from "../assistant-projection/contracts";
import { buildAssistantProjection } from "../assistant-projection/buildAssistantProjection";
import { loadPersistedBusinessMemory } from "../assistant-projection/persistence";
import { writeOperationalEvent } from "./operational-events";
type QueryClient = Pick<PoolClient, "query">;
export type DriftFinding = { code: string; expectedValue: string | null; observedValue: string | null; severity: "warning" | "error"; repairability: "repairable" | "blocked"; relatedJobId?: string };
const signatureFor=(findings:DriftFinding[])=>createHash("sha256").update(JSON.stringify(findings.map(({code,expectedValue,observedValue})=>({code,expectedValue,observedValue})).sort((a,b)=>a.code.localeCompare(b.code)||String(a.observedValue).localeCompare(String(b.observedValue))))).digest("hex");

/** Read-only comparison of durable artifacts. Telemetry records only bounded summaries. */
export async function inspectProjectDrift(client: QueryClient, projectId: string) {
 const [project, memory, projection, parity, jobs, prior, loadedMemory] = await Promise.all([
  client.query("SELECT trusted_knowledge_revision,business_memory_revision,runtime_authority,migration_state FROM ai_builder_projects WHERE id=$1",[projectId]),
  client.query("SELECT revision,trusted_knowledge_revision,state_fingerprint FROM ai_builder_business_memory WHERE project_id=$1",[projectId]),
  client.query("SELECT business_memory_fingerprint,projection_version,schema_version,invalidation_state FROM ai_builder_assistant_projections WHERE project_id=$1",[projectId]),
  client.query("SELECT artifact_fingerprint,status,active_runtime_authority FROM ai_builder_assistant_projection_parity_reports WHERE project_id=$1",[projectId]),
  client.query("SELECT status,count(*)::int AS count FROM ai_builder_downstream_synchronization_jobs WHERE project_id=$1 AND status IN ('pending','running','retry_scheduled','failed','dead_letter') GROUP BY status",[projectId]),
  client.query("SELECT event_type,metadata FROM ai_builder_operational_events WHERE project_id=$1 AND event_type IN ('drift_unresolved','drift_resolved') ORDER BY occurred_at DESC,id DESC LIMIT 1",[projectId]),
  loadPersistedBusinessMemory(client,projectId),
 ]); const p:any=project.rows[0], m:any=memory.rows[0], a:any=projection.rows[0], parityRow:any=parity.rows[0]; const findings: DriftFinding[]=[];
 if (!m) findings.push({code:"business_memory_missing",expectedValue:String(p?.trusted_knowledge_revision ?? ""),observedValue:null,severity:"error",repairability:"repairable"});
 else { if (Number(m.trusted_knowledge_revision)!==Number(p?.trusted_knowledge_revision)) findings.push({code:"trusted_knowledge_revision_mismatch",expectedValue:String(p?.trusted_knowledge_revision),observedValue:String(m.trusted_knowledge_revision),severity:"error",repairability:"repairable"}); if(Number(m.revision)!==Number(p?.business_memory_revision)) findings.push({code:"business_memory_revision_mismatch",expectedValue:String(p?.business_memory_revision),observedValue:String(m.revision),severity:"error",repairability:"repairable"}); }
 const computedFingerprint=loadedMemory?buildAssistantProjection(loadedMemory).businessMemoryFingerprint:null;
 if (!a) findings.push({code:"assistant_projection_missing",expectedValue:computedFingerprint,observedValue:null,severity:"error",repairability:"repairable"}); else {
  if (a.business_memory_fingerprint!==computedFingerprint) findings.push({code:"projection_fingerprint_mismatch",expectedValue:computedFingerprint,observedValue:a.business_memory_fingerprint,severity:"error",repairability:"repairable"});
  if(Number(a.projection_version)!==ASSISTANT_PROJECTION_VERSION) findings.push({code:"projection_version_mismatch",expectedValue:String(ASSISTANT_PROJECTION_VERSION),observedValue:String(a.projection_version),severity:"error",repairability:"repairable"});
  if(Number(a.schema_version)!==ASSISTANT_PROJECTION_SCHEMA_VERSION) findings.push({code:"schema_version_mismatch",expectedValue:String(ASSISTANT_PROJECTION_SCHEMA_VERSION),observedValue:String(a.schema_version),severity:"error",repairability:"repairable"});
  if(a.invalidation_state!=="valid") findings.push({code:"projection_invalidated",expectedValue:"valid",observedValue:a.invalidation_state,severity:"warning",repairability:"repairable"});
 }
 const migrationReady=["business_memory_backfilled","canonical_runtime","legacy_retired"].includes(p?.migration_state);
 const migrationPending=!migrationReady||(p?.runtime_authority!=="canonical"&&!parityRow);
 if(migrationPending) findings.push({code:"migration_not_ready",expectedValue:"canonical readiness evidence",observedValue:!parityRow?"parity_pending":p?.migration_state??null,severity:"warning",repairability:"repairable"});
 if(parityRow&&parityRow.active_runtime_authority!==p?.runtime_authority) findings.push({code:"parity_authority_mismatch",expectedValue:p?.runtime_authority??null,observedValue:parityRow.active_runtime_authority??null,severity:"error",repairability:"blocked"});
 if (p?.runtime_authority==="canonical"&&(!parityRow || parityRow.status!=="MATCH" || parityRow.artifact_fingerprint!==a?.business_memory_fingerprint)) findings.push({code:"runtime_parity_mismatch",expectedValue:"MATCH active artifact",observedValue:parityRow?.status??null,severity:"error",repairability:"blocked"});
 for(const job of jobs.rows as any[]) findings.push({code:"synchronization_job_"+job.status,expectedValue:"0",observedValue:String(job.count),severity:"warning",repairability:"repairable"});
 const signature=signatureFor(findings), previous=prior.rows[0], previousSignature=previous?.event_type==="drift_unresolved"?previous.metadata?.signature:null;
 if(previousSignature&&!findings.length) await writeOperationalEvent(client,{projectId,eventType:"drift_resolved",category:"drift",severity:"info",outcome:"resolved",sourceComponent:"inspectProjectDrift",metadata:{signature:previousSignature}});
 if(findings.length&&previousSignature!==signature) { const summary=Object.fromEntries(findings.reduce<Map<string,number>>((out,f)=>out.set(f.code,(out.get(f.code)??0)+1),new Map())); await writeOperationalEvent(client,{projectId,eventType:"drift_detected",category:"drift",severity:"warning",outcome:"detected",sourceComponent:"inspectProjectDrift",metadata:{findingCount:findings.length,signature,summary}}); await writeOperationalEvent(client,{projectId,eventType:"drift_unresolved",category:"drift",severity:"warning",outcome:"detected",sourceComponent:"inspectProjectDrift",metadata:{findingCount:findings.length,signature,summary}}); }
 return {healthy:findings.length===0,drifted:findings.length>0,blocked:findings.some(f=>f.repairability==="blocked"),migration_pending:migrationPending,findings};
}
