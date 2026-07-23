import "server-only";
import { Pool } from "@neondatabase/serverless";
import { executeDownstreamSynchronizationJob } from "./downstream-synchronization";
import { manuallyRetryDownstreamSynchronization } from "./recovery-service";
import { ensureAiBuilderSchema } from "@/app/lib/db/ai-builder-schema";
let pool:Pool|null=null;const db=()=>pool??=new Pool({connectionString:process.env.DATABASE_URL});
export type RepairAction="verify_and_resume"|"rebuild_business_memory_then_projection"|"rebuild_projection_only"|"reset_stale_running_claim";
/** Payload-free repair boundary: revisions and artifacts are always resolved from durable state. */
export async function repairDownstreamSynchronization(input:{projectId:string;jobId:string;commandId:string;clerkUserId:string;action:RepairAction;reason?:string}){
  await ensureAiBuilderSchema();
  if(input.action==="reset_stale_running_claim"){const c=await db().connect();try{await c.query("BEGIN");const j=(await c.query("SELECT j.* FROM ai_builder_downstream_synchronization_jobs j JOIN ai_builder_projects p ON p.id=j.project_id WHERE j.id=$1 AND j.project_id=$2 AND p.clerk_user_id=$3 AND p.archived_at IS NULL FOR UPDATE",[input.jobId,input.projectId,input.clerkUserId])).rows[0];if(!j||j.status!=="running"||!j.claim_expires_at||new Date(j.claim_expires_at)>new Date())throw new Error("downstream_synchronization_invalid_state");await c.query("UPDATE ai_builder_downstream_synchronization_jobs SET status='retry_scheduled',execution_token=NULL,claim_expires_at=NULL,next_attempt_at=NOW()+INTERVAL '1 minute',recovery_revision=recovery_revision+1,last_recovery_command_id=$2 WHERE id=$1",[input.jobId,input.commandId]);await c.query("COMMIT");return {jobId:input.jobId,status:"retry_scheduled"};}catch(e){await c.query("ROLLBACK").catch(()=>undefined);throw e;}finally{c.release();}}
  await manuallyRetryDownstreamSynchronization({...input,reason:input.reason});
  return executeDownstreamSynchronizationJob(input.jobId,{trigger:"deterministic_repair",actorType:"user",actorId:input.clerkUserId,commandId:input.commandId,forceBusiness:input.action==="rebuild_business_memory_then_projection",projectionOnly:input.action==="rebuild_projection_only"});
}
