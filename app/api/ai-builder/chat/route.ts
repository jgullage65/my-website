import { randomUUID } from "crypto";
import { Pool } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import {
  buildSystemPrompt,
  classifyResponseDepth,
  retrieveKnowledge,
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
import { getPersistedAssistantProjection } from "@/app/lib/ai-engine/assistant-projection/persistence";
import { buildLegacyKnowledgePackFromAssistantProjection } from "@/app/lib/ai-engine/assistant-projection/legacy-compatibility";
import { ASSISTANT_PROJECTION_SCHEMA_VERSION, ASSISTANT_PROJECTION_VERSION } from "@/app/lib/ai-engine/assistant-projection/contracts";
import { getProjectRuntimeAuthority } from "@/app/lib/ai-engine/runtime-authority/projectRuntimeAuthority";
import { cutoverEligibilityFailure } from "@/app/lib/ai-engine/assistant-projection/cutover";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PROJECT_USER_MESSAGE_LIMIT = 20;
let projectionPool: Pool | null = null;
const getProjectionPool = () => (projectionPool ??= new Pool({ connectionString: process.env.DATABASE_URL }));

type PersistentChatRequest = Omit<ChatRequest, "knowledge"> & {
  // Retained only for request compatibility. It is never used by the runtime.
  knowledge?: unknown;
  projectId?: string;
  threadId?: string;
};

type DatabaseRow = Record<string, unknown>;

type ParityEvidenceRow = {
  status: unknown;
  assistant_projection_version: unknown;
  assistant_projection_schema_version: unknown;
  active_runtime_authority: unknown;
  compared_at: unknown;
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
  try {
    const authority = await getProjectRuntimeAuthority(client, projectId);
    // Legacy is a migration-pending marker, not a request-time fallback.
    if (authority !== "canonical") throw new Error("assistant_projection_migration_required");
    const persisted = await getPersistedAssistantProjection(client, projectId);
    if (!persisted) throw new Error("assistant_projection_runtime_unavailable_missing");
    if (persisted.invalidationState !== "valid") {
      throw new Error(`assistant_projection_runtime_unavailable_${persisted.invalidationState}`);
    }
    if (persisted.projectionVersion !== ASSISTANT_PROJECTION_VERSION) throw new Error("assistant_projection_runtime_unavailable_unsupported_projection_version");
    if (persisted.schemaVersion !== ASSISTANT_PROJECTION_SCHEMA_VERSION) throw new Error("assistant_projection_runtime_unavailable_unsupported_schema_version");

    const report = (await client.query(
      "SELECT status,assistant_projection_version,assistant_projection_schema_version,active_runtime_authority,compared_at FROM ai_builder_assistant_projection_parity_reports WHERE project_id=$1",
      [projectId],
    )).rows[0] as ParityEvidenceRow | undefined;
    const eligibilityFailure = cutoverEligibilityFailure({
      runtimeAuthority: authority,
      artifact: persisted,
      evidence: report ? { status: report.status, projectionVersion: report.assistant_projection_version, schemaVersion: report.assistant_projection_schema_version, activeRuntimeAuthority: report.active_runtime_authority, comparedAt: report.compared_at } : null,
    });
    if (eligibilityFailure) throw new Error(eligibilityFailure);

    // Shape adapter only: it consumes the persisted Assistant Projection and
    // performs no Trusted Knowledge or Business Memory read.
    return buildLegacyKnowledgePackFromAssistantProjection(persisted.projection);
  } catch (cause) {
    if (cause instanceof Error && cause.message.startsWith("assistant_projection_")) throw cause;
    throw new Error("assistant_projection_runtime_unavailable_validation_failure");
  } finally {
    client.release();
  }
}

type PersistentThread = {
  projectId: string;
  threadId: string;
  userMessageCount: number;
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
      COUNT(messages.id) FILTER (
        WHERE messages.role = 'user'
      )::integer AS user_message_count
    FROM ai_builder_chat_threads AS threads
    INNER JOIN ai_builder_projects AS projects
      ON projects.id = threads.project_id
    LEFT JOIN ai_builder_chat_threads AS project_threads
      ON project_threads.project_id = projects.id
    LEFT JOIN ai_builder_chat_messages AS messages
      ON messages.thread_id = project_threads.id
    WHERE threads.id = ${threadId}
      AND threads.project_id = ${projectId}
      AND projects.archived_at IS NULL
      AND projects.clerk_user_id = ${clerkUserId}
    GROUP BY threads.id, threads.project_id
    LIMIT 1
  `) as DatabaseRow[];

  if (!rows[0]) {
    throw new Error("chat_thread_not_found");
  }

  return {
    projectId,
    threadId,
    userMessageCount: Number(rows[0].user_message_count ?? 0),
  };
}

async function persistChatExchange(input: {
  projectId: string;
  threadId: string;
  userMessage: string;
  response: ChatResponse;
}): Promise<{
  userMessageId: string;
  assistantMessageId: string;
}> {
  const clerkUserId = await requireClerkUserId();
  await ensureAiBuilderSchema();

  const sql = getSql();
  const userCreatedAt = new Date();
  const assistantCreatedAt = new Date(userCreatedAt.getTime() + 1);
  const userMessageId = `user_${randomUUID()}`;
  const assistantMessageId = `assistant_${randomUUID()}`;

  const ownedThreads = (await sql`
    SELECT threads.id
    FROM ai_builder_chat_threads threads
    JOIN ai_builder_projects projects ON projects.id = threads.project_id
    WHERE threads.id = ${input.threadId}
      AND threads.project_id = ${input.projectId}
      AND projects.clerk_user_id = ${clerkUserId}
      AND projects.archived_at IS NULL
    LIMIT 1
  `) as DatabaseRow[];
  if (!ownedThreads[0]) throw new Error("chat_thread_not_found");

  await sql`
    INSERT INTO ai_builder_chat_messages (
      id,
      thread_id,
      role,
      content,
      metadata,
      created_at
    ) VALUES (
      ${userMessageId},
      ${input.threadId},
      ${"user"},
      ${input.userMessage},
      ${JSON.stringify({
        projectId: input.projectId,
      })}::jsonb,
      ${userCreatedAt.toISOString()}::timestamptz
    )
  `;

  await sql`
    INSERT INTO ai_builder_chat_messages (
      id,
      thread_id,
      role,
      content,
      metadata,
      created_at
    ) VALUES (
      ${assistantMessageId},
      ${input.threadId},
      ${"assistant"},
      ${input.response.answer},
      ${JSON.stringify({
        projectId: input.projectId,
        citations: input.response.citations,
        diagnostics: input.response.diagnostics,
      })}::jsonb,
      ${assistantCreatedAt.toISOString()}::timestamptz
    )
  `;

  await sql`
    UPDATE ai_builder_chat_threads
    SET updated_at = ${assistantCreatedAt.toISOString()}::timestamptz
    WHERE id = ${input.threadId}
      AND project_id = ${input.projectId}
  `;

  return {
    userMessageId,
    assistantMessageId,
  };
}

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
  try {
    await requireClerkUserId();
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

    if (
      persistenceContext &&
      persistenceContext.userMessageCount >= PROJECT_USER_MESSAGE_LIMIT
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "project_message_limit_reached",
            message:
              "This project has reached its 20-message demo limit.",
          },
          usage: {
            userMessageCount: persistenceContext.userMessageCount,
            limit: PROJECT_USER_MESSAGE_LIMIT,
            remaining: 0,
          },
        },
        { status: 429 },
      );
    }

    // The nonpersistent selector identifies the server-owned project only;
    // no client knowledge is used to construct the runtime projection.
    const projectId = persistenceContext?.projectId ??
      getNonpersistentProjectId(body.knowledge);
    if (!projectId) throw new Error("invalid_chat_persistence_context");

    const project = projectId
      ? await getAiBuilderProject(projectId)
      : null;
    if (!project) throw new Error("chat_thread_not_found");

    // Runtime authority and all cutover evidence are read server-side. Client
    // input cannot select a source or re-enable the removed legacy path.
    const knowledge = await loadCanonicalRuntimeKnowledge(projectId);
    const projection = { source: "assistant_projection" as const, knowledge };
    if (
      projection.knowledge.facts.length === 0 &&
      projection.knowledge.faq.length === 0
    ) {
      throw new Error("assistant_projection_runtime_unavailable_empty");
    }

    const message = body.message.trim().slice(0, 4000);
    const startedAt = Date.now();

    const retrieved = retrieveKnowledge({
      knowledge: projection.knowledge,
      message,
    });
    const responseDepthDecision = classifyResponseDepth(message);

    const systemPrompt = buildSystemPrompt(
      projection.knowledge,
      retrieved,
      responseDepthDecision,
    );

    const answer = await runOpenAiChat({
      systemPrompt,
      message,
    });

    const response: ChatResponse = {
      answer,
      citations: retrieved.facts.concat(retrieved.faq),
      diagnostics: {
        retrievedFacts: retrieved.facts.length,
        retrievedFaq: retrieved.faq.length,
        retrievalMs: Date.now() - startedAt,
        runtimeSource: projection.source,
      },
    };

    const persistedMessages = persistenceContext
      ? await persistChatExchange({
          projectId: persistenceContext.projectId,
          threadId: persistenceContext.threadId,
          userMessage: message,
          response,
        })
      : null;

    const userMessageCount = persistenceContext
      ? persistenceContext.userMessageCount + 1
      : null;

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
    const details = getErrorDetails(error);

    console.error("AI_BUILDER_CHAT_FAILED", {
      code: details.code,
      message:
        error instanceof Error
          ? error.message
          : "unknown_error",
    });

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: details.code,
          message: details.message,
        },
      },
      { status: details.status },
    );
  }
}
