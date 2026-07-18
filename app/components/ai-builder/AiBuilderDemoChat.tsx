"use client";

import {
  FormEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { KnowledgePack } from "@/app/lib/ai-engine/knowledge";
import { useCanonicalConfirm } from "@/app/components/ui/CanonicalConfirmDialog";
import type {
  ChatDiagnostics,
  ChatResponse,
} from "@/app/lib/ai-engine/chat";

const PROJECT_USER_MESSAGE_LIMIT = 20;

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

type ChatUsage = {
  userMessageCount: number;
  limit: number;
  remaining: number;
};

type ScrollbarMetrics = {
  height: number;
  top: number;
};


type PurchaseInterestPayload = {
  ok?: boolean;
  alreadySubmitted?: boolean;
  error?: {
    code?: string;
    message?: string;
  };
};

type ChatApiPayload = {
  ok?: boolean;
  response?: ChatResponse;
  persistedMessages?: {
    userMessageId: string;
    assistantMessageId: string;
  } | null;
  usage?: ChatUsage | null;
  error?: {
    code?: string;
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

function getInitialUserMessageCount(
  chatThread: ChatThread | null,
): number {
  return (
    chatThread?.messages.filter((item) => item.role === "user")
      .length ?? 0
  );
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
  const [userMessageCount, setUserMessageCount] = useState(() =>
    getInitialUserMessageCount(chatThread),
  );
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purchaseInterestSubmitted, setPurchaseInterestSubmitted] =
    useState(false);
  const [purchaseInterestSubmitting, setPurchaseInterestSubmitting] =
    useState(false);
  const [scrollbarMetrics, setScrollbarMetrics] =
    useState<ScrollbarMetrics>({ height: 40, top: 0 });
  const [scrollbarDragging, setScrollbarDragging] =
    useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const scrollbarTrackRef = useRef<HTMLDivElement>(null);
  const scrollbarDragRef = useRef<{
    pointerY: number;
    scrollTop: number;
  } | null>(null);
  const { showConfirm, confirmDialogNode } = useCanonicalConfirm();

  const chatUnavailable = !chatThread?.id;
  const messageLimitReached =
    userMessageCount >= PROJECT_USER_MESSAGE_LIMIT;
  const remainingMessages = Math.max(
    PROJECT_USER_MESSAGE_LIMIT - userMessageCount,
    0,
  );

  const updateScrollbar = useCallback(() => {
    const element = chatScrollRef.current;
    const track = scrollbarTrackRef.current;
    if (!element || !track) return;

    const { clientHeight, scrollHeight, scrollTop } = element;
    const trackHeight = track.clientHeight;
    const height = Math.max(
      40,
      Math.min(
        trackHeight,
        (clientHeight / scrollHeight) * trackHeight,
      ),
    );
    const scrollRange = Math.max(scrollHeight - clientHeight, 0);
    const thumbRange = Math.max(trackHeight - height, 0);
    const top = scrollRange
      ? (scrollTop / scrollRange) * thumbRange
      : 0;

    setScrollbarMetrics({ height, top });
  }, []);

  useEffect(() => {
    const element = chatScrollRef.current;
    if (!element) return;

    updateScrollbar();
    element.addEventListener("scroll", updateScrollbar, {
      passive: true,
    });

    const resizeObserver = new ResizeObserver(updateScrollbar);
    resizeObserver.observe(element);

    return () => {
      element.removeEventListener("scroll", updateScrollbar);
      resizeObserver.disconnect();
    };
  }, [updateScrollbar]);

  useEffect(() => {
    window.requestAnimationFrame(updateScrollbar);
  }, [messages, sending, updateScrollbar]);

  const startScrollbarDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const element = chatScrollRef.current;
    if (!element) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    scrollbarDragRef.current = {
      pointerY: event.clientY,
      scrollTop: element.scrollTop,
    };
    setScrollbarDragging(true);
  };

  const dragScrollbar = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const element = chatScrollRef.current;
    const track = scrollbarTrackRef.current;
    const drag = scrollbarDragRef.current;
    if (!element || !track || !drag) return;

    const scrollRange = Math.max(
      element.scrollHeight - element.clientHeight,
      0,
    );
    const thumbRange = Math.max(
      track.clientHeight - scrollbarMetrics.height,
      1,
    );

    element.scrollTop =
      drag.scrollTop +
      (event.clientY - drag.pointerY) *
        (scrollRange / thumbRange);
  };

  const stopScrollbarDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    scrollbarDragRef.current = null;
    setScrollbarDragging(false);
  };

  useEffect(() => {
    let cancelled = false;

    const loadPurchaseInterestStatus = async () => {
      try {
        const result = await fetch(
          `/api/ai-builder/purchase-interest?projectId=${encodeURIComponent(projectId)}`,
          { method: "GET" },
        );

        if (!result.ok) return;

        const payload = (await result.json()) as PurchaseInterestPayload;

        if (!cancelled) {
          setPurchaseInterestSubmitted(
            Boolean(payload.ok && payload.alreadySubmitted),
          );
        }
      } catch {
        // The purchase-interest route is optional until it is wired.
      }
    };

    void loadPurchaseInterestStatus();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const showAlreadySubmittedModal = async () => {
    await showConfirm({
      title: "Request Already Sent",
      message:
        "We already received your request to discuss purchasing this AI assistant. We will contact you soon.",
      confirmLabel: "Request Sent",
      confirmDisabled: true,
      cancelLabel: "Cancel",
    });
  };

  const showPurchaseInterestModal = async (
    source: "limit" | "cta" = "limit",
  ) => {
    if (purchaseInterestSubmitted) {
      await showAlreadySubmittedModal();
      return;
    }

    const confirmed = await showConfirm({
      title:
        source === "cta"
          ? "Purchase This AI Assistant"
          : "Demo Complete",
      message:
        source === "cta"
          ? "You've seen how this AI assistant works and can request a custom version for your business.\n\nIf you submit a purchase request, we'll review your business, discuss your goals, and walk you through the next steps. There's no obligation, and we'll contact you to answer any questions before moving forward."
          : "You have reached the 20-message demo limit for this AI assistant. If you would like to purchase it, send a request and we will contact you to discuss the next steps.",
      confirmLabel: purchaseInterestSubmitting
        ? "Sending..."
        : source === "cta"
          ? "Send Purchase Request"
          : "Discuss Purchasing",
      cancelLabel: "Cancel",
    });

    if (!confirmed || purchaseInterestSubmitting) return;

    setPurchaseInterestSubmitting(true);
    setError(null);

    try {
      const result = await fetch("/api/ai-builder/purchase-interest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ projectId }),
      });

      const payload = (await result.json()) as PurchaseInterestPayload;

      if (!result.ok || !payload.ok) {
        throw new Error(
          payload.error?.message ||
            "Your purchase request could not be sent.",
        );
      }

      setPurchaseInterestSubmitted(true);
      await showAlreadySubmittedModal();
    } catch (purchaseError) {
      setError(
        purchaseError instanceof Error
          ? purchaseError.message
          : "Your purchase request could not be sent.",
      );
    } finally {
      setPurchaseInterestSubmitting(false);
    }
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();

    const normalizedMessage = message.trim();

    if (!normalizedMessage || sending || !chatThread?.id) {
      return;
    }

    if (messageLimitReached) {
      await showPurchaseInterestModal();
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
        if (
          payload.error?.code ===
          "project_message_limit_reached"
        ) {
          setUserMessageCount(
            payload.usage?.userMessageCount ??
              PROJECT_USER_MESSAGE_LIMIT,
          );
          setMessages((current) =>
            current.filter(
              (item) => item.id !== temporaryUserMessageId,
            ),
          );
          setMessage(normalizedMessage);
          await showPurchaseInterestModal();
          return;
        }

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

      const nextUserMessageCount =
        payload.usage?.userMessageCount ?? userMessageCount + 1;

      setUserMessageCount(nextUserMessageCount);

      if (nextUserMessageCount >= PROJECT_USER_MESSAGE_LIMIT) {
        await showPurchaseInterestModal();
      }
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
        <div className="relative">
          <div
            ref={chatScrollRef}
            className="ai-builder-chat-scrollbar max-h-[620px] min-h-[500px] space-y-5 overflow-y-scroll p-4 pr-7 sm:p-6 sm:pr-9"
          >
          {messages.map((item) => (
            <div
              key={item.id}
              className={
                item.role === "user"
                  ? "ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md border border-amber-300/25 bg-[#07101f] px-4 py-3 text-sm font-medium leading-6 text-slate-100 shadow-[0_10px_24px_rgba(0,0,0,.2)] sm:max-w-[68%]"
                  : "w-fit max-w-[85%] rounded-2xl rounded-bl-md border border-amber-300/25 bg-[#050b18] px-4 py-3 text-sm leading-6 text-slate-200 shadow-[0_10px_24px_rgba(0,0,0,.2)] sm:max-w-[68%]"
              }
            >
              <p className="whitespace-pre-wrap">
                {item.content}
              </p>
            </div>
          ))}

          {sending ? (
            <div className="flex min-h-[48px] w-fit max-w-[85%] items-center gap-3 rounded-2xl rounded-bl-md border border-amber-300/25 bg-[#050b18] px-4 py-3 text-sm text-slate-400 shadow-[0_10px_24px_rgba(0,0,0,.2)] sm:max-w-[68%]">
              <span>{knowledge.assistantName} is thinking</span>
              <span className="flex gap-1" aria-hidden="true"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300/70" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300/70 [animation-delay:150ms]" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300/70 [animation-delay:300ms]" /></span>
            </div>
          ) : null}
          </div>

          <div
            ref={scrollbarTrackRef}
            className="pointer-events-none absolute inset-y-3 right-2 z-10 w-3 rounded-full bg-[#050b18]"
            aria-hidden="true"
          >
            <div
              onPointerDown={startScrollbarDrag}
              onPointerMove={dragScrollbar}
              onPointerUp={stopScrollbarDrag}
              onPointerCancel={stopScrollbarDrag}
              className={`pointer-events-auto absolute left-[2px] right-[2px] touch-none rounded-full bg-[#d4af37] hover:bg-amber-300 ${
                scrollbarDragging
                  ? "cursor-grabbing"
                  : "cursor-grab"
              }`}
              style={{
                height: `${scrollbarMetrics.height}px`,
                transform: `translateY(${scrollbarMetrics.top}px)`,
              }}
            />
          </div>
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

          <div className="mx-auto mb-3 flex max-w-3xl flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() =>
                void showPurchaseInterestModal("cta")
              }
              disabled={
                purchaseInterestSubmitted ||
                purchaseInterestSubmitting
              }
              className="cta-raised rounded-xl border border-amber-300/15 bg-[#081226] px-4 py-2 text-xs font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#0b1830] disabled:cursor-not-allowed disabled:border-emerald-300/20 disabled:bg-emerald-300/[0.07] disabled:text-emerald-200 disabled:opacity-80 disabled:hover:translate-y-0"
            >
              {purchaseInterestSubmitted
                ? "Purchase Request Sent ✓"
                : purchaseInterestSubmitting
                  ? "Sending Purchase Request..."
                  : "Buy This AI Assistant"}
            </button>

            <span className="text-xs font-semibold text-slate-500">
              {messageLimitReached
                ? "20 of 20 messages used"
                : `${remainingMessages} of 20 messages remaining`}
            </span>
          </div>

          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-amber-300/25 bg-[#050b18] p-2 shadow-[0_12px_32px_rgba(0,0,0,.22)]">
            <textarea
              rows={2}
              value={message}
              onChange={(event) =>
                setMessage(event.target.value)
              }
              disabled={chatUnavailable || sending}
              placeholder="Ask about services, pricing, policies, or the business..."
              className="min-h-[52px] flex-1 resize-none border-0 bg-transparent px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
            />

            <button
              type="submit"
              disabled={
                chatUnavailable ||
                sending ||
                !message.trim()
              }
              className="min-h-[52px] rounded-xl border border-amber-300/15 bg-[#081226] px-5 py-3 font-bold text-white shadow-[0_8px_20px_rgba(0,0,0,.24)] transition hover:border-amber-300/30 hover:bg-[#0b1830] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </form>
      </section>

      {confirmDialogNode}
    </div>
  );
}
         
      