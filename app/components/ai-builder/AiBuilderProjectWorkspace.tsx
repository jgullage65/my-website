"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
import type { ReviewCommandRequest } from "@/app/lib/ai-engine/business-memory/review-commands";
import type { PersistedWebsiteKnowledge } from "@/app/lib/ai-engine/knowledge/websiteKnowledge";
import AiBuilderShell from "./AiBuilderShell";
import AiBuilderDashboard from "./AiBuilderDashboard";
import AiBuilderDemoChat from "./AiBuilderDemoChat";
import AiBuilderProgress from "./AiBuilderProgress";
import AiBuilderProjectInsights, { type ProjectDiagnostics } from "./AiBuilderProjectInsights";
import AiBuilderProjects from "./AiBuilderProjects";
import AiBuilderReview from "./AiBuilderReview";
import AiBuilderSources from "./AiBuilderSources";
import {
  AiBuilderWorkspaceProvider,
  type AiBuilderWorkspaceTab,
} from "./AiBuilderWorkspaceContext";
import AiBuilderWorkspaceFrame from "./AiBuilderWorkspaceFrame";
import type { BuilderState, ReviewCommandPending } from "./AiBuilderClient";

type WorkspaceTab = AiBuilderWorkspaceTab;
type PersistedWorkspaceTab = Exclude<WorkspaceTab, "knowledge">;
type SaveStatus = "idle" | "saving" | "saved" | "error";

type StoredChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: string[];
  createdAt: string;
};

type ChatThread = {
  id: string;
  messages: StoredChatMessage[];
};

type ProjectResponse = {
  ok?: boolean;
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
  error?: { message?: string };
};

type Props = {
  projectId: string;
  reviewOpen?: boolean;
  initialTab?: PersistedWorkspaceTab;
};

const WORKSPACE_ITEMS: ReadonlyArray<readonly [WorkspaceTab, string]> = [
  ["projects", "Projects"],
  ["dashboard", "Dashboard"],
  ["insights", "Project Insights"],
  ["overview", "Overview"],
  ["knowledge", "Business Knowledge"],
  ["sources", "Sources"],
  ["settings", "Settings"],
];

const WORKSPACE_DESCRIPTIONS: Record<WorkspaceTab, string> = {
  projects: "Create, open, archive, restore, and manage AI Builder projects",
  dashboard: "Priorities, readiness, and recent project changes",
  insights: "Crawl, generation, governance, and activity diagnostics",
  overview: "Build status and generated project totals",
  knowledge: "Review and govern the assistant’s business memory",
  sources: "Connected source material and website imports",
  settings: "Project configuration and preferences",
};

const EMPTY_BUILDER: BuilderState = {
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

async function fetchProject(projectId: string): Promise<ProjectResponse> {
  const response = await fetch(`/api/ai-builder/projects/${encodeURIComponent(projectId)}`, {
    cache: "no-store",
  });
  const payload = (await response.json()) as ProjectResponse;
  if (!response.ok || !payload.ok || !payload.session) {
    throw new Error(payload.error?.message || "The AI Builder project could not be loaded.");
  }
  return payload;
}

export default function AiBuilderProjectWorkspace({
  projectId,
  reviewOpen = false,
  initialTab = "dashboard",
}: Props) {
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>(initialTab === "overview" ? "dashboard" : initialTab);
  const [overviewOpen, setOverviewOpen] = useState(initialTab === "overview");
  const [knowledgeOpen, setKnowledgeOpen] = useState(reviewOpen);
  const [builder, setBuilder] = useState<BuilderState>(EMPTY_BUILDER);
  const [session, setSession] = useState<AiBuilderSession | null>(null);
  const [chatThread, setChatThread] = useState<ChatThread | null>(null);
  const [diagnostics, setDiagnostics] = useState<ProjectDiagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingReviewItems, setPendingReviewItems] = useState<ReviewCommandPending>(new Set());
  const authoritativeRevisionRef = useRef(0);
  const pendingReviewItemsRef = useRef(new Set<string>());
  const reviewCommandQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    void fetchProject(projectId)
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
          websiteKnowledge: payload.websiteKnowledge
            ? {
                businessName: payload.builder?.businessName ?? "",
                industry: payload.builder?.industry ?? "",
                website: payload.builder?.website ?? "",
                requestedUrl: payload.websiteKnowledge.requested_url ?? "",
                resolvedUrl: payload.websiteKnowledge.resolved_url ?? "",
                productsServices: "",
                idealCustomers: "",
                additionalKnowledge: "",
                knowledge: payload.websiteKnowledge.knowledge,
                pages: payload.websiteKnowledge.pages,
                warnings: payload.websiteKnowledge.warnings,
                importedAt: payload.websiteKnowledge.imported_at ?? "",
                crawlAttemptId: payload.websiteKnowledge.current_crawl_attempt_id ?? undefined,
                sourceDocuments: payload.websiteKnowledge.source_documents,
                sourceBlocks: payload.websiteKnowledge.source_blocks,
              }
            : null,
        }));
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "The AI Builder project could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  useEffect(() => {
    if (session) authoritativeRevisionRef.current = session.governanceRevision ?? 0;
  }, [session]);

  useEffect(() => {
    if (!overviewOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOverviewOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [overviewOpen]);

  const closeReview = useCallback(() => {
    setKnowledgeOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set("projectId", projectId);
    url.searchParams.set("tab", workspaceTab);
    window.history.replaceState(null, "", url.toString());
  }, [projectId, workspaceTab]);

  useEffect(() => {
    if (!knowledgeOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && pendingReviewItemsRef.current.size === 0) closeReview();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [closeReview, knowledgeOpen]);

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

        authoritativeRevisionRef.current = payload.governanceRevision ?? authoritativeCommand.clientRevision;
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

  const openReview = useCallback(() => {
    setOverviewOpen(false);
    setKnowledgeOpen(true);
    const url = new URL(window.location.href);
    url.searchParams.set("projectId", projectId);
    url.searchParams.set("tab", workspaceTab);
    window.history.replaceState(null, "", url.toString());
  }, [projectId, workspaceTab]);

  const selectWorkspaceTab = useCallback((nextTab: WorkspaceTab) => {
    if (nextTab === "knowledge") {
      openReview();
      return;
    }

    if (nextTab === "overview" && window.matchMedia("(min-width: 640px)").matches) {
      setOverviewOpen(true);
      return;
    }

    setKnowledgeOpen(false);
    setOverviewOpen(false);
    setWorkspaceTab(nextTab);
    const url = new URL(window.location.href);
    url.searchParams.set("projectId", projectId);
    url.searchParams.set("tab", nextTab);
    window.history.replaceState(null, "", url.toString());
  }, [openReview, projectId]);

  const reviewSaveStatus = pendingReviewItems.size > 0 ? "saving" : saveStatus;
  const websiteKnowledge = builder.websiteKnowledge
    ? {
        schema_version: 2 as const,
        document_version: 1,
        current_crawl_attempt_id: builder.websiteKnowledge.crawlAttemptId ?? null,
        imported_at: builder.websiteKnowledge.importedAt,
        requested_url: builder.websiteKnowledge.requestedUrl,
        resolved_url: builder.websiteKnowledge.resolvedUrl,
        pages: builder.websiteKnowledge.pages,
        warnings: builder.websiteKnowledge.warnings,
        knowledge: builder.websiteKnowledge.knowledge ?? {
          facts: [],
          coverage: {} as PersistedWebsiteKnowledge["knowledge"]["coverage"],
          unresolvedQuestions: [],
        },
        source_documents: builder.websiteKnowledge.sourceDocuments,
        source_blocks: builder.websiteKnowledge.sourceBlocks,
      }
    : null;

  if (error) {
    return (
      <AiBuilderShell>
        <div className="mx-auto max-w-2xl rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center text-red-200">
          {error}
        </div>
      </AiBuilderShell>
    );
  }

  if (!session) {
    return (
      <AiBuilderShell>
        <div className="h-full min-h-[70vh] w-full bg-[#020202]" aria-hidden="true" />
      </AiBuilderShell>
    );
  }

  const projectsPage = (
    <div className="[&>div]:!static [&>div]:!block [&>div]:!bg-transparent [&>div]:!p-0 [&>div>section]:!max-h-none [&>div>section]:!max-w-none [&>div>section]:!overflow-visible [&>div>section]:!rounded-none [&>div>section]:!border-0 [&>div>section]:!bg-transparent [&>div>section]:!px-0 [&>div>section]:!py-0 [&>div>section]:!shadow-none">
      <AiBuilderProjects embedded />
    </div>
  );

  const workspaceContent = workspaceTab === "projects" ? (
    projectsPage
  ) : workspaceTab === "dashboard" ? (
    <AiBuilderDashboard />
  ) : workspaceTab === "insights" ? (
    <AiBuilderProjectInsights />
  ) : workspaceTab === "overview" ? (
    <AiBuilderProgress builder={builder} session={session} complete percent={100} onReview={openReview} embedded />
  ) : workspaceTab === "sources" ? (
    <AiBuilderSources />
  ) : (
    <div className="flex min-h-full items-center justify-center rounded-3xl border border-white/10 bg-black p-8 text-center">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-300">{workspaceTab}</p>
        <h2 className="mt-3 text-2xl font-bold text-white">This workspace is ready for its next module.</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">{WORKSPACE_DESCRIPTIONS[workspaceTab]}</p>
      </div>
    </div>
  );

  const overviewContent = (
    <AiBuilderProgress builder={builder} session={session} complete percent={100} onReview={openReview} embedded />
  );

  const reviewStatus = reviewSaveStatus !== "idle" || saveError ? (
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
  ) : null;

  const businessKnowledge = (
    <AiBuilderReview
      onReviewCommand={submitReviewCommand}
      pendingReviewItems={pendingReviewItems}
      onBack={closeReview}
      onLaunchChat={() => undefined}
      showLaunchChat={false}
      embedded
    />
  );

  const rightRail = (
    <div className="min-h-0 flex-1 [&>div]:flex [&>div]:h-full [&>div]:max-w-none [&>div]:flex-col [&>div]:space-y-0 [&>div>section:last-of-type]:flex [&>div>section:last-of-type]:min-h-0 [&>div>section:last-of-type]:flex-1 [&>div>section:last-of-type]:flex-col [&>div>section:last-of-type]:rounded-none [&>div>section:last-of-type]:border-0 [&>div>section:last-of-type>div.relative]:min-h-0 [&>div>section:last-of-type>div.relative]:flex-1 [&_.ai-builder-chat-scrollbar]:h-full [&_.ai-builder-chat-scrollbar]:min-h-0 [&_.ai-builder-chat-scrollbar]:max-h-none">
      <AiBuilderDemoChat onBack={() => undefined} />
    </div>
  );

  const overlays = (
    <>
      {overviewOpen && !knowledgeOpen ? (
        <div className="fixed inset-0 z-[100] hidden items-center justify-center bg-black/75 p-8 backdrop-blur-md xl:flex" role="presentation">
          <section role="dialog" aria-modal="true" aria-label="Project overview" className="flex max-h-[90dvh] w-full max-w-[820px] flex-col overflow-hidden rounded-[24px] border border-white/[0.1] bg-[#030303] shadow-[0_32px_110px_rgba(0,0,0,0.72)]">
            <div className="relative flex flex-none items-center justify-center border-b border-white/[0.08] px-20 py-4 text-center"><h2 className="text-base font-semibold text-white">Overview</h2><button type="button" onClick={() => setOverviewOpen(false)} aria-label="Close overview" className="absolute right-5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg border border-white/[0.1] text-xl leading-none text-slate-300 transition hover:bg-white/[0.05] hover:text-white">×</button></div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5"><div className="mx-auto w-full max-w-[700px]">{overviewContent}</div></div>
          </section>
        </div>
      ) : null}

      {knowledgeOpen ? (
        <div className="fixed inset-0 z-[100] hidden items-center justify-center bg-black/75 p-8 backdrop-blur-md xl:flex" role="presentation">
          <section role="dialog" aria-modal="true" aria-label="Business Knowledge review" className="flex max-h-[90dvh] w-full max-w-[820px] flex-col overflow-hidden rounded-[24px] border border-white/[0.1] bg-[#030303] shadow-[0_32px_110px_rgba(0,0,0,0.72)]">
            <div className="relative flex flex-none items-center justify-center border-b border-white/[0.08] px-24 py-4 text-center"><div className="min-w-0 text-center"><h2 className="text-base font-semibold text-white">Business Knowledge</h2><p className="mt-1 text-xs text-slate-500">Review and govern the assistant’s business memory</p></div><button type="button" onClick={closeReview} className="absolute right-6 top-1/2 -translate-y-1/2 rounded-lg border border-white/[0.1] px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.05] hover:text-white">Done</button></div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5"><div className="mx-auto w-full max-w-[700px]">{reviewStatus}{businessKnowledge}</div></div>
          </section>
        </div>
      ) : null}

      {overviewOpen && !knowledgeOpen ? <section role="dialog" aria-modal="true" aria-label="Project overview" className="fixed inset-0 z-[100] hidden min-h-dvh flex-col bg-[#030303] sm:flex xl:hidden"><div className="relative flex min-h-[68px] flex-none items-center justify-center border-b border-white/[0.08] px-16 text-center"><h2 className="text-sm font-semibold text-white">Overview</h2><button type="button" onClick={() => setOverviewOpen(false)} aria-label="Close overview" className="absolute right-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg border border-white/[0.1] bg-[#080808] text-2xl leading-none text-slate-300">×</button></div><div className="min-h-0 flex-1 overflow-y-auto px-6 py-6"><div className="mx-auto w-full max-w-[700px]">{overviewContent}</div></div></section> : null}
    </>
  );

  const title = knowledgeOpen
    ? "Business Knowledge"
    : WORKSPACE_ITEMS.find(([value]) => value === workspaceTab)?.[1] ?? "Workspace";

  return (
    <AiBuilderWorkspaceProvider
      projectId={projectId}
      session={session}
      websiteKnowledge={websiteKnowledge}
      diagnostics={diagnostics}
      messages={chatThread?.messages ?? []}
      activeTab={workspaceTab}
      overviewOpen={overviewOpen}
      knowledgeOpen={knowledgeOpen}
      setActiveTab={selectWorkspaceTab}
      openOverview={() => {
        setKnowledgeOpen(false);
        setOverviewOpen(true);
      }}
      closeOverview={() => setOverviewOpen(false)}
      openKnowledge={openReview}
      closeKnowledge={closeReview}
    >
      <AiBuilderWorkspaceFrame
        title={title}
        onBuilderSelect={() => window.location.assign("/ai-builder")}
        items={WORKSPACE_ITEMS.map(([value, label]) => ({
          value,
          label,
          active:
            value === "knowledge"
              ? knowledgeOpen
              : value === "overview"
                ? overviewOpen
                : workspaceTab === value && !overviewOpen && !knowledgeOpen,
          onSelect: () => selectWorkspaceTab(value),
        }))}
        rightRail={rightRail}
        overlays={overlays}
      >
        {knowledgeOpen ? (
          <div className="xl:hidden">
            {reviewStatus}
            {businessKnowledge}
          </div>
        ) : workspaceContent}
      </AiBuilderWorkspaceFrame>
    </AiBuilderWorkspaceProvider>
  );
}
