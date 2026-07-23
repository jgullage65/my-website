import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "@neondatabase/serverless";

const url=process.env.DATABASE_URL; const db=url?test:test.skip;
const answer={answer:"original answer",citations:[],diagnostics:{retrievedFacts:0,retrievedFaq:0,retrievalMs:0,runtimeSource:"assistant_projection"}} as any;

async function fixture() {
  process.env.DATABASE_URL=url;
  const {ensureAiBuilderSchema}=await import("./ai-builder-schema"); await ensureAiBuilderSchema();
  const pool=new Pool({connectionString:url}); const projectId=`chat-store-${randomUUID()}`,owner=`owner-${randomUUID()}`,threadA=`thread-${randomUUID()}`,threadB=`thread-${randomUUID()}`;
  await pool.query("INSERT INTO ai_builder_projects(id,status,business_name,industry,assistant_configuration,context_counts,clerk_user_id,created_at,updated_at) VALUES($1,'ready','Test','test','{}','{}',$2,NOW(),NOW())",[projectId,owner]);
  const {createConversationMemory}=await import("../ai-engine/memory/conversationMemory");
  await pool.query("INSERT INTO ai_builder_chat_threads(id,project_id,title,memory) VALUES($1,$3,'A',$4),($2,$3,'B',$5)",[threadA,threadB,projectId,JSON.stringify(createConversationMemory(threadA,projectId)),JSON.stringify(createConversationMemory(threadB,projectId))]);
  return {pool,projectId,owner,threadA,threadB,cleanup:async()=>{await pool.query("DELETE FROM ai_builder_projects WHERE id=$1",[projectId]);await pool.end();}};
}

db("duplicate reservation executes one logical model owner, replays completion, conflicts on different content, and recovers failure",async()=>{
  const s=await fixture(); const store=await import("../ai-engine/chat/chat-exchange-store"); const key=randomUUID(),fingerprint=store.chatRequestFingerprint("same");
  try {
    const [a,b]=await Promise.all([store.reserveChatExchange({projectId:s.projectId,threadId:s.threadA,clerkUserId:s.owner,idempotencyKey:key,requestFingerprint:fingerprint}),store.reserveChatExchange({projectId:s.projectId,threadId:s.threadA,clerkUserId:s.owner,idempotencyKey:key,requestFingerprint:fingerprint})]);
    assert.deepEqual([a.kind,b.kind].sort(),["owner","wait"]); const owned=(a.kind==="owner"?a:b) as Extract<typeof a,{kind:"owner"}>;
    const completed=await store.completeChatExchange({projectId:s.projectId,threadId:s.threadA,clerkUserId:s.owner,idempotencyKey:key,requestFingerprint:fingerprint,ownerToken:owned.ownerToken,userMessage:"same",response:answer});
    const replay=await store.reserveChatExchange({projectId:s.projectId,threadId:s.threadA,clerkUserId:s.owner,idempotencyKey:key,requestFingerprint:fingerprint}); assert.equal(replay.kind,"completed"); if(replay.kind==="completed") assert.deepEqual(replay.result,completed);
    await assert.rejects(()=>store.reserveChatExchange({projectId:s.projectId,threadId:s.threadA,clerkUserId:s.owner,idempotencyKey:key,requestFingerprint:store.chatRequestFingerprint("different")}), (e:any)=>e.code==="chat_idempotency_conflict"&&e.status===409);
    const retryKey=randomUUID(),retryFingerprint=store.chatRequestFingerprint("recover"); const first=await store.reserveChatExchange({projectId:s.projectId,threadId:s.threadA,clerkUserId:s.owner,idempotencyKey:retryKey,requestFingerprint:retryFingerprint}); assert.equal(first.kind,"owner"); if(first.kind==="owner") await store.failChatExchange({projectId:s.projectId,threadId:s.threadA,idempotencyKey:retryKey,ownerToken:first.ownerToken,failureCode:"provider_failed"});
    const recovered=await store.reserveChatExchange({projectId:s.projectId,threadId:s.threadA,clerkUserId:s.owner,idempotencyKey:retryKey,requestFingerprint:retryFingerprint}); assert.equal(recovered.kind,"owner");
  } finally {await s.cleanup();}
});

db("project-wide reservations serialize different threads at the final allowance",async()=>{
  const s=await fixture(); const store=await import("../ai-engine/chat/chat-exchange-store");
  try {
    for(let i=1;i<=19;i++) await s.pool.query("INSERT INTO ai_builder_chat_messages(id,thread_id,role,content,sequence) VALUES($1,$2,'user','used',$3)",[randomUUID(),i%2?s.threadA:s.threadB,i%2?i:i]);
    const one={projectId:s.projectId,threadId:s.threadA,clerkUserId:s.owner,idempotencyKey:randomUUID(),requestFingerprint:store.chatRequestFingerprint("one")}; const two={projectId:s.projectId,threadId:s.threadB,clerkUserId:s.owner,idempotencyKey:randomUUID(),requestFingerprint:store.chatRequestFingerprint("two")};
    const [a,b]=await Promise.all([store.reserveChatExchange(one),store.reserveChatExchange(two)]); assert.deepEqual([a.kind,b.kind].sort(),["owner","wait"]);
    const input=a.kind==="owner"?one:two,owned=a.kind==="owner"?a:b;if(owned.kind!=="owner")throw new Error("missing owner"); const result=await store.completeChatExchange({...input,ownerToken:owned.ownerToken,userMessage:input===one?"one":"two",response:answer}); assert.deepEqual([result.userMessageCount,20],[20,20]);
    await assert.rejects(()=>store.reserveChatExchange(a.kind==="owner"?two:one),(e:any)=>e.code==="project_message_limit_reached"&&e.userMessageCount===20&&e.remaining===0);
  } finally {await s.cleanup();}
});

db("completion failure rolls back messages, usage, memory, thread metadata, and completion state",async()=>{
  const s=await fixture(); const store=await import("../ai-engine/chat/chat-exchange-store"); const key=randomUUID(),requestFingerprint=store.chatRequestFingerprint("rollback");
  try {
    await s.pool.query("UPDATE ai_builder_chat_threads SET memory='null'::jsonb WHERE id=$1",[s.threadA]); const before=(await s.pool.query("SELECT memory,updated_at FROM ai_builder_chat_threads WHERE id=$1",[s.threadA])).rows[0]; const reservation=await store.reserveChatExchange({projectId:s.projectId,threadId:s.threadA,clerkUserId:s.owner,idempotencyKey:key,requestFingerprint}); if(reservation.kind!=="owner")throw new Error("missing owner");
    await assert.rejects(()=>store.completeChatExchange({projectId:s.projectId,threadId:s.threadA,clerkUserId:s.owner,idempotencyKey:key,requestFingerprint,ownerToken:reservation.ownerToken,userMessage:"rollback",response:answer}));
    assert.equal(Number((await s.pool.query("SELECT COUNT(*) count FROM ai_builder_chat_messages m JOIN ai_builder_chat_threads t ON t.id=m.thread_id WHERE t.project_id=$1",[s.projectId])).rows[0].count),0); const after=(await s.pool.query("SELECT memory,updated_at FROM ai_builder_chat_threads WHERE id=$1",[s.threadA])).rows[0]; assert.deepEqual(after,before); assert.equal((await s.pool.query("SELECT status,user_message_id FROM ai_builder_chat_exchanges WHERE project_id=$1",[s.projectId])).rows[0].status,"pending");
  } finally {await s.cleanup();}
});
