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

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isValidRequest(value: unknown): value is ChatRequest {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<ChatRequest>;

  return Boolean(
    candidate.knowledge &&
      typeof candidate.knowledge === "object" &&
      typeof candidate.message === "string" &&
      candidate.message.trim().length > 0,
  );
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

    return NextResponse.json({
      ok: true,
      response,
    });
  } catch (error) {
    const code =
      error instanceof Error
        ? error.message
        : "ai_builder_chat_failed";

    return NextResponse.json(
      {
        ok: false,
        error: {
          code,
          message:
            code === "openai_api_key_missing"
              ? "The OpenAI API key is not configured."
              : "The assistant could not answer that question.",
        },
      },
      { status: 500 },
    );
  }
}
