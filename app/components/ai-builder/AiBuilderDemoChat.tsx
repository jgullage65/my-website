"use client";

import { FormEvent, useState } from "react";
import type { KnowledgePack } from "@/app/lib/ai-engine/knowledge";
import type {
  ChatDiagnostics,
  ChatResponse,
} from "@/app/lib/ai-engine/chat";

type Props = {
  knowledge: KnowledgePack;
  onBack: () => void;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: string[];
  diagnostics?: ChatDiagnostics;
};

function createMessageId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export default function AiBuilderDemoChat({
  knowledge,
  onBack,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "assistant_welcome",
      role: "assistant",
      content: `Hi, I’m ${knowledge.assistantName}. Ask me anything about this business.`,
    },
  ]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();

    const normalizedMessage = message.trim();

    if (!normalizedMessage || sending) return;

    const userMessage: ChatMessage = {
      id: createMessageId("user"),
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
          message: normalizedMessage,
        }),
      });

      const payload = (await result.json()) as {
        ok?: boolean;
        response?: ChatResponse;
        error?: {
          message?: string;
        };
      };

      if (!result.ok || !payload.ok || !payload.response) {
        throw new Error(
          payload.error?.message ||
            "The assistant could not answer that question.",
        );
      }

      const chatResponse = payload.response;

      setMessages((current) =>
        current.concat({
          id: createMessageId("assistant"),
          role: "assistant",
          content: chatResponse.answer,
          citations: chatResponse.citations,
          diagnostics: chatResponse.diagnostics,
        }),
      );
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "The assistant could not answer that question.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
        <p className="text-sm uppercase tracking-[0.24em] text-amber-400">
          Live assistant preview
        </p>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-white">
              Test {knowledge.assistantName}
            </h2>
            <p className="mt-2 text-neutral-400">
              Answers are grounded only in approved business knowledge.
            </p>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-neutral-700 px-4 py-3 text-sm font-semibold text-white"
          >
            Back to knowledge
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900">
        <div className="max-h-[560px] min-h-[420px] space-y-4 overflow-y-auto p-5">
          {messages.map((item) => (
            <div
              key={item.id}
              className={
                item.role === "user"
                  ? "ml-auto max-w-[85%] rounded-2xl bg-amber-500 px-4 py-3 text-sm font-medium text-black"
                  : "max-w-[90%] rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm leading-6 text-neutral-200"
              }
            >
              <p className="whitespace-pre-wrap">{item.content}</p>

              {item.role === "assistant" && item.diagnostics ? (
                <details className="mt-3 border-t border-neutral-800 pt-3">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
                    Grounding details
                  </summary>

                  <div className="mt-2 space-y-2 text-xs text-neutral-400">
                    <p>
                      {item.diagnostics.retrievedFacts} facts and{" "}
                      {item.diagnostics.retrievedFaq} FAQ entries
                      retrieved.
                    </p>

                    {item.citations?.map((citation, index) => (
                      <p
                        key={`${item.id}-citation-${index}`}
                        className="rounded-lg border border-neutral-800 bg-neutral-900 p-2"
                      >
                        {citation}
                      </p>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          ))}

          {sending ? (
            <div className="max-w-[90%] animate-pulse rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-neutral-400">
              {knowledge.assistantName} is thinking...
            </div>
          ) : null}
        </div>

        <form
          onSubmit={sendMessage}
          className="border-t border-neutral-800 p-4"
        >
          {error ? (
            <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="flex gap-3">
            <textarea
              rows={2}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Ask about services, pricing, policies, or the business..."
              className="min-h-[52px] flex-1 resize-none rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-white outline-none placeholder:text-neutral-600 focus:border-amber-500"
            />

            <button
              type="submit"
              disabled={sending || !message.trim()}
              className="rounded-xl bg-amber-500 px-5 py-3 font-bold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}