import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import {
  buildSystemPrompt,
  retrieveKnowledge,
} from "@/app/lib/ai-engine/chat";
import type {
  ChatRequest,
  ChatResponse,
} from "@/app/lib/ai-engine/chat";
import { runOpenAiChat } from "@/app/lib/ai-engine/providers/openaiChatRunner";
import { ensureAiBuilderSchema } from "@/app/lib/db/ai-builder-schema";
import { getSql } from "@/app/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type PersistentChatRequest = ChatRequest & {
  projectId?: string;
  threadId?: string;
};

type DatabaseRow = Record<string, unknown>;

function isValidRequest(value: unknown): value is PersistentChatRequest {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<PersistentChatRequest>;

  const hasValidRequiredFields = Boolean(
    candidate.knowledge &&
      typeof candidate.knowledge === "object" &&
      typeof candidate.message === "string" &&
      candidate.message.trim().length > 0,
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

async function resolvePersistentThread(input: {
  projectId?: string;
  threadId?: string;
}): Promise<{
  projectId: string;
  threadId: string;
} | null> {
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
      threads.project_id
    FROM ai_builder_chat_threads AS threads
    INNER JOIN ai_builder_projects AS projects
      ON projects.id = threads.project_id
    WHERE threads.id = ${threadId}
      AND threads.project_id = ${projectId}
    LIMIT 1
  `) as DatabaseRow[];

  if (!rows[0]) {
    throw new Error("chat_thread_not_found");
  }

  return {
    projectId,
    threadId,
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
  await ensureAiBuilderSchema();

  const sql = getSql();
  const now = new Date().toISOString();
  const userMessageId = `user_${randomUUID()}`;
  const assistantMessageId = `assistant_${randomUUID()}`;

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
      ${now}::timestamptz
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
      ${now}::timestamptz
    )
  `;

  await sql`
    UPDATE ai_builder_chat_threads
    SET updated_at = ${now}::timestamptz
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
    const body = (await request.json()) as unknown;

    if (!isValidRequest(body)) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "invalid_chat_request",
            message:
              "Approved knowledge and a message are required.",
          },
        },
        { status: 400 },
      );
    }

    const persistenceContext = await resolvePersistentThread({
      projectId: body.projectId,
      threadId: body.threadId,
    });

    const message = body.message.trim().slice(0, 4000);
    const startedAt = Date.now();

    const retrieved = retrieveKnowledge({
      knowledge: body.knowledge,
      message,
    });

    const systemPrompt = buildSystemPrompt(
      body.knowledge,
      retrieved,
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

    return NextResponse.json({
      ok: true,
      response,
      persistedMessages,
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