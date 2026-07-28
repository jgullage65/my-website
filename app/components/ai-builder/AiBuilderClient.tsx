"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
import type { ReviewCommandRequest } from "@/app/lib/ai-engine/business-memory/review-commands";
import type { ChatDiagnostics } from "@/app/lib/ai-engine/chat";
import type {
  PersistedWebsiteKnowledge,
  StructuredWebsiteKnowledge,
  WebsiteKnowledgePage,
} from "@/app/lib/ai-engine/knowledge/websiteKnowledge";
import { buildKnowledgePack } from "@/app/lib/ai-engine/knowledge";
import AiBuilderShell from "./AiBuilderShell";
import AiBuilderForm from "./AiBuilderForm";
import AiBuilderProgress from "./AiBuilderProgress";
import AiBuilderReview from "./AiBuilderReview";
import AiBuilderDesktopScrollArea from "./AiBuilderDesktopScrollArea";
import AiBuilderDemoChat from "./AiBuilderDemoChat";
import AiBuilderDashboard from "./AiBuilderDashboard";
import AiBuilderProjectInsights, { type ProjectDiagnostics } from "./AiBuilderProjectInsights";
import AiBuilderAuthCta from "./AiBuilderAuthCta";
import "./AiBuilderFormOverrides.css";
import type { WebsiteSourceBlockRecord, WebsiteSourceDocumentRecord } from "@/app/lib/ai-engine/crawler/websiteSourceRecords";

export type UserKnowledge = {
  productsServices: string;
  idealCustomers: string;
  additionalKnowledge: string;
};

export type WebsiteKnowledge = {
  businessName: string;
  industry: string;
  website: string;
  requestedUrl: string;
  resolvedUrl: string;
  productsServices: string;
  idealCustomers: string;
  additionalKnowledge: string;
  knowledge?: StructuredWebsiteKnowledge;
  pages: WebsiteKnowledgePage[];
  warnings: string[];
  importedAt: string;
  crawlAttemptId?: string;
  sourceDocuments?:WebsiteSourceDocumentRecord[];
  sourceBlocks?:WebsiteSourceBlockRecord[];
};

export type BuilderState = {
  businessName: string;
  industry: string;
  website: string;
  tone: string;
  userKnowledge: UserKnowledge;
  websiteKnowledge: WebsiteKnowledge | null;
  crawlAttemptIds: string[];
};

type BuilderStep = "form" | "loading" | "building" | "results" | "review" | "chat";
type WorkspaceTab = "dashboard" | "insights" | "overview" | "knowledge" | "sources" | "settings";
type SaveStatus = "idle" | "saving" | "saved" | "error";

export type ReviewCommandPending = ReadonlySet<string>;

type StoredChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: string[];
  diagnostics?: ChatDiagnostics;
  createdAt: string;
};

type ChatThread = {
  id: string;
  messages: StoredChatMessage[];
};

type ProjectResponse = {
  ok?: boolean;
  projectId?: string;
  session?: AiBuilderSession;
  builder?: {
    businessName?: string;
    industry?: string;
    website?: string;
    tone?: string;
  };
  websiteKnowledge?: PersistedWebsiteKnowledge | null;
  chatThread?: ChatThread | null;
  diagnostics?: ProjectDiagnostics;
  error?: { code?: string; message?: string };
};

type Props = {
  initialProjectId?: string | null;
};

const initial: BuilderState = {
  businessName: "",
  industry: "",
  website: "",
  tone: "Professional",
  userKnowledge: {
    productsServices: "",
    idealCustomers: "",
    additionalKnowledge: "",
  },
  websiteKnowledge: null,
  crawlAttemptIds: [],
};

const WORKSPACE_ITEMS: ReadonlyArray<readonly [WorkspaceTab, string]> = [
  ["dashboard", "Dashboard"],
  ["insights", "Project Insights"],
  ["overview", "Overview"],
  ["knowledge", "Business Knowledge"],
  ["sources", "Sources"],
  ["settings", "Settings"],
];

const WORKSPACE_DESCRIPTIONS: Record<WorkspaceTab, string> = {
  dashboard: "Priorities, readiness, and recent project changes",
  insights: "Crawl, generation, governance, and activity diagnostics",
  overview: "Build status and generated project totals",
  knowledge: "Review and govern the assistant’s business memory",
  sources: "Connected source material and website imports",
  settings: "Project configuration and preferences",
};

async function fetchProject(projectId: string): Promise<ProjectResponse> {
  const response = await fetch(
    `/api/ai-builder/projects/${encodeURIComponent(projectId)}`,
    { cache: "no-store" },
  );
  const payload = (await response.json()) as ProjectResponse;
  if (!response.ok || !payload.ok || !payload.session) {
    throw new Error(payload.error?.message || "The AI Builder project could not be loaded.");
  }
  return payload;
}

export default function AiBuilderClient({ initialProjectId = null }: Props) {
  const [step, setStep] = useState<BuilderStep>(initialProjectId ? "loading" : "form");
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("dashboard");
  const [mobileWorkspaceMenuOpen, setMobileWorkspaceMenuOpen] = useState(false);
  const [builder, setBuilder] = useState(initial);
  const [session, setSession] = useState<AiBuilderSession | null>(null);
  const [chatThread, setChatThread] = useState<ChatThread | null>(null);
  const [diagnostics,setDiagnostics]=useState<ProjectDiagnostics|null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingReviewItems, setPendingReviewItems] = useState<ReviewCommandPending>(new Set());
  const [buildPercent, setBuildPercent] = useState(0);
  const authoritativeRevisionRef = useRef(0);
  const pendingReviewItemsRef = useRef(new Set<string>());
  const reviewCommandQueueRef = useRef<Promise<void>>(Promise.resolve());

  const submitReviewCommand = useCallback((command: ReviewCommandRequest) => {
    const pendingKey = `${command.itemKind}:${command.itemId}`;
    if (pendingReviewItemsRef.current.has(pendingKey)) {
      return Promise.reject(new Error("A review command is already pending for this item."));
    }

    pendingReviewItemsRef.current.add(pendingKey);
    setPendingReviewItems(new Set(pendingReviewItemsRef.current));
    setSaveStatus("saving");
    setSaveError(null);

    const queuedCommand = reviewCommandQueueRef.current.then(async () => {
      try {
        const authoritativeCommand = {
          ...command,
          clientRevision: authoritativeRevisionRef.current,
        };
        const response = await fetch(
          `/api/ai-builder/projects/${encodeURIComponent(command.projectId)}/review-commands`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(authoritativeCommand),
          },
        );
        const payload = (await response.json()) as {
          ok?: boolean;
          item?: Record<string, unknown>;
          governanceRevision?: number;
          contextCounts?: AiBuilderSession["contextCounts"];
          status?: AiBuilderSession["status"];
          error?: { message?: string };
        };
        if (!response.ok || !payload.ok || !payload.item) {
          throw new Error(payload.error?.message || "The review command could not be saved.");
        }

        authoritativeRevisionRef.current =
          payload.governanceRevision ?? authoritativeCommand.clientRevision;

        setSession((current) => {
          if (!current) return current;
          const item = payload.item!;
          const updated = {
            ...current,
            governanceRevision: payload.governanceRevision ?? current.governanceRevision,
            contextCounts: payload.contextCounts ?? current.contextCounts,
            status: payload.status ?? current.status,
          };

          if (command.itemKind === "context_entry") {
            const canonicalEntry = {
              ...current.contextEntries.find((entry) => entry.id === command.itemId),
              id: command.itemId,
              category: String(item.category) as AiBuilderSession["contextEntries"][number]["category"],
              title: String(item.title),
              content: String(item.content),
              status: String(item.status) as AiBuilderSession["contextEntries"][number]["status"],
              updatedAt: new Date(String(item.updated_at)).toISOString(),
            } as AiBuilderSession["contextEntries"][number];
            const position = current.contextEntries.findIndex((entry) => entry.id === command.itemId);
            updated.contextEntries = current.contextEntries.filter((entry) => entry.id !== command.itemId);
            updated.contextEntries.splice(position < 0 ? updated.contextEntries.length : position, 0, canonicalEntry);
          } else {
            const canonicalEntry = {
              ...current.faqEntries.find((entry) => entry.id === command.itemId),
              id: command.itemId,
              question: String(item.question),
              answer: String(item.answer),
              status: String(item.status) as AiBuilderSession["faqEntries"][number]["status"],
              updatedAt: new Date(String(item.updated_at)).toISOString(),
            } as AiBuilderSession["faqEntries"][number];
            const position = current.faqEntries.findIndex((entry) => entry.id === command.itemId);
            updated.faqEntries = current.faqEntries.filter((entry) => entry.id !== command.itemId);
            updated.faqEntries.splice(position < 0 ? updated.faqEntries.length : position, 0, canonicalEntry);
          }
          return updated;
        });
        setSaveStatus("saved");
      } catch (commandError) {
        setSaveStatus("error");
        setSaveError(
          commandError instanceof Error
            ? commandError.message
            : "The review command could not be saved.",
        );
        throw commandError;
      }
    });

    reviewCommandQueueRef.current = queuedCommand.catch(() => undefined);
    return queuedCommand.finally(() => {
      pendingReviewItemsRef.current.delete(pendingKey);
      setPendingReviewItems(new Set(pendingReviewItemsRef.current));
    });
  }, []);

  useEffect(() => {
    if (session) authoritativeRevisionRef.current = session.governanceRevision ?? 0;
  }, [session]);

  useEffect(() => {
    if (!mobileWorkspaceMenuOpen) return;
    const closeMenu = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileWorkspaceMenuOpen(false);
    };
    window.addEventListener("keydown", closeMenu);
    return () => window.removeEventListener("keydown", closeMenu);
  }, [mobileWorkspaceMenuOpen]);

  const navigateToStep = useCallback((nextStep: BuilderStep) => {
    setStep(nextStep);
    if (nextStep === "results" || nextStep === "review" || nextStep === "chat") {
      const url = new URL(window.location.href);
      url.searchParams.set("step", nextStep);
      window.history.replaceState(null, "", url.toString());
    }
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  }, []);

  const selectWorkspaceTab = useCallback((nextTab: WorkspaceTab) => {
    setWorkspaceTab(nextTab);
    setMobileWorkspaceMenuOpen(false);
    if (nextTab === "knowledge") {
      navigateToStep("review");
    } else if (nextTab === "overview") {
      navigateToStep("results");
    } else if (step === "review") {
      navigateToStep("results");
    }
  }, [navigateToStep, step]);

  useEffect(() => {
    if (step !== "building") return;
    const timer = window.setInterval(() => {
      setBuildPercent((current) => {
        if (current >= 75) return current;
        if (current < 20) return current + 2;
        if (current < 50) return current + 1;
        return current + 0.5;
      });
    }, 700);
    return () => window.clearInterval(timer);
  }, [step]);

  const knowledgePack = useMemo(
    () => (session?.status === "ready" ? buildKnowledgePack(session) : null),
    [session],
  );

  useEffect(() => {
    if (!initialProjectId) return;
    let active = true;
    void fetchProject(initialProjectId)
      .then((payload) => {
        if (!active || !payload.session) return;
        setSession(payload.session);
        setChatThread(payload.chatThread ?? null);
        setDiagnostics(payload.diagnostics ?? null);
        setBuilder((current) => ({
          ...current,
          businessName: payload.builder?.businessName ?? current.businessName,
          industry: payload.builder?.industry ?? current.industry,
          website: payload.builder?.website ?? current.website,
          tone: payload.builder?.tone ?? current.tone,
        }));
        const requestedStep = new URL(window.location.href).searchParams.get("step");
        setStep(
          requestedStep === "chat" || requestedStep === "review" || requestedStep === "results"
            ? requestedStep
            : "results",
        );
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "The AI Builder project could not be loaded.");
        setStep("form");
      });
    return () => {
      active = false;
    };
  }, [initialProjectId]);

  const reviewSaveStatus = pendingReviewItems.size > 0 ? "saving" : saveStatus;

  const buildAi = async () => {
    setError(null);
    setBuildPercent(5);
    setStep("building");

    try {
      const response = await fetch("/api/ai-builder/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(builder),
      });

      if (!response.body) throw new Error("The AI builder did not return a response stream.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let payload: { ok?: boolean; projectId?: string; session?: AiBuilderSession; error?: { message?: string } } | null = null;

      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as {
            type: "progress" | "result" | "error";
            percent?: number;
            ok?: boolean;
            projectId?: string;
            session?: AiBuilderSession;
            error?: { message?: string };
          };
          if (event.type === "progress") {
            setBuildPercent((current) => Math.max(current, event.percent ?? 0));
          }
          if (event.type === "error") {
            throw new Error(event.error?.message || "The AI builder could not process this information.");
          }
          if (event.type === "result") payload = event;
        }
        if (done) break;
      }

      if (!payload?.ok || !payload.session) {
        throw new Error(payload?.error?.message || "The AI builder could not process this information.");
      }

      const projectId = payload.projectId ?? payload.session.id;
      setSession(payload.session);
      setStep("results");
      const url = new URL(window.location.href);
      url.searchParams.set("projectId", projectId);
      url.searchParams.set("step", "results");
      window.history.replaceState(null, "", url.toString());

      try {
        const savedProject = await fetchProject(projectId);
        setSession(savedProject.session ?? payload.session);
        setChatThread(savedProject.chatThread ?? null);
        setDiagnostics(savedProject.diagnostics ?? null);
      } catch (projectLoadError) {
        console.error("AI_BUILDER_NEW_PROJECT_RELOAD_FAILED", {
          projectId,
          message:
            projectLoadError instanceof Error ? projectLoadError.message : "unknown_error",
        });
        setChatThread(null);
      }
    } catch (buildError) {
      setSession(null);
      setChatThread(null);
      setError(
        buildError instanceof Error
          ? buildError.message
          : "The AI builder could not process this information.",
      );
      setStep("form");
    }
  };

  const desktopWorkspace = session && knowledgePack ? (
    <div className="hidden h-full min-h-0 w-full overflow-hidden border-y border-white/[0.08] bg-[#020202] xl:grid xl:grid-cols-[208px_minmax(0,1fr)_400px] min-[1500px]:grid-cols-[220px_minmax(0,1fr)_420px]">
      <aside className="border-r border-white/[0.08] bg-[#050505] px-4 py-5">
        <button
          type="button"
          onClick={() => window.location.assign("/ai-builder")}
          className="mb-7 inline-flex items-center text-xs font-semibold text-slate-500 transition hover:text-white"
        >
          ← All Projects
        </button>
        <div className="mb-5 border-b border-white/[0.08] px-3 pb-5">
          <p className="truncate text-sm font-semibold text-slate-200">{builder.businessName || "AI Builder Project"}</p>
          <p className="mt-1 truncate text-xs text-slate-600">{builder.website || builder.industry || "Project workspace"}</p>
        </div>
        <p className="px-3 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-slate-600">Workspace</p>
        <nav className="mt-3 space-y-0.5">
          {WORKSPACE_ITEMS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => selectWorkspaceTab(value)}
              className={`relative w-full rounded-lg px-3 py-2.5 text-left text-[0.82rem] font-semibold transition ${
                workspaceTab === value
                  ? "bg-white/[0.055] text-amber-200 before:absolute before:bottom-2 before:left-0 before:top-2 before:w-0.5 before:rounded-full before:bg-amber-300"
                  : "text-slate-500 hover:bg-white/[0.035] hover:text-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-col bg-[#020202]">
        <header className="flex min-h-[76px] flex-none items-center border-b border-white/[0.08] px-6 py-3 min-[1400px]:px-8">
          <div className="min-w-0 max-w-full">
            <h1 className="truncate text-base font-semibold text-slate-100">{WORKSPACE_ITEMS.find(([value]) => value === workspaceTab)?.[1]}</h1>
            <p className="mt-1 truncate text-xs leading-5 text-slate-500">{WORKSPACE_DESCRIPTIONS[workspaceTab]}</p>
          </div>
        </header>

        <AiBuilderDesktopScrollArea>
          {workspaceTab === "dashboard" ? (
            <AiBuilderDashboard session={session} websiteKnowledge={builder.websiteKnowledge ? {schema_version:2,document_version:1,current_crawl_attempt_id:builder.websiteKnowledge.crawlAttemptId??null,imported_at:builder.websiteKnowledge.importedAt,requested_url:builder.websiteKnowledge.requestedUrl,resolved_url:builder.websiteKnowledge.resolvedUrl,pages:builder.websiteKnowledge.pages,warnings:builder.websiteKnowledge.warnings,knowledge:builder.websiteKnowledge.knowledge??{facts:[],coverage:{} as PersistedWebsiteKnowledge["knowledge"]["coverage"],unresolvedQuestions:[]},source_documents:builder.websiteKnowledge.sourceDocuments,source_blocks:builder.websiteKnowledge.sourceBlocks}:null} messages={chatThread?.messages??[]} diagnostics={diagnostics} onNavigate={(destination)=>{if(destination==="assistant"){document.querySelector<HTMLTextAreaElement>('textarea[placeholder^="Ask about"]')?.focus();return;}setWorkspaceTab(destination);}} />
          ) : workspaceTab === "insights" ? (
            <AiBuilderProjectInsights session={session} diagnostics={diagnostics} messageCount={chatThread?.messages.length??0} />
          ) : workspaceTab === "knowledge" ? (
            <>
              {reviewSaveStatus !== "idle" || saveError ? (
                <div
                  className={`mb-4 rounded-xl border px-4 py-3 text-center text-sm ${
                    reviewSaveStatus === "error"
                      ? "border-red-500/30 bg-red-500/10 text-red-200"
                      : "border-white/[0.08] bg-[#050505] text-slate-400"
                  }`}
                  role={reviewSaveStatus === "error" ? "alert" : "status"}
                  aria-live="polite"
                >
                  {reviewSaveStatus === "saving"
                    ? "Applying review command..."
                    : reviewSaveStatus === "saved"
                      ? "Review command applied."
                      : saveError}
                </div>
              ) : null}
              <div>
                <AiBuilderReview
                  session={session}
                  onReviewCommand={submitReviewCommand}
                  pendingReviewItems={pendingReviewItems}
                  onBack={() => setWorkspaceTab("overview")}
                  onLaunchChat={() => undefined}
                  showLaunchChat={false}
                  embedded
                />
              </div>
            </>
          ) : workspaceTab === "overview" ? (
            <AiBuilderProgress
              builder={builder}
              session={session}
              complete
              percent={100}
              onReview={() => setWorkspaceTab("knowledge")}
              embedded
            />
          ) : (
            <div className="flex min-h-full items-center justify-center rounded-3xl border border-white/10 bg-[#000000] p-8 text-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-300">{workspaceTab}</p>
                <h2 className="mt-3 text-2xl font-bold text-white">This workspace is ready for its next module.</h2>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">
                  The permanent desktop shell is in place without changing the existing backend flow.
                </p>
              </div>
            </div>
          )}
        </AiBuilderDesktopScrollArea>
      </main>

      <aside className="flex min-h-0 flex-col border-l border-white/[0.08] bg-black">
        <div className="min-h-0 flex-1 [&>div]:flex [&>div]:h-full [&>div]:max-w-none [&>div]:flex-col [&>div]:space-y-0 [&>div>section:last-of-type]:flex [&>div>section:last-of-type]:min-h-0 [&>div>section:last-of-type]:flex-1 [&>div>section:last-of-type]:flex-col [&>div>section:last-of-type]:rounded-none [&>div>section:last-of-type]:border-0 [&>div>section:last-of-type>div.relative]:min-h-0 [&>div>section:last-of-type>div.relative]:flex-1 [&_.ai-builder-chat-scrollbar]:h-full [&_.ai-builder-chat-scrollbar]:min-h-0 [&_.ai-builder-chat-scrollbar]:max-h-none">
          <AiBuilderDemoChat
            knowledge={knowledgePack}
            projectId={session.id}
            chatThread={chatThread}
            onBack={() => undefined}
          />
        </div>
      </aside>
    </div>
  ) : null;

  return (
    <AiBuilderShell>
      {step === "loading" ? (
        <div className="relative mx-auto max-w-3xl rounded-[30px] border border-amber-300/20 bg-[#000000] px-6 py-12 text-center shadow-[0_24px_90px_rgba(0,0,0,0.34),0_0_50px_rgba(245,158,11,0.06)]">
          <AiBuilderAuthCta />
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-300">Loading AI project</p>
          <p className="mt-4 text-base text-slate-400">Restoring your saved business knowledge.</p>
        </div>
      ) : null}

      {step === "form" ? (
        <div className="ai-builder-form">
          {error ? <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
          <AiBuilderForm value={builder} projectId={session?.id??initialProjectId} onChange={setBuilder} onBuild={buildAi} />
        </div>
      ) : null}

      {step === "building" ? (
        <AiBuilderProgress builder={builder} session={null} complete={false} percent={buildPercent} onReview={() => undefined} />
      ) : null}

      {session && (step === "results" || step === "review" || step === "chat") ? desktopWorkspace : null}

      <div className="xl:hidden">
        {session && knowledgePack && step !== "chat" ? (
          <div className="min-h-[70vh] bg-black">
            <header className="sticky top-0 z-40 flex min-h-[68px] items-center justify-between gap-4 border-b border-white/[0.08] bg-black/95 px-4 backdrop-blur sm:px-6">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{WORKSPACE_ITEMS.find(([value]) => value === workspaceTab)?.[1]}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{builder.businessName || "AI Builder Project"}</p>
              </div>
              <button type="button" onClick={() => setMobileWorkspaceMenuOpen(true)} aria-haspopup="dialog" aria-expanded={mobileWorkspaceMenuOpen} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/[0.1] bg-[#080808] px-3.5 text-xs font-semibold text-slate-200">
                <span aria-hidden="true" className="text-base leading-none">☰</span>
                Workspace
              </button>
            </header>

            {mobileWorkspaceMenuOpen ? (
              <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMobileWorkspaceMenuOpen(false); }}>
                <aside role="dialog" aria-modal="true" aria-label="Project workspace navigation" className="ml-auto flex h-full w-[min(22rem,88vw)] flex-col border-l border-white/[0.1] bg-[#050505] p-5 shadow-[-20px_0_60px_rgba(0,0,0,.45)]">
                  <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-5">
                    <div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{builder.businessName || "AI Builder Project"}</p><p className="mt-1 truncate text-xs text-slate-500">{builder.website || builder.industry || "Project workspace"}</p></div>
                    <button type="button" onClick={() => setMobileWorkspaceMenuOpen(false)} aria-label="Close workspace menu" className="text-2xl font-light leading-none text-slate-400 hover:text-white">×</button>
                  </div>
                  <nav className="mt-5 space-y-1">
                    {WORKSPACE_ITEMS.map(([value, label]) => <button key={value} type="button" onClick={() => selectWorkspaceTab(value)} className={`relative w-full rounded-lg px-3 py-3 text-left text-sm font-semibold transition ${workspaceTab === value ? "bg-white/[0.06] text-amber-200 before:absolute before:bottom-2 before:left-0 before:top-2 before:w-0.5 before:rounded-full before:bg-amber-300" : "text-slate-400 hover:bg-white/[0.035] hover:text-white"}`}>{label}</button>)}
                  </nav>
                </aside>
              </div>
            ) : null}

            <main className="px-4 py-5 sm:px-6 sm:py-6">
              {workspaceTab === "dashboard" ? <AiBuilderDashboard session={session} websiteKnowledge={builder.websiteKnowledge ? {schema_version:2,document_version:1,current_crawl_attempt_id:builder.websiteKnowledge.crawlAttemptId??null,imported_at:builder.websiteKnowledge.importedAt,requested_url:builder.websiteKnowledge.requestedUrl,resolved_url:builder.websiteKnowledge.resolvedUrl,pages:builder.websiteKnowledge.pages,warnings:builder.websiteKnowledge.warnings,knowledge:builder.websiteKnowledge.knowledge??{facts:[],coverage:{} as PersistedWebsiteKnowledge["knowledge"]["coverage"],unresolvedQuestions:[]},source_documents:builder.websiteKnowledge.sourceDocuments,source_blocks:builder.websiteKnowledge.sourceBlocks}:null} messages={chatThread?.messages??[]} diagnostics={diagnostics} onNavigate={(destination)=>{if(destination==="assistant"){navigateToStep("chat");return;}selectWorkspaceTab(destination);}} /> : null}
              {workspaceTab === "insights" ? <AiBuilderProjectInsights session={session} diagnostics={diagnostics} messageCount={chatThread?.messages.length??0} /> : null}
              {workspaceTab === "overview" ? <AiBuilderProgress builder={builder} session={session} complete percent={100} onReview={() => selectWorkspaceTab("knowledge")} /> : null}
              {workspaceTab === "knowledge" ? <>{reviewSaveStatus !== "idle" || saveError ? <div className={`mb-4 rounded-xl border px-4 py-3 text-center text-sm ${reviewSaveStatus === "error" ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-white/[0.08] bg-[#050505] text-slate-400"}`} role={reviewSaveStatus === "error" ? "alert" : "status"} aria-live="polite">{reviewSaveStatus === "saving" ? "Applying review command..." : reviewSaveStatus === "saved" ? "Review command applied." : saveError}</div> : null}<AiBuilderReview session={session} onReviewCommand={submitReviewCommand} pendingReviewItems={pendingReviewItems} onBack={() => selectWorkspaceTab("overview")} onLaunchChat={() => navigateToStep("chat")} /></> : null}
              {workspaceTab === "sources" || workspaceTab === "settings" ? <div className="flex min-h-[50vh] items-center justify-center rounded-2xl border border-white/[0.08] bg-[#050505] p-6 text-center"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-300">{workspaceTab}</p><p className="mt-3 text-sm leading-6 text-slate-400">{WORKSPACE_DESCRIPTIONS[workspaceTab]}</p></div></div> : null}
            </main>
          </div>
        ) : null}

        {step === "chat" && knowledgePack && session ? (
          <AiBuilderDemoChat knowledge={knowledgePack} projectId={session.id} chatThread={chatThread} onBack={() => { setWorkspaceTab("knowledge"); navigateToStep("review"); }} />
        ) : null}
      </div>
    </AiBuilderShell>
  );
}
