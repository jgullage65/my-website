"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
import AiBuilderDemoChat from "./AiBuilderDemoChat";
import AiBuilderAuthCta from "./AiBuilderAuthCta";
import "./AiBuilderFormOverrides.css";

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

type BuilderStep =
  | "form"
  | "loading"
  | "building"
  | "results"
  | "review"
  | "chat";

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
  error?: {
    code?: string;
    message?: string;
  };
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

async function fetchProject(
  projectId: string,
): Promise<ProjectResponse> {
  const response = await fetch(
    `/api/ai-builder/projects/${encodeURIComponent(projectId)}`,
    {
      cache: "no-store",
    },
  );

  const payload = (await response.json()) as ProjectResponse;

  if (!response.ok || !payload.ok || !payload.session) {
    throw new Error(
      payload.error?.message ||
        "The AI Builder project could not be loaded.",
    );
  }

  return payload;
}

export default function AiBuilderClient({
  initialProjectId = null,
}: Props) {
  const [step, setStep] = useState<BuilderStep>(
    initialProjectId ? "loading" : "form",
  );
  const [builder, setBuilder] = useState(initial);
  const [session, setSession] = useState<AiBuilderSession | null>(
    null,
  );
  const [chatThread, setChatThread] =
    useState<ChatThread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingReviewItems, setPendingReviewItems] = useState<ReviewCommandPending>(
    new Set(),
  );
  const [buildPercent, setBuildPercent] = useState(0);
  const authoritativeRevisionRef = useRef(0);
  const pendingReviewItemsRef = useRef(new Set<string>());
  const reviewCommandQueueRef = useRef<Promise<void>>(Promise.resolve());

  const submitReviewCommand = useCallback((command: ReviewCommandRequest) => {
    const pendingKey = `${command.itemKind}:${command.itemId}`;
    if (pendingReviewItemsRef.current.has(pendingKey)) {
      return Promise.reject(
        new Error("A review command is already pending for this item."),
      );
    }
    pendingReviewItemsRef.current.add(pendingKey);
    setPendingReviewItems(new Set(pendingReviewItemsRef.current));
    setSaveStatus("saving");
    setSaveError(null);
    const queuedCommand = reviewCommandQueueRef.current.then(async () => {
      try {
        setSaveStatus("saving");
        setSaveError(null);
        const authoritativeCommand = {
          ...command,
          clientRevision: authoritativeRevisionRef.current,
        };
        const response = await fetch(`/api/ai-builder/projects/${encodeURIComponent(command.projectId)}/review-commands`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(authoritativeCommand) });
        const payload = await response.json() as { ok?: boolean; item?: Record<string, unknown>; governanceRevision?: number; contextCounts?: AiBuilderSession["contextCounts"]; status?: AiBuilderSession["status"]; error?: { message?: string } };
        if (!response.ok || !payload.ok || !payload.item) throw new Error(payload.error?.message || "The review command could not be saved.");
        authoritativeRevisionRef.current = payload.governanceRevision ?? authoritativeCommand.clientRevision;
        setSession((current) => {
          if (!current) return current;
          const item = payload.item!;
          const updated = { ...current, governanceRevision: payload.governanceRevision ?? current.governanceRevision, contextCounts: payload.contextCounts ?? current.contextCounts, status: payload.status ?? current.status };
          if (command.itemKind === "context_entry") {
            const canonicalEntry = { ...current.contextEntries.find((entry) => entry.id === command.itemId), id: command.itemId, category: String(item.category) as AiBuilderSession["contextEntries"][number]["category"], title: String(item.title), content: String(item.content), status: String(item.status) as AiBuilderSession["contextEntries"][number]["status"], updatedAt: new Date(String(item.updated_at)).toISOString() } as AiBuilderSession["contextEntries"][number];
            const position = current.contextEntries.findIndex((entry) => entry.id === command.itemId);
            updated.contextEntries = [...current.contextEntries.filter((entry) => entry.id !== command.itemId)];
            updated.contextEntries.splice(position < 0 ? updated.contextEntries.length : position, 0, canonicalEntry);
          } else {
            const canonicalEntry = { ...current.faqEntries.find((entry) => entry.id === command.itemId), id: command.itemId, question: String(item.question), answer: String(item.answer), status: String(item.status) as AiBuilderSession["faqEntries"][number]["status"], updatedAt: new Date(String(item.updated_at)).toISOString() } as AiBuilderSession["faqEntries"][number];
            const position = current.faqEntries.findIndex((entry) => entry.id === command.itemId);
            updated.faqEntries = [...current.faqEntries.filter((entry) => entry.id !== command.itemId)];
            updated.faqEntries.splice(position < 0 ? updated.faqEntries.length : position, 0, canonicalEntry);
          }
          return updated;
        });
        setSaveStatus("saved");
      } catch (commandError) {
        setSaveStatus("error");
        setSaveError(commandError instanceof Error ? commandError.message : "The review command could not be saved.");
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

  const navigateToStep = useCallback((nextStep: BuilderStep) => {
    setStep(nextStep);

    if (
      nextStep === "results" ||
      nextStep === "review" ||
      nextStep === "chat"
    ) {
      const url = new URL(window.location.href);
      url.searchParams.set("step", nextStep);
      window.history.replaceState(null, "", url.toString());
    }

    if (!window.matchMedia("(min-width: 1200px)").matches) {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      });
    }
  }, []);

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
    () =>
      session?.status === "ready"
        ? buildKnowledgePack(session)
        : null,
    [session],
  );
  const reviewSaveStatus: SaveStatus = saveError
    ? "error"
    : pendingReviewItems.size > 0
      ? "saving"
      : saveStatus;

  useEffect(() => {
    if (!initialProjectId) return;

    const projectId = initialProjectId;
    let cancelled = false;

    async function loadProject() {
      setError(null);
      setSaveError(null);
      setSaveStatus("idle");
      setStep("loading");

      try {
        const payload = await fetchProject(projectId);

        if (cancelled || !payload.session) return;

        setBuilder((current) => ({
          ...current,
          businessName: payload.builder?.businessName ?? "",
          industry: payload.builder?.industry ?? "",
          website: payload.builder?.website ?? "",
          tone: payload.builder?.tone ?? "Professional",
          websiteKnowledge: payload.websiteKnowledge
            ? {
                businessName: payload.builder?.businessName ?? "",
                industry: payload.builder?.industry ?? "",
                website:
                  payload.websiteKnowledge.resolved_url ??
                  payload.websiteKnowledge.requested_url ??
                  payload.builder?.website ??
                  "",
                requestedUrl: payload.websiteKnowledge.requested_url ?? payload.builder?.website ?? "",
                resolvedUrl: payload.websiteKnowledge.resolved_url ?? payload.websiteKnowledge.requested_url ?? payload.builder?.website ?? "",
                productsServices: "",
                idealCustomers: "",
                additionalKnowledge: "",
                knowledge: payload.websiteKnowledge.knowledge,
                pages: payload.websiteKnowledge.pages,
                warnings: payload.websiteKnowledge.warnings,
                importedAt: payload.websiteKnowledge.imported_at ?? "",
                crawlAttemptId:
                  payload.websiteKnowledge.current_crawl_attempt_id ?? undefined,
              }
            : null,
          crawlAttemptIds: payload.websiteKnowledge?.current_crawl_attempt_id
            ? [payload.websiteKnowledge.current_crawl_attempt_id]
            : [],
        }));
        setSession(payload.session);
        setChatThread(payload.chatThread ?? null);

        const requestedStep = new URL(
          window.location.href,
        ).searchParams.get("step");
        setStep(
          requestedStep === "review" || requestedStep === "chat"
            ? requestedStep
            : "results",
        );
      } catch (loadError) {
        if (cancelled) return;

        setSession(null);
        setChatThread(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "The AI Builder project could not be loaded.",
        );
        setStep("form");
      }
    }

    void loadProject();

    return () => {
      cancelled = true;
    };
  }, [initialProjectId]);

  const buildAi = async () => {
    setError(null);
    setSaveError(null);
    setSaveStatus("idle");
    setSession(null);
    setChatThread(null);
    setBuildPercent(0);
    navigateToStep("building");

    try {
      const response = await fetch("/api/ai-builder/intake", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(builder),
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json()) as { error?: { message?: string } };
        throw new Error(payload.error?.message || "The AI builder could not process this information.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let payload: {
        ok?: boolean;
        projectId?: string;
        session?: AiBuilderSession;
        error?: {
          code?: string;
          message?: string;
        };
      } | null = null;

      while (true) {
        const { done, value: chunk } = await reader.read();
        buffer += decoder.decode(chunk, { stream: !done });
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
            setBuildPercent((current) =>
              Math.max(current, event.percent ?? 0),
            );
          }
          if (event.type === "error") throw new Error(event.error?.message || "The AI builder could not process this information.");
          if (event.type === "result") payload = event;
        }
        if (done) break;
      }

      if (!payload?.ok || !payload.session) {
        throw new Error(
          payload?.error?.message ||
            "The AI builder could not process this information.",
        );
      }

      const projectId =
        payload.projectId ?? payload.session.id;

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
      } catch (projectLoadError) {
        console.error(
          "AI_BUILDER_NEW_PROJECT_RELOAD_FAILED",
          {
            projectId,
            message:
              projectLoadError instanceof Error
                ? projectLoadError.message
                : "unknown_error",
          },
        );

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

  const renderReview = () => (
    <>
      {reviewSaveStatus !== "idle" || saveError ? (
        <div
          className={`mx-auto mb-4 max-w-5xl rounded-xl border px-4 py-3 text-center text-sm ${
            reviewSaveStatus === "error"
              ? "border-red-500/30 bg-red-500/10 text-red-200"
              : "border-amber-300/20 bg-[#030713] text-slate-400"
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

      <AiBuilderReview
        session={session!}
        onReviewCommand={submitReviewCommand}
        pendingReviewItems={pendingReviewItems}
        onBack={() => navigateToStep("results")}
        onLaunchChat={() => navigateToStep("chat")}
      />
    </>
  );

  const renderProjectView = () => {
    if (!session) return null;

    if (step === "review") return renderReview();

    if (step === "chat" && knowledgePack) {
      return (
        <AiBuilderDemoChat
          knowledge={knowledgePack}
          projectId={session.id}
          chatThread={chatThread}
          onBack={() => navigateToStep("review")}
        />
      );
    }

    return (
      <AiBuilderProgress
        builder={builder}
        session={session}
        complete
        percent={100}
        onReview={() => navigateToStep("review")}
      />
    );
  };

  const workspaceNav = [
    { label: "Overview", step: "results" as const },
    { label: "Knowledge", step: "review" as const },
    { label: "Test", step: "chat" as const },
  ];

  const saveLabel =
    reviewSaveStatus === "saving"
      ? "Saving changes"
      : reviewSaveStatus === "error"
        ? "Save issue"
        : reviewSaveStatus === "saved"
          ? "All changes saved"
          : "Ready";

  return (
    <AiBuilderShell>
      {step === "loading" ? (
        <div className="relative mx-auto max-w-3xl rounded-[30px] border border-amber-300/20 bg-[#030713] px-6 py-12 text-center shadow-[0_24px_90px_rgba(0,0,0,0.34),0_0_50px_rgba(245,158,11,0.06)]">
          <AiBuilderAuthCta />
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-300">
            Loading AI project
          </p>

          <p className="mt-4 text-base text-slate-400">
            Restoring your saved business knowledge.
          </p>
        </div>
      ) : null}

      {step === "form" && (
        <div className="ai-builder-form">
          {error ? (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <AiBuilderForm
            value={builder}
            onChange={setBuilder}
            onBuild={buildAi}
          />
        </div>
      )}

      {step === "building" && (
        <AiBuilderProgress
          builder={builder}
          session={null}
          complete={false}
          percent={buildPercent}
          onReview={() => undefined}
        />
      )}

      {session && (step === "results" || step === "review" || step === "chat") ? (
        <>
          <div className="hidden min-[1200px]:block">
            <div className="overflow-hidden rounded-[30px] border border-amber-300/15 bg-[linear-gradient(180deg,rgba(3,7,19,0.98),rgba(2,6,16,0.96))] shadow-[0_28px_100px_rgba(0,0,0,0.4),0_0_60px_rgba(245,158,11,0.05)]">
              <header className="flex items-center justify-between gap-6 border-b border-white/8 px-7 py-5">
                <div className="min-w-0">
                  <Link
                    href="/ai-builder/projects"
                    className="inline-flex items-center text-xs font-semibold uppercase tracking-[0.2em] text-amber-300 transition hover:text-amber-200"
                  >
                    Back to projects
                  </Link>
                  <div className="mt-3 flex items-end gap-4">
                    <div className="min-w-0">
                      <h1 className="truncate text-2xl font-semibold text-white">
                        {builder.businessName || "AI Builder Project"}
                      </h1>
                      {builder.website ? (
                        <p className="mt-1 truncate text-sm text-slate-400">
                          {builder.website}
                        </p>
                      ) : null}
                    </div>
                    <span className="rounded-full border border-amber-300/20 bg-amber-300/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
                      {session.status}
                    </span>
                  </div>
                </div>

                <div
                  className={`rounded-full border px-4 py-2 text-xs font-medium ${
                    reviewSaveStatus === "error"
                      ? "border-red-400/30 bg-red-500/10 text-red-200"
                      : "border-white/10 bg-white/[0.03] text-slate-300"
                  }`}
                >
                  {saveLabel}
                </div>
              </header>

              <div className="grid grid-cols-[220px_minmax(0,1fr)]">
                <aside className="border-r border-white/8 bg-black/10 p-4">
                  <nav className="sticky top-6 space-y-2" aria-label="AI Builder workspace">
                    {workspaceNav.map((item) => {
                      const active = step === item.step;

                      return (
                        <button
                          key={item.step}
                          type="button"
                          onClick={() => navigateToStep(item.step)}
                          className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                            active
                              ? "border border-amber-300/20 bg-amber-300/10 text-amber-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                              : "border border-transparent text-slate-400 hover:border-white/8 hover:bg-white/[0.03] hover:text-white"
                          }`}
                        >
                          <span>{item.label}</span>
                          {active ? <span aria-hidden="true">•</span> : null}
                        </button>
                      );
                    })}

                    <div className="my-4 border-t border-white/8" />

                    {["Sources", "Settings"].map((label) => (
                      <div
                        key={label}
                        className="flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold text-slate-600"
                        aria-disabled="true"
                      >
                        <span>{label}</span>
                        <span className="text-[10px] uppercase tracking-[0.16em]">Soon</span>
                      </div>
                    ))}
                  </nav>
                </aside>

                <main className="min-w-0 p-6 xl:p-8">
                  {renderProjectView()}
                </main>
              </div>
            </div>
          </div>

          <div className="min-[1200px]:hidden">
            {renderProjectView()}
          </div>
        </>
      ) : null}
    </AiBuilderShell>
  );
}
