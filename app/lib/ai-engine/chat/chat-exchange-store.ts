import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "@neondatabase/serverless";
import type { ChatResponse } from "@/app/lib/ai-engine/chat";
import { normalizeConversationMemory, updateConversationSummary, updateStructuredConversationMemory, type MemoryMessage } from "@/app/lib/ai-engine/memory/conversationMemory";

export const PROJECT_USER_MESSAGE_LIMIT = 20;
const LEASE_SECONDS = 60;
let pool: Pool | null = null;
const database = () => pool ??= new Pool({ connectionString: process.env.DATABASE_URL });
export function setChatExchangePoolForTests(next: Pool | null) { pool = next; }

export type PersistedExchange = { userMessageId:string; assistantMessageId:string; memoryRevision:number|null; userMessageCount:number; response:ChatResponse };
export type ExchangeReservation =
  | { kind:"owner"; ownerToken:string; memory:unknown }
  | { kind:"completed"; result:PersistedExchange }
  | { kind:"wait" };

export class ChatExchangeError extends Error {
  constructor(public readonly code:string, public readonly status:number, public readonly userMessageCount?:number, public readonly remaining?:number) { super(code); }
}

export function chatRequestFingerprint(message:string):string {
  return createHash("sha256").update(message).digest("hex");
}

function replay(row:Record<string,unknown>):PersistedExchange {
  const metadata=(row.metadata??{}) as Record<string,unknown>;
  return { userMessageId:String(row.user_message_id), assistantMessageId:String(row.assistant_message_id), memoryRevision:row.memory_revision==null?null:Number(row.memory_revision), userMessageCount:Number(row.user_message_count), response:{ answer:String(row.content), citations:Array.isArray(metadata.citations)?metadata.citations.filter((x):x is string=>typeof x==="string"):[], diagnostics:metadata.diagnostics as ChatResponse["diagnostics"] } };
}

async function projectUsage(client:PoolClient, projectId:string) {
  const row=(await client.query(`SELECT COUNT(*) FILTER (WHERE m.role='user')::integer AS completed, (SELECT COUNT(*)::integer FROM ai_builder_chat_exchanges e WHERE e.project_id=$1 AND e.status='pending' AND e.pending_expires_at>NOW()) AS pending FROM ai_builder_chat_threads t LEFT JOIN ai_builder_chat_messages m ON m.thread_id=t.id WHERE t.project_id=$1`,[projectId])).rows[0];
  return { completed:Number(row.completed??0), pending:Number(row.pending??0) };
}

export async function reserveChatExchange(input:{projectId:string;threadId:string;clerkUserId:string;idempotencyKey:string;requestFingerprint:string}):Promise<ExchangeReservation> {
  const client=await database().connect();
  try {
    await client.query("BEGIN");
    const project=(await client.query("SELECT id FROM ai_builder_projects WHERE id=$1 AND clerk_user_id=$2 AND archived_at IS NULL FOR UPDATE",[input.projectId,input.clerkUserId])).rows[0];
    if(!project) throw new ChatExchangeError("chat_thread_not_found",404);
    const thread=(await client.query("SELECT memory FROM ai_builder_chat_threads WHERE id=$1 AND project_id=$2",[input.threadId,input.projectId])).rows[0];
    if(!thread) throw new ChatExchangeError("chat_thread_not_found",404);
    const existing=(await client.query(`SELECT e.*,m.content,m.metadata FROM ai_builder_chat_exchanges e LEFT JOIN ai_builder_chat_messages m ON m.id=e.assistant_message_id WHERE e.project_id=$1 AND e.thread_id=$2 AND e.idempotency_key=$3 FOR UPDATE OF e`,[input.projectId,input.threadId,input.idempotencyKey])).rows[0] as Record<string,unknown>|undefined;
    if(existing && existing.request_fingerprint!==input.requestFingerprint) throw new ChatExchangeError("chat_idempotency_conflict",409);
    if(existing?.status==="completed") { await client.query("COMMIT"); return {kind:"completed",result:replay(existing)}; }
    if(existing?.status==="pending" && new Date(String(existing.pending_expires_at)).getTime()>Date.now()) { await client.query("COMMIT"); return {kind:"wait"}; }
    const usage=await projectUsage(client,input.projectId);
    if(usage.completed>=PROJECT_USER_MESSAGE_LIMIT) throw new ChatExchangeError("project_message_limit_reached",429,usage.completed,0);
    if(usage.completed+usage.pending>=PROJECT_USER_MESSAGE_LIMIT) { await client.query("COMMIT"); return {kind:"wait"}; }
    const ownerToken=randomUUID();
    if(existing) await client.query(`UPDATE ai_builder_chat_exchanges SET status='pending',owner_token=$4,pending_expires_at=NOW()+($5||' seconds')::interval,failed_at=NULL,failure_code=NULL,user_message_id=NULL,assistant_message_id=NULL,user_message_count=NULL,memory_revision=NULL WHERE project_id=$1 AND thread_id=$2 AND idempotency_key=$3`,[input.projectId,input.threadId,input.idempotencyKey,ownerToken,LEASE_SECONDS]);
    else await client.query(`INSERT INTO ai_builder_chat_exchanges (project_id,thread_id,idempotency_key,request_fingerprint,status,owner_token,pending_expires_at) VALUES ($1,$2,$3,$4,'pending',$5,NOW()+($6||' seconds')::interval)`,[input.projectId,input.threadId,input.idempotencyKey,input.requestFingerprint,ownerToken,LEASE_SECONDS]);
    await client.query("COMMIT"); return {kind:"owner",ownerToken,memory:thread.memory};
  } catch(error) { await client.query("ROLLBACK").catch(()=>undefined); throw error; }
  finally { client.release(); }
}

export async function failChatExchange(input:{projectId:string;threadId:string;idempotencyKey:string;ownerToken:string;failureCode:string}) {
  await database().query(`UPDATE ai_builder_chat_exchanges SET status='failed',failed_at=NOW(),failure_code=$5,owner_token=NULL,pending_expires_at=NULL WHERE project_id=$1 AND thread_id=$2 AND idempotency_key=$3 AND owner_token=$4 AND status='pending'`,[input.projectId,input.threadId,input.idempotencyKey,input.ownerToken,input.failureCode.slice(0,120)]);
}

export async function completeChatExchange(input:{projectId:string;threadId:string;clerkUserId:string;idempotencyKey:string;requestFingerprint:string;ownerToken:string;userMessage:string;response:ChatResponse}):Promise<PersistedExchange> {
  const client=await database().connect(); const userCreatedAt=new Date(),assistantCreatedAt=new Date(userCreatedAt.getTime()+1); const userMessageId=`user_${randomUUID()}`,assistantMessageId=`assistant_${randomUUID()}`;
  try {
    await client.query("BEGIN");
    const project=(await client.query("SELECT id FROM ai_builder_projects WHERE id=$1 AND clerk_user_id=$2 AND archived_at IS NULL FOR UPDATE",[input.projectId,input.clerkUserId])).rows[0];
    if(!project) throw new ChatExchangeError("chat_thread_not_found",404);
    const thread=(await client.query("SELECT memory FROM ai_builder_chat_threads WHERE id=$1 AND project_id=$2 FOR UPDATE",[input.threadId,input.projectId])).rows[0];
    if(!thread) throw new ChatExchangeError("chat_thread_not_found",404);
    const exchange=(await client.query("SELECT status,owner_token,request_fingerprint FROM ai_builder_chat_exchanges WHERE project_id=$1 AND thread_id=$2 AND idempotency_key=$3 FOR UPDATE",[input.projectId,input.threadId,input.idempotencyKey])).rows[0];
    if(!exchange||exchange.request_fingerprint!==input.requestFingerprint||exchange.status!=="pending"||exchange.owner_token!==input.ownerToken) throw new ChatExchangeError("chat_exchange_ownership_lost",409);
    const usage=await projectUsage(client,input.projectId); if(usage.completed>=PROJECT_USER_MESSAGE_LIMIT) throw new ChatExchangeError("project_message_limit_reached",429,usage.completed,0);
    const nextSequence=Number((await client.query("SELECT COALESCE(MAX(sequence),0)+1 AS sequence FROM ai_builder_chat_messages WHERE thread_id=$1",[input.threadId])).rows[0].sequence),userMessageCount=usage.completed+1;
    await client.query(`INSERT INTO ai_builder_chat_messages (id,thread_id,role,content,metadata,sequence,created_at) VALUES ($1,$2,'user',$3,$4::jsonb,$5,$6)`,[userMessageId,input.threadId,input.userMessage,JSON.stringify({projectId:input.projectId}),nextSequence,userCreatedAt]);
    await client.query(`INSERT INTO ai_builder_chat_messages (id,thread_id,role,content,metadata,sequence,created_at) VALUES ($1,$2,'assistant',$3,$4::jsonb,$5,$6)`,[assistantMessageId,input.threadId,input.response.answer,JSON.stringify({projectId:input.projectId,citations:input.response.citations,diagnostics:input.response.diagnostics}),nextSequence+1,assistantCreatedAt]);
    const normalized=normalizeConversationMemory(thread.memory,{threadId:input.threadId,projectId:input.projectId},assistantCreatedAt.toISOString()); if(normalized.invalid) throw new Error("invalid_canonical_memory");
    const rows=(await client.query("SELECT id,role,content,created_at FROM ai_builder_chat_messages WHERE thread_id=$1 ORDER BY sequence DESC LIMIT 14",[input.threadId])).rows as Array<{id:string;role:string;content:string;created_at:string}>;
    const messages:MemoryMessage[]=rows.reverse().map(m=>({id:m.id,role:m.role,content:m.content,createdAt:new Date(m.created_at).toISOString()})); const structured=updateStructuredConversationMemory(normalized.memory,messages,assistantCreatedAt.toISOString()); const updated=updateConversationSummary(structured,messages,assistantCreatedAt.toISOString()); const nextMemory={...updated,revision:normalized.memory.revision+1,updatedAt:assistantCreatedAt.toISOString()}; const {customerGoal:_,collectedDetails:__,unresolvedQuestions:___,...persistedMemory}=nextMemory;
    await client.query("UPDATE ai_builder_chat_threads SET memory=$1::jsonb,updated_at=$2 WHERE id=$3 AND project_id=$4",[JSON.stringify(persistedMemory),assistantCreatedAt,input.threadId,input.projectId]);
    await client.query(`UPDATE ai_builder_chat_exchanges SET status='completed',user_message_id=$4,assistant_message_id=$5,user_message_count=$6,memory_revision=$7,completed_at=NOW(),owner_token=NULL,pending_expires_at=NULL WHERE project_id=$1 AND thread_id=$2 AND idempotency_key=$3`,[input.projectId,input.threadId,input.idempotencyKey,userMessageId,assistantMessageId,userMessageCount,nextMemory.revision]);
    await client.query("COMMIT"); return {userMessageId,assistantMessageId,memoryRevision:nextMemory.revision,userMessageCount,response:input.response};
  } catch(error) { await client.query("ROLLBACK").catch(()=>undefined); throw error; }
  finally { client.release(); }
}
