import { NextResponse } from "next/server";
import type { ChatRequest } from "@/app/lib/ai-engine/chat";
import { runAssistant } from "@/app/lib/ai-engine/assistant-runtime/runAssistant";
import { ensureAiBuilderSchema } from "@/app/lib/db/ai-builder-schema";
import { getSql } from "@/app/lib/db/client";
import { getAiBuilderProject } from "@/app/lib/db/ai-builder-repository";
import { requireClerkUserId } from "@/app/lib/auth/clerk";
import { normalizeConversationMemory } from "@/app/lib/ai-engine/memory/conversationMemory";
import { chatRequestFingerprint, completeChatExchange, failChatExchange, PROJECT_USER_MESSAGE_LIMIT, reserveChatExchange, type PersistedExchange } from "@/app/lib/ai-engine/chat/chat-exchange-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type PersistentChatRequest = Omit<ChatRequest, "knowledge"> & {
  // Retained only for request compatibility. It is never used by the runtime.
  knowledge?: unknown;
  projectId?: string;
  threadId?: string;
  idempotencyKey?: string;
};

type DatabaseRow = Record<string, unknown>;

type PersistentThread = {
  projectId: string;
  threadId: string;
  memory: unknown;
};

function isValidRequest(value: unknown): value is PersistentChatRequest {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<PersistentChatRequest>;

  const hasValidRequiredFields = Boolean(
    typeof candidate.message === "string" && candidate.message.trim().length > 0,
  );

  if (!hasValidRequiredFields) return false;

  if (
    candidate.projectId !== undefined &&
    (typeof candidate.projectId !== "string" ||
      candidate.projectId.trim().length === 0)
  ) {
    return false;
  }

  if (
    candidate.threadId !== undefined &&
    (typeof candidate.threadId !== "string" ||
      candidate.threadId.trim().length === 0)
  ) {
    return false;
  }

  if (candidate.projectId !== undefined && candidate.threadId !== undefined &&
      (typeof candidate.idempotencyKey !== "string" || !candidate.idempotencyKey.trim() || candidate.idempotencyKey.length > 200)) return false;

  return true;
}

function getNonpersistentProjectId(knowledge: unknown): string | null {
  if (!knowledge || typeof knowledge !== "object" || Array.isArray(knowledge)) {
    return null;
  }

  const sessionId = (knowledge as { sessionId?: unknown }).sessionId;
  if (typeof sessionId !== "string" || sessionId.trim().length === 0) {
    return null;
  }

  return sessionId.trim();
}

async function resolvePersistentThread(input: {
  projectId?: string;
  threadId?: string;
}): Promise<PersistentThread | null> {
  const clerkUserId = await requireClerkUserId();
  const projectId = input.projectId?.trim();
  const threadId = input.threadId?.trim();

  if (!projectId && !threadId) {
    return null;
  }

  if (!projectId || !threadId) {
    throw new Error("invalid_chat_persistence_context");
  }

  await ensureAiBuilderSchema();

  const sql = getSql();

  const rows = (await sql`
    SELECT
      threads.id,
      threads.project_id,
      threads.memory
    FROM ai_builder_chat_threads AS threads
    INNER JOIN ai_builder_projects AS projects
      ON projects.id = threads.project_id
    WHERE threads.id = ${threadId}
      AND threads.project_id = ${projectId}
      AND projects.archived_at IS NULL
      AND projects.clerk_user_id = ${clerkUserId}
    LIMIT 1
  `) as DatabaseRow[];

  if (!rows[0]) {
    throw new Error("chat_thread_not_found");
  }

  return {
    projectId,
    threadId,
    memory: rows[0].memory,
  };
}

function success(result:PersistedExchange) { return NextResponse.json({ok:true,response:result.response,persistedMessages:result,usage:{userMessageCount:result.userMessageCount,limit:PROJECT_USER_MESSAGE_LIMIT,remaining:Math.max(PROJECT_USER_MESSAGE_LIMIT-result.userMessageCount,0)}}); }
function getErrorDetails(error: unknown): {
  status: number;
  code: string;
  message: string;
} {
  const code =
    error instanceof Error
      ? error.message
      : "ai_builder_chat_failed";

  if (code === "authentication_required") {
    return {
      status: 401,
      code,
      message: "Sign in to use AI Builder.",
    };
  }

  if (code === "invalid_chat_persistence_context") {
    return {
      status: 400,
      code,
      message:
        "Both the project ID and conversation thread ID are required to save this conversation.",
    };
  }

  if (code === "chat_thread_not_found") {
    return {
      status: 404,
      code,
      message:
        "The AI Builder conversation could not be found.",
    };
  }

  if (code === "project_message_limit_reached") {
    return {
      status: 429,
      code,
      message:
        "This project has reached its 20-message demo limit.",
    };
  }
  if(code==="chat_idempotency_conflict") return {status:409,code,message:"That request identifier was already used for a different message."};
  if(code==="chat_exchange_ownership_lost") return {status:409,code,message:"This chat request was superseded. Please retry."};
  if(code==="chat_exchange_wait_timeout") return {status:503,code,message:"The existing chat request is still processing. Please retry shortly."};

  if (code === "approved_knowledge_unavailable") {
    return {
      status: 422,
      code,
      message:
        "This project has no approved business knowledge available for chat.",
    };
  }

  if (code === "assistant_projection_migration_required") return { status: 503, code, message: "This assistant project needs migration before chat is available. Please contact support." };

  if (code.startsWith("assistant_projection_runtime_unavailable")) return { status: 503, code, message: "The assistant runtime is temporarily unavailable. Please try again later." };

  if (code === "openai_api_key_missing") {
    return {
      status: 500,
      code,
      message: "The OpenAI API key is not configured.",
    };
  }

  return {
    status: 500,
    code,
    message: "The assistant could not answer that question.",
  };
}

export async function POST(request: Request) {
  let owned: {projectId:string;threadId:string;idempotencyKey:string;ownerToken:string}|null=null;
  try {
    const clerkUserId=await requireClerkUserId();
    const body = (await request.json()) as unknown;

    if (!isValidRequest(body)) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "invalid_chat_request",
            message: "A message and valid optional conversation IDs are required.",
          },
        },
        { status: 400 },
      );
    }

    const persistenceContext = await resolvePersistentThread({
      projectId: body.projectId,
      threadId: body.threadId,
    });

    // The nonpersistent selector identifies the server-owned project only;
    // no client knowledge is used to construct the runtime projection.
    const projectId = persistenceContext?.projectId ??
      getNonpersistentProjectId(body.knowledge);
    if (!projectId) throw new Error("invalid_chat_persistence_context");

    const message = body.message.trim().slice(0, 4000);
    let reservedMemory=persistenceContext?.memory;
    if(persistenceContext) {
      const requestFingerprint=chatRequestFingerprint(message);
      for(let attempt=0;attempt<650;attempt++) {
        const reservation=await reserveChatExchange({projectId:persistenceContext.projectId,threadId:persistenceContext.threadId,clerkUserId,idempotencyKey:body.idempotencyKey!.trim(),requestFingerprint});
        if(reservation.kind==="completed") return success(reservation.result);
        if(reservation.kind==="owner") { owned={projectId:persistenceContext.projectId,threadId:persistenceContext.threadId,idempotencyKey:body.idempotencyKey!.trim(),ownerToken:reservation.ownerToken}; reservedMemory=reservation.memory; break; }
        await new Promise(resolve=>setTimeout(resolve,100));
      }
      if(!owned) throw new Error("chat_exchange_wait_timeout");
    }

    const project = projectId
      ? await getAiBuilderProject(projectId)
      : null;
    if (!project) throw new Error("chat_thread_not_found");

    // Memory is optional context from this already-owned thread only. Invalid
    // state is deliberately unavailable rather than a chat failure.
    let conversationMemory = null;
    if (persistenceContext) {
      const normalized = normalizeConversationMemory(reservedMemory, { threadId: persistenceContext.threadId, projectId: persistenceContext.projectId });
      if (normalized.invalid || normalized.memory.threadId !== persistenceContext.threadId || normalized.memory.projectId !== persistenceContext.projectId) {
        console.warn("AI_BUILDER_CONVERSATION_MEMORY", { failureCode: "runtime_memory_invalid_or_mismatched" });
      } else conversationMemory = normalized.memory;
    }

    const { response } = await runAssistant({
      projectId,
      message,
      conversationMemory,
      feature: "ai_builder_chat",
    });

    const persistedMessages = persistenceContext && owned
      ? await completeChatExchange({
          projectId: persistenceContext.projectId,
          threadId: persistenceContext.threadId,
          clerkUserId,
          idempotencyKey: body.idempotencyKey!.trim(),
          requestFingerprint:chatRequestFingerprint(message),
          ownerToken:owned.ownerToken,
          userMessage: message,
          response,
        })
      : null;

    const userMessageCount = persistedMessages?.userMessageCount ?? null;

    if(persistedMessages) { owned=null; return success(persistedMessages); }
    return NextResponse.json({
      ok: true,
      response,
      persistedMessages,
      usage:
        userMessageCount === null
          ? null
          : {
              userMessageCount,
              limit: PROJECT_USER_MESSAGE_LIMIT,
              remaining: Math.max(
                PROJECT_USER_MESSAGE_LIMIT - userMessageCount,
                0,
              ),
            },
    });
  } catch (error) {
    if(owned) await failChatExchange({...owned,failureCode:error instanceof Error?error.message:"chat_failed"}).catch(()=>undefined);
    const details = getErrorDetails(error);

    console.error("AI_BUILDER_CHAT_FAILED", {
      code: details.code,
      message:
        error instanceof Error
          ? error.message
          : "unknown_error",
    });

    const usage = error && typeof error==="object" && "userMessageCount" in error ? { userMessageCount:Number(error.userMessageCount), limit:PROJECT_USER_MESSAGE_LIMIT, remaining:Number("remaining" in error?error.remaining:0) } : undefined;
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: details.code,
          message: details.message,
        },
        usage,
      },
      { status: details.status },
    );
  }
}
