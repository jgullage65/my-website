import { Pool } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { requireClerkUserId, isAuthenticationRequired } from "@/app/lib/auth/clerk";
import { ensureAiBuilderSchema } from "@/app/lib/db/ai-builder-schema";
import { ConversationPromotionError, parseConversationPromotionRequest, promoteConversationMessage } from "@/app/lib/ai-engine/conversation-promotion/promote-conversation-message";
export const runtime="nodejs";
let pool:Pool|null=null; const db=()=>pool??=new Pool({connectionString:process.env.DATABASE_URL});
export async function POST(request:Request){
 try { const input=parseConversationPromotionRequest(await request.json()); const actor=await requireClerkUserId(); await ensureAiBuilderSchema(); const client=await db().connect(); try { await client.query("BEGIN ISOLATION LEVEL READ COMMITTED"); const result=await promoteConversationMessage(client,actor,input); await client.query("COMMIT"); return NextResponse.json({ok:true,result}); } catch(cause) { await client.query("ROLLBACK").catch(()=>undefined); throw cause; } finally { client.release(); } }
 catch(cause){ const known=cause instanceof ConversationPromotionError?cause:null; const status=known?.status??(isAuthenticationRequired(cause)?401:500); return NextResponse.json({ok:false,error:{code:known?.code??(status===401?"authentication_required":"conversation_promotion_failed"),message:known?.message??"The statement could not be queued for review."}},{status}); }
}
