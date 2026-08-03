"use client";

import {
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { KnowledgePack } from "@/app/lib/ai-engine/knowledge";
import { buildKnowledgePack } from "@/app/lib/ai-engine/knowledge";
import { useCanonicalConfirm } from "@/app/components/ui/CanonicalConfirmDialog";
import AiBuilderModelSelect, { type AiBuilderModelChoice } from "./AiBuilderModelSelect";
import { useAiBuilderWorkspace } from "./AiBuilderWorkspaceContext";
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
  knowledge?: KnowledgePack;
  projectId?: string;
  chatThread?: ChatThread | null;
  onBack: () => void;
  demoMode?: boolean;
  previewMode?: boolean;
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
type ModelChoice={id:string;provider:string;displayName:string;recommended:boolean;highUsage:boolean};

function ModelSelectControl({models,value,disabled,onChange,className=""}:{models:ModelChoice[];value:string;disabled:boolean;onChange:(modelId:string)=>void;className?:string}) {
  return <label className={`flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-300 ${className}`}>
    <span className="shrink-0">Active model</span>
    <select aria-label="Active AI model" value={value} disabled={disabled||!value} onChange={event=>onChange(event.target.value)} className="min-w-0 max-w-[13rem] rounded-lg border border-amber-300/20 bg-black px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50">
      {Array.from(new Set(models.map(model=>model.provider))).map(provider=><optgroup key={provider} label={provider}>{models.filter(model=>model.provider===provider).map(model=><option key={model.id} value={model.id}>{model.displayName}{model.recommended?" · Recommended":""}{model.highUsage?" · High AI Usage":""}</option>)}</optgroup>)}
    </select>
  </label>;
}

function createMessageId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createInitialMessages(knowledge: KnowledgePack, chatThread: ChatThread | null): ChatMessage[] {
  if (chatThread?.messages.length) {
    return chatThread.messages.map((item) => ({
      id: item.id,
      role: item.role,
      content: item.content,
      citations: item.citations,
      diagnostics: item.diagnostics,
    }));
  }

  return [{
    id: "assistant_welcome",
    role: "assistant",
    content: `Hi, I’m ${knowledge.assistantName}. Ask me anything about this business.`,
  }];
}

function getInitialUserMessageCount(chatThread: ChatThread | null): number {
  return chatThread?.messages.filter((item) => item.role === "user").length ?? 0;
}

function normalizeWords(value: string): string[] {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length > 2);
}

function buildPreviewAnswer(knowledge: KnowledgePack, question: string): string {
  const words = new Set(normalizeWords(question));
  const candidates = [
    ...knowledge.faq.map((item) => ({
      text: `${item.question} ${item.answer}`,
      answer: item.answer,
      label: item.question,
    })),
    ...knowledge.facts.map((item) => ({
      text: `${item.title} ${item.content}`,
      answer: item.content,
      label: item.title,
    })),
  ];

  const ranked = candidates
    .map((candidate) => ({
      ...candidate,
      score: normalizeWords(candidate.text).reduce((total, word) => total + (words.has(word) ? 1 : 0), 0),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);

  if (!ranked.length) {
    return "I don’t have an approved answer for that in this preview. Try asking about the business, its services, customers, policies, or other reviewed knowledge.";
  }

  if (ranked.length === 1) return ranked[0]!.answer;
  return ranked.map((item) => `${item.label}: ${item.answer}`).join("\n\n");
}

export default function AiBuilderDemoChat({
  knowledge: providedKnowledge,
  projectId: providedProjectId,
  chatThread: providedChatThread,
  onBack,
  demoMode = false,
  previewMode = false,
}: Props) {
  const workspace = useAiBuilderWorkspace();
  const knowledge = providedKnowledge ?? buildKnowledgePack(workspace.session);
  const projectId = providedProjectId ?? workspace.projectId;
  const chatThread = providedChatThread ?? {
    id: workspace.projectId,
    messages: workspace.messages,
  };
  const retrySubmissionRef = useRef<{message:string;idempotencyKey:string}|null>(null);
  const modalRootRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => createInitialMessages(knowledge, chatThread));
  const [userMessageCount, setUserMessageCount] = useState(() => getInitialUserMessageCount(chatThread));
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelId,setModelId]=useState("");
  const [modelChoices,setModelChoices]=useState<AiBuilderModelChoice[]>([]);
  const [promotingMessageId, setPromotingMessageId] = useState<string | null>(null);
  const [purchaseInterestSubmitted, setPurchaseInterestSubmitted] = useState(false);
  const [purchaseInterestSubmitting, setPurchaseInterestSubmitting] = useState(false);
  const [scrollbarMetrics, setScrollbarMetrics] = useState<ScrollbarMetrics>({ height: 40, top: 0 });
  const [scrollbarDragging, setScrollbarDragging] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const scrollbarTrackRef = useRef<HTMLDivElement>(null);
  const scrollbarDragRef = useRef<{ pointerY: number; scrollTop: number } | null>(null);
  const { showConfirm, confirmDialogNode } = useCanonicalConfirm();
  const suggestedQuestions=useMemo(()=>knowledge.faq.slice(0,3).map(item=>item.question).filter(Boolean),[knowledge.faq]);

  useEffect(() => {
    if (!previewMode) return;
    setMessages(createInitialMessages(knowledge, null));
    setUserMessageCount(0);
    setMessage("");
    setError(null);
  }, [knowledge, previewMode]);

  useEffect(()=>{if (demoMode || previewMode) return; void fetch("/api/ai-builder/models?purpose=test-assistant").then(r=>r.json()).then(payload=>{if(payload.ok){setModelChoices(payload.models);setModelId(payload.defaultModelId);}}).catch(()=>undefined);},[demoMode,previewMode]);
  async function selectModel(next:string){const choice=modelChoices.find(x=>x.id===next);if(!choice||sending)return;if(choice.highUsage){const confirmed=await showConfirm({title:"Use GPT-5.5 Pro?",message:"GPT-5.5 Pro uses significantly more AI usage than the other available models. Continue?",cancelLabel:"Cancel",confirmLabel:"Use GPT-5.5 Pro"});if(!confirmed)return;}setModelId(next);}

  useEffect(() => {
    const root = modalRootRef.current;
    if (!root || root.getClientRects().length === 0 || !window.matchMedia("(max-width: 1199.99px)").matches) return;
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyOverscroll = body.style.overscrollBehavior;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
      body.style.overscrollBehavior = previousBodyOverscroll;
    };
  }, []);

  const chatUnavailable = previewMode ? false : !chatThread?.id;
  const messageLimitReached = userMessageCount >= PROJECT_USER_MESSAGE_LIMIT;
  const remainingMessages = Math.max(PROJECT_USER_MESSAGE_LIMIT - userMessageCount, 0);

  const updateScrollbar = useCallback(() => {
    const element = chatScrollRef.current;
    const track = scrollbarTrackRef.current;
    if (!element || !track) return;
    const { clientHeight, scrollHeight, scrollTop } = element;
    const trackHeight = track.clientHeight;
    const maximumThumbHeight = Math.max(40, trackHeight * 0.35);
    const height = Math.max(40, Math.min(maximumThumbHeight, (clientHeight / scrollHeight) * trackHeight));
    const scrollRange = Math.max(scrollHeight - clientHeight, 0);
    const thumbRange = Math.max(trackHeight - height, 0);
    const top = scrollRange ? (scrollTop / scrollRange) * thumbRange : 0;
    setScrollbarMetrics({ height, top });
  }, []);

  useEffect(() => {
    const element = chatScrollRef.current;
    if (!element) return;
    updateScrollbar();
    element.addEventListener("scroll", updateScrollbar, { passive: true });
    const resizeObserver = new ResizeObserver(updateScrollbar);
    resizeObserver.observe(element);
    return () => {
      element.removeEventListener("scroll", updateScrollbar);
      resizeObserver.disconnect();
    };
  }, [updateScrollbar]);

  useEffect(() => {
    const element=chatScrollRef.current;
    if(!element)return;
    window.requestAnimationFrame(()=>{
      element.scrollTo({top:element.scrollHeight,behavior:"smooth"});
      updateScrollbar();
    });
  }, [messages, sending, updateScrollbar]);

  const startScrollbarDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const element = chatScrollRef.current;
    if (!element) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    scrollbarDragRef.current = { pointerY: event.clientY, scrollTop: element.scrollTop };
    setScrollbarDragging(true);
  };

  const dragScrollbar = (event: ReactPointerEvent<HTMLDivElement>) => {
    const element = chatScrollRef.current;
    const track = scrollbarTrackRef.current;
    const drag = scrollbarDragRef.current;
    if (!element || !track || !drag) return;
    const scrollRange = Math.max(element.scrollHeight - element.clientHeight, 0);
    const thumbRange = Math.max(track.clientHeight - scrollbarMetrics.height, 1);
    element.scrollTop = drag.scrollTop + (event.clientY - drag.pointerY) * (scrollRange / thumbRange);
  };

  const stopScrollbarDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    scrollbarDragRef.current = null;
    setScrollbarDragging(false);
  };

  useEffect(() => {
    if (demoMode || previewMode) return;
    let cancelled = false;
    const loadPurchaseInterestStatus = async () => {
      try {
        const result = await fetch(`/api/ai-builder/purchase-interest?projectId=${encodeURIComponent(projectId)}`, { method: "GET" });
        if (!result.ok) return;
        const payload = (await result.json()) as PurchaseInterestPayload;
        if (!cancelled) setPurchaseInterestSubmitted(Boolean(payload.ok && payload.alreadySubmitted));
      } catch {}
    };
    void loadPurchaseInterestStatus();
    return () => { cancelled = true; };
  }, [demoMode, previewMode, projectId]);

  const showAlreadySubmittedModal = async () => {
    await showConfirm({ title: "Request Already Sent", message: "We already received your request to discuss purchasing this AI assistant. We will contact you soon.", confirmLabel: "Request Sent", confirmDisabled: true, cancelLabel: "Cancel" });
  };

  const showPurchaseInterestModal = async (source: "limit" | "cta" = "limit") => {
    if (demoMode || previewMode) return;
    if (purchaseInterestSubmitted) { await showAlreadySubmittedModal(); return; }
    const confirmed = await showConfirm({
      title: source === "cta" ? "Purchase This AI Assistant" : "Assistant Test Complete",
      message: source === "cta" ? "You've seen how this AI assistant works and can request a custom version for your business.\n\nIf you submit a purchase request, we'll review your business, discuss your goals, and walk you through the next steps. There's no obligation, and we'll contact you to answer any questions before moving forward." : "You have reached the 20-message assistant test limit for this project. If you would like to purchase it, send a request and we will contact you to discuss the next steps.",
      confirmLabel: purchaseInterestSubmitting ? "Sending..." : source === "cta" ? "Send Purchase Request" : "Discuss Purchasing",
      cancelLabel: "Cancel",
    });
    if (!confirmed || purchaseInterestSubmitting) return;
    setPurchaseInterestSubmitting(true);
    setError(null);
    try {
      const result = await fetch("/api/ai-builder/purchase-interest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId }) });
      const payload = (await result.json()) as PurchaseInterestPayload;
      if (!result.ok || !payload.ok) throw new Error(payload.error?.message || "Your purchase request could not be sent.");
      setPurchaseInterestSubmitted(true);
      await showAlreadySubmittedModal();
    } catch (purchaseError) {
      setError(purchaseError instanceof Error ? purchaseError.message : "Your purchase request could not be sent.");
    } finally { setPurchaseInterestSubmitting(false); }
  };

  const promoteForReview = async (item: ChatMessage) => {
    if (demoMode || previewMode) return;
    if (!chatThread || item.role !== "user" || promotingMessageId) return;
    const statement = item.content.trim();
    if (!statement) return;
    setPromotingMessageId(item.id); setError(null);
    try {
      const response = await fetch("/api/ai-builder/conversation-promotions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, threadId: chatThread.id, messageId: item.id, statement, claimType: "fact", category: "business", title: statement.slice(0, 120), confidence: "medium", confidenceScore: 0.5, commandId: `conversation_promotion_${crypto.randomUUID()}` }) });
      const payload = await response.json() as { ok?: boolean; error?: { message?: string } };
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || "The statement could not be queued for review.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The statement could not be queued for review."); }
    finally { setPromotingMessageId(null); }
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (demoMode) return;
    const normalizedMessage = message.trim();
    if (!normalizedMessage || sending || chatUnavailable) return;

    if (previewMode) {
      const userMessage: ChatMessage = { id: createMessageId("user"), role: "user", content: normalizedMessage };
      setMessages((current) => current.concat(userMessage));
      setMessage("");
      setError(null);
      setSending(true);
      await new Promise((resolve) => window.setTimeout(resolve, 550));
      setMessages((current) => current.concat({
        id: createMessageId("assistant"),
        role: "assistant",
        content: buildPreviewAnswer(knowledge, normalizedMessage),
      }));
      setUserMessageCount((current) => current + 1);
      setSending(false);
      return;
    }

    if (!chatThread?.id) return;
    if (messageLimitReached) { await showPurchaseInterestModal(); return; }
    const temporaryUserMessageId = createMessageId("user");
    const logicalSubmission=retrySubmissionRef.current?.message===normalizedMessage?retrySubmissionRef.current:{message:normalizedMessage,idempotencyKey:crypto.randomUUID()};
    retrySubmissionRef.current=logicalSubmission;
    const userMessage: ChatMessage = { id: temporaryUserMessageId, role: "user", content: normalizedMessage };
    setMessages((current) => current.concat(userMessage));
    setMessage("");
    setError(null);
    setSending(true);

    try {
      const result = await fetch("/api/ai-builder/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ knowledge, projectId, threadId: chatThread.id, idempotencyKey: logicalSubmission.idempotencyKey, message: normalizedMessage, modelId }) });
      const payload = (await result.json()) as ChatApiPayload;
      if (!result.ok || !payload.ok || !payload.response) {
        if (payload.error?.code === "project_message_limit_reached") {
          setUserMessageCount(payload.usage?.userMessageCount ?? PROJECT_USER_MESSAGE_LIMIT);
          setMessages((current) => current.filter((item) => item.id !== temporaryUserMessageId));
          setMessage(normalizedMessage);
          retrySubmissionRef.current=null;
          await showPurchaseInterestModal();
          return;
        }
        throw new Error(payload.error?.message || "The assistant could not answer that question.");
      }
      const chatResponse = payload.response;
      const persistedMessages = payload.persistedMessages;
      setMessages((current) => {
        const withPersistedUserId = current.map((item) => item.id === temporaryUserMessageId && persistedMessages?.userMessageId ? { ...item, id: persistedMessages.userMessageId } : item);
        return withPersistedUserId.concat({ id: persistedMessages?.assistantMessageId ?? createMessageId("assistant"), role: "assistant", content: chatResponse.answer, citations: chatResponse.citations, diagnostics: chatResponse.diagnostics });
      });
      const nextUserMessageCount = payload.usage?.userMessageCount ?? userMessageCount + 1;
      setUserMessageCount(nextUserMessageCount);
      retrySubmissionRef.current=null;
      if (nextUserMessageCount >= PROJECT_USER_MESSAGE_LIMIT) await showPurchaseInterestModal();
    } catch (sendError) {
      setMessages((current) => current.filter((item) => item.id !== temporaryUserMessageId));
      setMessage(normalizedMessage);
      setError(sendError instanceof Error ? sendError.message : "The assistant could not answer that question.");
    } finally { setSending(false); }
  };

  const handleComposerKeyDown=(event:ReactKeyboardEvent<HTMLTextAreaElement>)=>{
    if(event.key!=="Enter"||event.shiftKey)return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  return (
    <div ref={modalRootRef} className="fixed inset-0 z-[80] flex min-h-0 flex-col overflow-hidden bg-[#000000] xl:static xl:z-auto xl:h-full xl:bg-transparent">
      <header className="relative flex min-h-[76px] flex-none flex-col items-center justify-center gap-1.5 border-b border-white/[0.08] bg-black px-5 py-2 pr-14 sm:px-8 sm:pr-16">
        <p className="text-center text-[0.65rem] font-bold uppercase tracking-[0.24em] text-amber-300">{previewMode ? "Business Brain preview" : "Live assistant test"}</p>
        {!previewMode ? <AiBuilderModelSelect models={modelChoices} value={modelId} disabled={sending} onChange={next=>void selectModel(next)} /> : <p className="text-xs text-slate-500">Deterministic preview. No AI reasoning or persistence.</p>}
        <button type="button" onClick={onBack} aria-label="Close live assistant test" className="absolute right-5 top-1/2 -translate-y-1/2 text-3xl font-light leading-none text-slate-300 transition hover:text-white xl:hidden">×</button>
      </header>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#000000]">
        <div className="relative min-h-0 flex-1">
          <div ref={chatScrollRef} style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }} className="ai-builder-chat-scrollbar h-full min-h-0 touch-pan-y space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-6 [&::-webkit-scrollbar]:hidden">
          {messages.map((item) => (
            <div key={item.id} className={item.role === "user" ? "ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md border border-amber-300/25 bg-[#0d0d0d] px-4 py-3 text-sm font-medium leading-6 text-slate-100 shadow-[0_10px_24px_rgba(0,0,0,.2)] sm:max-w-[68%]" : "w-fit max-w-[85%] rounded-2xl rounded-bl-md border border-amber-300/25 bg-[#0a0a0a] px-4 py-3 text-sm leading-6 text-slate-200 shadow-[0_10px_24px_rgba(0,0,0,.2)] sm:max-w-[68%]"}>
              <p className="whitespace-pre-wrap">{item.content}</p>
              {item.role === "user" && chatThread && !previewMode ? <button type="button" onClick={() => void promoteForReview(item)} disabled={Boolean(promotingMessageId)} className="mt-2 text-xs font-semibold text-amber-200 underline decoration-amber-300/40 underline-offset-4 disabled:opacity-50">{promotingMessageId === item.id ? "Queuing for review…" : "Promote for review"}</button> : null}
            </div>
          ))}

          {sending ? (
            <div className="flex min-h-[48px] w-fit max-w-[85%] items-center gap-3 rounded-2xl rounded-bl-md border border-amber-300/25 bg-[#0a0a0a] px-4 py-3 text-sm text-slate-400 shadow-[0_10px_24px_rgba(0,0,0,.2)] sm:max-w-[68%]">
              <span>{knowledge.assistantName} is thinking</span>
              <span className="flex gap-1" aria-hidden="true"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300/70" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300/70 [animation-delay:150ms]" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300/70 [animation-delay:300ms]" /></span>
            </div>
          ) : null}
          </div>

          <div ref={scrollbarTrackRef} className="hidden" aria-hidden="true">
            <div onPointerDown={startScrollbarDrag} onPointerMove={dragScrollbar} onPointerUp={stopScrollbarDrag} onPointerCancel={stopScrollbarDrag} className={`absolute ${scrollbarDragging ? "cursor-grabbing" : "cursor-grab"}`} style={{ height: `${scrollbarMetrics.height}px`, transform: `translateY(${scrollbarMetrics.top}px)` }} />
          </div>
        </div>

        <form onSubmit={sendMessage} className="flex-none border-t border-white/[0.08] p-4 sm:p-5">
          {chatUnavailable ? <div className="mb-3 rounded-xl border border-red-400/20 bg-red-400/[0.07] px-4 py-3 text-sm text-red-200">This conversation could not be loaded. Return to the project and try again.</div> : null}
          {error ? <div className="mb-3 rounded-xl border border-red-400/20 bg-red-400/[0.07] px-4 py-3 text-sm text-red-200">{error}</div> : null}

          {previewMode && suggestedQuestions.length ? <div className="mx-auto mb-3 flex max-w-3xl flex-wrap justify-center gap-2">{suggestedQuestions.map(question=><button key={question} type="button" onClick={()=>setMessage(question)} disabled={sending} className="rounded-full border border-white/[0.08] bg-black px-3 py-1.5 text-xs text-slate-300 transition hover:border-amber-300/25 hover:text-white disabled:opacity-50">{question}</button>)}</div>:null}

          {!previewMode ? (
            <div className="mx-auto mb-3 flex max-w-3xl flex-wrap items-center justify-between gap-3">
              <ModelSelectControl models={modelChoices} value={modelId} disabled={sending} onChange={next=>void selectModel(next)} className="hidden xl:flex" />
              <span className="text-xs font-semibold text-slate-500">{messageLimitReached ? "20 of 20 messages used" : `${remainingMessages} of 20 messages remaining`}</span>
            </div>
          ) : null}

          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-amber-300/25 bg-[#0a0a0a] p-2 shadow-[0_12px_32px_rgba(0,0,0,.22)]">
            <textarea rows={2} value={message} onKeyDown={handleComposerKeyDown} onChange={(event) => { setMessage(event.target.value); retrySubmissionRef.current=null; }} disabled={chatUnavailable || sending} placeholder="Ask about services, pricing, policies, or the business..." className="min-h-[52px] flex-1 resize-none border-0 bg-transparent px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50" />
            <button type="submit" disabled={chatUnavailable || sending || !message.trim()} className="min-h-[52px] rounded-xl border border-amber-300/15 bg-[#080808] px-5 py-3 font-bold text-white shadow-[0_8px_20px_rgba(0,0,0,.24)] transition hover:border-amber-300/30 hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-40">Send</button>
          </div>
          <p className="mx-auto mt-2 max-w-3xl text-center text-[0.68rem] text-slate-600">Press Enter to send. Use Shift+Enter for a new line.</p>
        </form>
      </section>

      {confirmDialogNode}
    </div>
  );
}
