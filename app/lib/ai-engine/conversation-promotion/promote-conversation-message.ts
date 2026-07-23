import "server-only";

import { createHash } from "node:crypto";
import type { PoolClient } from "@neondatabase/serverless";
import { candidateClaimIdentity, conversationEvidenceIdentity, conversationSnapshotPayload, sourceIdentity, sourceSnapshotIdentity } from "@/app/lib/db/canonical-provenance-identities";

export type ConversationPromotionRequest = { projectId:string; threadId:string; messageId:string; statement:string; claimType:string; category:string; title:string; confidence:string; confidenceScore:number; commandId:string };
export type ConversationPromotionResult = { sourceIdentity:string; snapshotIdentity:string; evidenceIdentity:string; candidateIdentity:string; reviewItemId:string };
export class ConversationPromotionError extends Error { readonly code:string; readonly status:number; constructor(code:string, status:number, message=code){super(message); this.code=code; this.status=status;} }
const clean=(value: unknown, max:number) => typeof value === "string" ? value.trim().slice(0,max) : "";
const digest=(value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function parseConversationPromotionRequest(raw: unknown): ConversationPromotionRequest {
 if(!raw||typeof raw!=="object"||Array.isArray(raw)) throw new ConversationPromotionError("invalid_promotion_request",400);
 const r=raw as Record<string,unknown>; const rawStatement=typeof r.statement === "string" ? r.statement.trim() : ""; const projectId=clean(r.projectId,200),threadId=clean(r.threadId,200),messageId=clean(r.messageId,200),statement=clean(r.statement,4000),claimType=clean(r.claimType,80),category=clean(r.category,120),title=clean(r.title,240),confidence=clean(r.confidence,30),commandId=clean(r.commandId,240),confidenceScore=Number(r.confidenceScore);
 if(!projectId||!threadId||!messageId||!statement||!claimType||!category||!title||!commandId||rawStatement.length>4000||!Number.isFinite(confidenceScore)) throw new ConversationPromotionError("invalid_promotion_request",400,"A complete bounded promotion request is required.");
 return {projectId,threadId,messageId,statement,claimType,category,title,confidence:confidence||"medium",confidenceScore,commandId};
}
/** Transaction-bound ingress: it creates only proposed records and never runs projections. */
export async function promoteConversationMessage(client: PoolClient, actorId:string, input: ConversationPromotionRequest): Promise<ConversationPromotionResult> {
 const requestFingerprint=digest(input);
 const project=(await client.query("SELECT id FROM ai_builder_projects WHERE id=$1 AND clerk_user_id=$2 AND archived_at IS NULL FOR UPDATE",[input.projectId,actorId])).rows[0];
 if(!project) throw new ConversationPromotionError("project_not_found_or_archived",404);
 const existing=(await client.query("SELECT request_fingerprint,result FROM ai_builder_conversation_promotion_command_ledger WHERE command_id=$1 FOR UPDATE",[input.commandId])).rows[0];
 if(existing){ if(existing.request_fingerprint!==requestFingerprint) throw new ConversationPromotionError("promotion_command_id_conflict",409); return existing.result as ConversationPromotionResult; }
 const message=(await client.query("SELECT m.id,m.role,m.content,m.created_at FROM ai_builder_chat_messages m JOIN ai_builder_chat_threads t ON t.id=m.thread_id WHERE m.id=$1 AND m.thread_id=$2 AND t.project_id=$3 FOR UPDATE",[input.messageId,input.threadId,input.projectId])).rows[0];
 if(!message) throw new ConversationPromotionError("chat_message_not_found",404);
 if(message.role!=="user") throw new ConversationPromotionError("chat_message_not_user_authored",409);
 const content=String(message.content); if(!content.includes(input.statement)) throw new ConversationPromotionError("promotion_statement_not_in_message",409);
 const capturedAt=new Date(message.created_at).toISOString(), promotedAt=new Date().toISOString();
 const sourceId=sourceIdentity(input.projectId,"conversation",input.threadId,input.messageId); const payload=conversationSnapshotPayload({projectId:input.projectId,threadId:input.threadId,messageId:input.messageId,role:"user",content}); const snapshotId=sourceSnapshotIdentity(input.projectId,"conversation",payload); const evidenceId=conversationEvidenceIdentity(snapshotId,input.statement); const candidateId=candidateClaimIdentity(snapshotId,input.claimType,`${input.threadId}:${input.messageId}`,input.statement);
 const provenance={projectId:input.projectId,threadId:input.threadId,messageId:input.messageId,messageRole:"user",selectedStatement:input.statement,promotingActor:actorId,promotionCommandId:input.commandId,promotionTimestamp:promotedAt};
 await client.query("INSERT INTO ai_builder_canonical_sources (project_id,kind,canonical_identity,metadata,created_at) VALUES ($1,'conversation',$2,$3::jsonb,$4::timestamptz) ON CONFLICT (canonical_identity) DO NOTHING",[input.projectId,sourceId,JSON.stringify({projectId:input.projectId,kind:"conversation",threadId:input.threadId,messageId:input.messageId}),capturedAt]);
 await client.query("INSERT INTO ai_builder_canonical_source_snapshots (source_id,snapshot_identity,snapshot_kind,payload,metadata,captured_at) VALUES ((SELECT id FROM ai_builder_canonical_sources WHERE canonical_identity=$1),$2,'conversation_message',$3::jsonb,$4::jsonb,$5::timestamptz) ON CONFLICT (snapshot_identity) DO NOTHING",[sourceId,snapshotId,JSON.stringify(payload),JSON.stringify(provenance),capturedAt]);
 await client.query("INSERT INTO ai_builder_canonical_evidence (source_id,source_snapshot_id,evidence_identity,content,metadata,captured_at) VALUES ((SELECT id FROM ai_builder_canonical_sources WHERE canonical_identity=$1),(SELECT id FROM ai_builder_canonical_source_snapshots WHERE snapshot_identity=$2),$3,$4,$5::jsonb,$6::timestamptz) ON CONFLICT (evidence_identity) DO NOTHING",[sourceId,snapshotId,evidenceId,input.statement,JSON.stringify(provenance),capturedAt]);
 await client.query("INSERT INTO ai_builder_canonical_candidate_claims (claim_identity,project_id,source_snapshot_id,claim_type,category,title,normalized_content,confidence,confidence_score,status,metadata,created_at,updated_at) VALUES ($1,$2,(SELECT id FROM ai_builder_canonical_source_snapshots WHERE snapshot_identity=$3),$4,$5,$6,$7,$8,$9,'proposed',$10::jsonb,$11::timestamptz,$11::timestamptz) ON CONFLICT (claim_identity) DO NOTHING",[candidateId,input.projectId,snapshotId,input.claimType,input.category,input.title,input.statement,input.confidence,input.confidenceScore,JSON.stringify(provenance),promotedAt]);
 await client.query("INSERT INTO ai_builder_canonical_candidate_claim_evidence (candidate_claim_id,evidence_id) VALUES ((SELECT id FROM ai_builder_canonical_candidate_claims WHERE claim_identity=$1),(SELECT id FROM ai_builder_canonical_evidence WHERE evidence_identity=$2)) ON CONFLICT DO NOTHING",[candidateId,evidenceId]);
 // This proposed compatibility item is the existing review screen's input; it is not Trusted Knowledge.
 const reviewItemId=`conversation_review_${digest({candidateId}).slice(0,32)}`;
 await client.query("INSERT INTO ai_builder_context_entries (id,project_id,category,title,content,confidence,confidence_score,status,source,metadata,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,'proposed',$8::jsonb,$9::jsonb,$10::timestamptz,$10::timestamptz) ON CONFLICT (id) DO NOTHING",[reviewItemId,input.projectId,input.category,input.title,input.statement,input.confidence,input.confidenceScore,JSON.stringify({sourceType:"user_edit",intakeBlockId:input.messageId,excerpt:input.statement,sourceUrl:null}),JSON.stringify({conversationCandidateIdentity:candidateId,...provenance}),promotedAt]);
 const result={sourceIdentity:sourceId,snapshotIdentity:snapshotId,evidenceIdentity:evidenceId,candidateIdentity:candidateId,reviewItemId};
 await client.query("INSERT INTO ai_builder_conversation_promotion_command_ledger (command_id,project_id,request_fingerprint,result,executed_at) VALUES ($1,$2,$3,$4::jsonb,$5::timestamptz)",[input.commandId,input.projectId,requestFingerprint,JSON.stringify(result),promotedAt]);
 return result;
}
