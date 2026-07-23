import { NextResponse } from "next/server";
import { Pool } from "@neondatabase/serverless";
import {
  classifyResponseDepth,
  retrieveStructuredCanonicalKnowledge,
  buildStructuredSystemPrompt,
  analyzeCanonicalConflicts,
  buildCombinedRuntimeContext,
} from "@/app/lib/ai-engine/chat";
import type {
  ChatRequest,
  ChatResponse,
} from "@/app/lib/ai-engine/chat";
import { runOpenAiChat } from "@/app/lib/ai-engine/providers/openaiChatRunner";
import { ensureAiBuilderSchema } from "@/app/lib/db/ai-builder-schema";
import { getSql } from "@/app/lib/db/client";
import { getAiBuilderProject } from "@/app/lib/db/ai-builder-repository";
import { requireClerkUserId } from "@/app/lib/auth/clerk";
import { getPersistedAssistantProjectionForUpdate } from "@/app/lib/ai-engine/assistant-projection/persistence";
import { ASSISTANT_PROJECTION_SCHEMA_VERSION, ASSISTANT_PROJECTION_VERSION } from "@/app/lib/ai-engine/assistant-projection/contracts";
import { getProjectRuntimeAuthority } from "@/app/lib/ai-engine/runtime-authority/projectRuntimeAuthority";
import { cutoverEligibilityFailure } from "@/app/lib/ai-engine/assistant-projection/cutover";
import { writeRuntimeAuthorityMismatchAfterRollback } from "@/app/lib/ai-engine/operations/operational-events";
import { normalizeConversationMemory } from "@/app/lib/ai-engine/memory/conversationMemory";
import { chatRequestFingerprint, completeChatExchange, failChatExchange, PROJECT_USER_MESSAGE_LIMIT, reserveChatExchange, type PersistedExchange } from "@/app/lib/ai-engine/chat/chat-exchange-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

let projectionPool: Pool | null = null;
const getProjectionPool = () => projectionPool ??= new Pool({ connectionString: process.env.DATABASE_URL });

/** A canonical projection is usable whenever it has any runtime knowledge. */
function hasAnswerableAssistantProjection(projection: import("@/app/lib/ai-engine/assistant-projection/contracts").AssistantProjection): boolean {
  return projection.services.length + projection.products.length + projection.pricing.length + projection.policies.length + projection.faqs.length + projection.restrictions.length > 0;
}

type PersistentChatRequest = Omit<ChatRequest, "knowledge"> & {
  // Retained only for request compatibility. It is never used by the runtime.
  knowledge?: unknown;
  projectId?: string;
  threadId?: string;
  idempotencyKey?: string;
};

type DatabaseRow = Record<string, unknown>;

type ParityEvidenceRow = {
  status: unknown;
  assistant_projection_version: unknown;
  assistant_projection_schema_version: unknown;
  active_runtime_authority: unknown;
  compared_at: unknown;
  artifact_fingerprint: unknown;
};

/**
 * Cutover is deliberately strict: only a MATCH report created for this exact
 * valid artifact and schema permits chat serving. MINOR_DIFFERENCE is not
 * accepted because it is evidence of an unreviewed semantic/provenance delta.
 * Business Memory mutations invalidate the artifact, so a valid artifact is
 * also the durable proof that no newer mutation invalidated this evidence.
 */
async function loadCanonicalRuntimeKnowledge(projectId: string) {
  const client = await getProjectionPool().connect();
  let artifactFingerprint: string | null = null;
  const rejectRuntime = (code:string):never => { throw new Error(code); };
  try {
    // The project lock serializes authority changes, Business Memory
    // invalidation, and rebuilds. Copy the validated artifact before COMMIT;
    // OpenAI/retrieval never runs while this transaction is held.
    await client.query("BEGIN");
    await client.query("SELECT id FROM ai_builder_projects WHERE id=$1 FOR UPDATE", [projectId]);
    const authority = await getProjectRuntimeAuthority(client, projectId);
    // Legacy is a migration-pending marker, not a request-time fallback.
    if (authority !== "canonical") rejectRuntime("assistant_projection_migration_required");
    const persisted = await getPersistedAssistantProjectionForUpdate(client, projectId);
    if (!persisted) throw new Error("assistant_projection_runtime_unavailable_missing");
    artifactFingerprint=persisted.businessMemoryFingerprint;
    if (persisted.invalidationState !== "valid") {
      rejectRuntime(`assistant_projection_runtime_unavailable_${persisted.invalidationState}`);
    }
    if (persisted.projectionVersion !== ASSISTANT_PROJECTION_VERSION) rejectRuntime("assistant_projection_runtime_unavailable_unsupported_projection_version");
    if (persisted.schemaVersion !== ASSISTANT_PROJECTION_SCHEMA_VERSION) rejectRuntime("assistant_projection_runtime_unavailable_unsupported_schema_version");

    const report = (await client.query(
      "SELECT status,assistant_projection_version,assistant_projection_schema_version,active_runtime_authority,compared_at,artifact_fingerprint FROM ai_builder_assistant_projection_parity_reports WHERE project_id=$1 FOR UPDATE",
      [projectId],
    )).rows[0] as ParityEvidenceRow | undefined;
    const eligibilityFailure = cutoverEligibilityFailure({
      runtimeAuthority: authority,
      artifact: persisted,
      evidence: report ? { status: report.status, projectionVersion: report.assistant_projection_version, schemaVersion: report.assistant_projection_schema_version, activeRuntimeAuthority: report.active_runtime_authority, comparedAt: report.compared_at, artifactFingerprint: report.artifact_fingerprint } : null,
    });
    if (eligibilityFailure) rejectRuntime(eligibilityFailure);

    // Return the validated canonical DTO directly; retrieval owns relevance, not projection generation.
    await client.query("COMMIT");
    return persisted.projection;
  } catch (cause) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (cause instanceof Error && cause.message.startsWith("assistant_projection_")) { await writeRuntimeAuthorityMismatchAfterRollback(projectId,cause.message,artifactFingerprint); throw cause; }
    throw new Error("assistant_projection_runtime_unavailable_validation_failure");
  } finally {
    client.release();
  }
}

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

    // Runtime authority and all cutover evidence are read server-side. Client
    // input cannot select a source or re-enable the removed legacy path.
    const canonicalProjection = await loadCanonicalRuntimeKnowledge(projectId);
    const projection = { source: "assistant_projection" as const, canonicalProjection };
    if (!hasAnswerableAssistantProjection(projection.canonicalProjection)) {
      throw new Error("assistant_projection_runtime_unavailable_empty");
    }

    const startedAt = Date.now();

    // Memory is optional context from this already-owned thread only. Invalid
    // state is deliberately unavailable rather than a chat failure.
    let conversationMemory = null;
    if (persistenceContext) {
      const normalized = normalizeConversationMemory(reservedMemory, { threadId: persistenceContext.threadId, projectId: persistenceContext.projectId });
      if (normalized.invalid || normalized.memory.threadId !== persistenceContext.threadId || normalized.memory.projectId !== persistenceContext.projectId) {
        console.warn("AI_BUILDER_CONVERSATION_MEMORY", { failureCode: "runtime_memory_invalid_or_mismatched" });
      } else conversationMemory = normalized.memory;
    }
    // The authoritative structured retrieval has exactly one invocation.
    const retrieved = retrieveStructuredCanonicalKnowledge(projection.canonicalProjection, message);
    const runtimeContext = buildCombinedRuntimeContext(retrieved, conversationMemory, message);
    const conflict = analyzeCanonicalConflicts(projection.canonicalProjection, retrieved, message);
    const responseDepthDecision = classifyResponseDepth(message);

    const systemPrompt = buildStructuredSystemPrompt(
      projection.canonicalProjection,
      retrieved,
      responseDepthDecision,
      conflict,
      runtimeContext,
    );

    const answer = await runOpenAiChat({
      systemPrompt,
      message,
    });

    const response: ChatResponse = {
      answer: conflict.unresolvedConflictGroups.length ? `I found conflicting approved information regarding this topic. ${answer}` : answer,
      // Public labels derive only from server-owned canonical citation chains; IDs remain internal.
      citations: conflict.citationChains.map((chain) => chain.sources[0]?.label ?? chain.sources[0]?.url ?? ("instruction" in chain.projectionItem.item ? chain.projectionItem.item.instruction : "title" in chain.projectionItem.item ? `${chain.projectionItem.item.title}: ${chain.projectionItem.item.value}` : "business information")),
      diagnostics: {
        retrievedFacts: retrieved.items.filter((item) => item.category !== "faq").length,
        retrievedFaq: retrieved.items.filter((item) => item.category === "faq").length,
        retrievalMs: Date.now() - startedAt,
        runtimeSource: projection.source,
        conflictAnalysis: conflict.diagnostics,
        conversationMemory: { available: runtimeContext.conversationMemory.available, selectedItemCount: runtimeContext.conversationMemory.items.length, selectedCategories: runtimeContext.conversationMemory.selectedCategories, excludedConflict: runtimeContext.conversationMemory.excludedConflict, retrievalDurationMs: runtimeContext.conversationMemory.retrievalDurationMs },
        structuredRetrieval: { engineVersion: retrieved.engineVersion, intent: retrieved.query.intent, directCandidateCount: retrieved.diagnostics.directCandidateCount, relationshipExpansionCount: retrieved.diagnostics.relationshipExpansionCount, relationshipCandidateCount: retrieved.diagnostics.relationshipCandidateCount, totalCandidateCount: retrieved.diagnostics.totalCandidateCount, evidenceSelectedCount: retrieved.diagnostics.evidenceSelectedCount, sourceSelectedCount: retrieved.diagnostics.sourceSelectedCount, selectedDirectCount: retrieved.diagnostics.selectedDirectCount, selectedRelatedCount: retrieved.diagnostics.selectedRelatedCount, retrievalDurationMs: retrieved.diagnostics.retrievalDurationMs, selectedResultCount: retrieved.items.length, selectedCategoryCounts: retrieved.diagnostics.selectedCategoryCounts, topScoreBands: retrieved.diagnostics.topScoreBands },
      },
    };

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
