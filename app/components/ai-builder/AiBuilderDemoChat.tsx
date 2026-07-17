"use client";

import { FormEvent, useState } from "react";
import type { KnowledgePack } from "@/app/lib/ai-engine/knowledge";
import type {
  ChatDiagnostics,
  ChatResponse,
} from "@/app/lib/ai-engine/chat";

type StoredChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: string[];
  diagnostics?: ChatDiagnostics;
  createdAt?: string;
};

type ChatThread = {
  id: string;
  messages: StoredChatMessage[];
};

type Props = {
  knowledge: KnowledgePack;
  projectId: string;
  chatThread: ChatThread | null;
  onBack: () => void;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: string[];
  diagnostics?: ChatDiagnostics;
};

type ChatApiPayload = {
  ok?: boolean;
  response?: ChatResponse;
  persistedMessages?: {
    userMessageId: string;
    assistantMessageId: string;
  } | null;
  error?: {
    message?: string;
  };
};

function createMessageId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function createInitialMessages(
  knowledge: KnowledgePack,
  chatThread: ChatThread | null,
): ChatMessage[] {
  if (chatThread?.messages.length) {
    return chatThread.messages.map((item) => ({
      id: item.id,
      role: item.role,
      content: item.content,
      citations: item.citations,
      diagnostics: item.diagnostics,
    }));
  }

  return [
    {
      id: "assistant_welcome",
      role: "assistant",
      content: `Hi, I’m ${knowledge.assistantName}. Ask me anything about this business.`,
    },
  ];
}

export default function AiBuilderDemoChat({
  knowledge,
  projectId,
  chatThread,
  onBack,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    createInitialMessages(knowledge, chatThread),
  );
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();

    const normalizedMessage = message.trim();

    if (
      !normalizedMessage ||
      sending ||
      !chatThread?.id
    ) {
      return;
    }

    const temporaryUserMessageId = createMessageId("user");

    const userMessage: ChatMessage = {
      id: temporaryUserMessageId,
      role: "user",
      content: normalizedMessage,
    };

    setMessages((current) => current.concat(userMessage));
    setMessage("");
    setError(null);
    setSending(true);

    try {
      const result = await fetch("/api/ai-builder/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          knowledge,
          projectId,
          threadId: chatThread.id,
          message: normalizedMessage,
        }),
      });

      const payload = (await result.json()) as ChatApiPayload;

      if (
        !result.ok ||
        !payload.ok ||
        !payload.response
      ) {
        throw new Error(
          payload.error?.message ||
            "The assistant could not answer that question.",
        );
      }

      const chatResponse = payload.response;
      const persistedMessages = payload.persistedMessages;

      setMessages((current) => {
        const withPersistedUserId = current.map((item) =>
          item.id === temporaryUserMessageId &&
          persistedMessages?.userMessageId
            ? {
                ...item,
                id: persistedMessages.userMessageId,
              }
            : item,
        );

        return withPersistedUserId.concat({
          id:
            persistedMessages?.assistantMessageId ??
            createMessageId("assistant"),
          role: "assistant",
          content: chatResponse.answer,
          citations: chatResponse.citations,
          diagnostics: chatResponse.diagnostics,
        });
      });
    } catch (sendError) {
      setMessages((current) =>
        current.filter(
          (item) => item.id !== temporaryUserMessageId,
        ),
      );

      setMessage(normalizedMessage);

      setError(
        sendError instanceof Error
          ? sendError.message
          : "The assistant could not answer that question.",
      );
    } finally {
      setSending(false);
    }
  };

  const chatUnavailable = !chatThread?.id;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="relative overflow-hidden rounded-[30px] border border-amber-300/20 bg-[#030713] px-5 py-7 text-center shadow-[0_24px_90px_rgba(0,0,0,0.34),0_0_50px_rgba(245,158,11,0.06)] sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute inset-x-0 top-[-8rem] mx-auto h-56 max-w-3xl rounded-full bg-amber-400/10 blur-[90px]" />

        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300 sm:text-sm">
            Live assistant preview
          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
            Test {knowledge.assistantName}
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
            Ask real questions and see how your AI responds
            using only approved business knowledge.
          </p>

          <button
            type="button"
            onClick={onBack}
            className="mt-6 rounded-2xl border border-amber-300/15 bg-[#081226] px-5 py-3 text-sm font-semibold text-white transition hover:border-amber-300/30 hover:bg-[#0b1830]"
          >
            Back to knowledge
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-[30px] border border-white/10 bg-[#030713] shadow-[0_24px_90px_rgba(0,0,0,0.34)]">
        <div className="max-h-[620px] min-h-[500px] space-y-4 overflow-y-auto p-4 sm:p-6">
          {messages.map((item) => (
            <div
              key={item.id}
              className={
                item.role === "user"
                  ? "ml-auto max-w-[88%] rounded-[22px] rounded-br-md border border-amber-200/40 bg-amber-300 px-4 py-3 text-sm font-medium leading-6 text-[#101827] shadow-[0_12px_28px_rgba(245,158,11,0.15)]"
                  : "max-w-[92%] rounded-[22px] rounded-bl-md border border-white/[0.08] bg-black/25 px-4 py-3 text-sm leading-6 text-slate-200"
              }
            >
              <p className="whitespace-pre-wrap">
                {item.content}
              </p>

              {item.role === "assistant" &&
              item.diagnostics ? (
                <details className="mt-3 border-t border-white/[0.08] pt-3">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-amber-300/70">
                    Grounding details
                  </summary>

                  <div className="mt-2 space-y-2 text-xs text-slate-400">
                    <p>
                      {item.diagnostics.retrievedFacts} facts
                      and{" "}
                      {item.diagnostics.retrievedFaq} FAQ
                      entries retrieved.
                    </p>

                    {item.citations?.map(
                      (citation, index) => (
                        <p
                          key={`${item.id}-citation-${index}`}
                          className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"
                        >
                          {citation}
                        </p>
                      ),
                    )}
                  </div>
                </details>
              ) : null}
            </div>
          ))}

          {sending ? (
            <div className="max-w-[92%] animate-pulse rounded-[22px] rounded-bl-md border border-white/[0.08] bg-black/25 px-4 py-3 text-sm text-slate-400">
              {knowledge.assistantName} is thinking...
            </div>
          ) : null}
        </div>

        <form
          onSubmit={sendMessage}
          className="border-t border-white/[0.08] p-4 sm:p-5"
        >
          {chatUnavailable ? (
            <div className="mb-3 rounded-xl border border-red-400/20 bg-red-400/[0.07] px-4 py-3 text-sm text-red-200">
              This conversation could not be loaded. Return
              to the project and try again.
            </div>
          ) : null}

          {error ? (
            <div className="mb-3 rounded-xl border border-red-400/20 bg-red-400/[0.07] px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="flex items-end gap-3">
            <textarea
              rows={2}
              value={message}
              onChange={(event) =>
                setMessage(event.target.value)
              }
              disabled={chatUnavailable || sending}
              placeholder="Ask about services, pricing, policies, or the business..."
              className="min-h-[58px] flex-1 resize-none rounded-2xl border border-white/10 bg-[#020611] px-4 py-3 text-sm text-white shadow-inner shadow-black/30 outline-none transition placeholder:text-slate-600 focus:border-amber-300/50 focus:ring-4 focus:ring-amber-300/5 disabled:cursor-not-allowed disabled:opacity-50"
            />

            <button
              type="submit"
              disabled={
                chatUnavailable ||
                sending ||
                !message.trim()
              }
              className="min-h-[58px] rounded-2xl border border-amber-300/15 bg-[#081226] px-5 py-3 font-bold text-white shadow-[0_12px_30px_rgba(245,158,11,0.18)] transition hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-[#0b1830] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
            >
              Send
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}