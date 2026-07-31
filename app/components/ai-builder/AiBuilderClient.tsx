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
import AiBuilderEmptyWorkspace from "./AiBuilderEmptyWorkspace";
import AiBuilderProgress from "./AiBuilderProgress";
import AiBuilderReview from "./AiBuilderReview";
import AiBuilderDemoChat from "./AiBuilderDemoChat";
import AiBuilderDashboard from "./AiBuilderDashboard";
import AiBuilderProjectInsights, { type ProjectDiagnostics } from "./AiBuilderProjectInsights";
import AiBuilderProjects from "./AiBuilderProjects";
import AiBuilderSources from "./AiBuilderSources";
import AiBuilderSettings from "./AiBuilderSettings";
import AiBuilderAuthCta from "./AiBuilderAuthCta";
import AiBuilderWorkspaceFrame from "./AiBuilderWorkspaceFrame";
import { AiBuilderWorkspaceProvider, type AiBuilderWorkspaceTab } from "./AiBuilderWorkspaceContext";
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
  sourceDocuments?: WebsiteSourceDocumentRecord[];
  sourceBlocks?: WebsiteSourceBlockRecord[];
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
type WorkspaceTab = Exclude<AiBuilderWorkspaceTab, "projects">;
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
  stateRevision?: number;
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

export default function AiBuilderClient({ initialProjectId = null }: Props) {
  const [step, setStep] = useState<BuilderStep>(initialProjectId ? "loading" : "form");
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("dashboard");
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [builder, setBuilder] = useState(initial);
  const [session, setSession] = useState<AiBuilderSession | null>(null);
  const [chatThread, setChatThread] = useState<ChatThread | null>(null);
  const [diagnostics, setDiagnostics] = useState<ProjectDiagnostics | null>(null);
  const [projectStateRevision, setProjectStateRevision] = useState(0);
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
    if (!projectsOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProjectsOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [projectsOpen]);

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

  const selectWorkspaceTab = useCallback(
    (nextTab: WorkspaceTab) => {
      setWorkspaceTab(nextTab);
      if (nextTab === "knowledge") {
        navigateToStep("review");
      } else if (nextTab === "overview") {
        navigateToStep("results");
      } else if (step === "review") {
        navigateToStep("results");
      }
    },
    [navigateToStep, step],
  );

  const selectAiBuilderWorkspaceTab = useCallback(
    (nextTab: AiBuilderWorkspaceTab) => {
      if (nextTab === "projects") {
        setProjectsOpen(true);
        return;
      }
      selectWorkspaceTab(nextTab);
    },
    [selectWorkspaceTab],
  );

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

  const knowledgePack = useMemo(() => (session ? buildKnowledgePack(session) : null), [session]);

  useEffect(() => {
    if (!initialProjectId) return;
    let active = true;
    void fetchProject(initialProjectId)
      .then((payload) => {
        if (!active || !payload.session) return;
        setSession(payload.session);
        setChatThread(payload.chatThread ?? null);
        setDiagnostics(payload.diagnostics ?? null);
        setProjectStateRevision(payload.stateRevision ?? 0);
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

  const renameProject = useCallback(
    async (businessName: string) => {
      if (!session) throw new Error("The AI Builder project is not loaded.");
      const response = await fetch(`/api/ai-builder/projects/${encodeURIComponent(session.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, expectedRevision: projectStateRevision }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        businessName?: string;
        stateRevision?: number;
        currentRevision?: number;
        error?: { message?: string };
      };
      if (!response.ok || !payload.ok) {
        if (response.status === 409 && typeof payload.currentRevision === "number") {
          setProjectStateRevision(payload.currentRevision);
        }
        throw new Error(payload.error?.message || "The project could not be renamed.");
      }
      const authoritativeBusinessName = payload.businessName ?? businessName;
      setProjectStateRevision(payload.stateRevision ?? projectStateRevision + 1);
      setBuilder((current) => ({
        ...current,
        businessName: authoritativeBusinessName,
        websiteKnowledge: current.websiteKnowledge
          ? { ...current.websiteKnowledge, businessName: authoritativeBusinessName }
          : current.websiteKnowledge,
      }));
    },
    [projectStateRevision, session],
  );

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
      let payload: {
        ok?: boolean;
        projectId?: string;
        session?: AiBuilderSession;
        error?: { message?: string };
      } | null = null;

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
        setProjectStateRevision(savedProject.stateRevision ?? 0);
      } catch (projectLoadError) {
        console.error("AI_BUILDER_NEW_PROJECT_RELOAD_FAILED", {
          projectId,
          message: projectLoadError instanceof Error ? projectLoadError.message : "unknown_error",
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

  const project = useMemo(
    () => ({
      businessName: builder.businessName,
      industry: builder.industry,
      website: builder.website,
      tone: builder.tone,
      stateRevision: projectStateRevision,
    }),
    [builder.businessName, builder.industry, builder.website, builder.tone, projectStateRevision],
  );

  const workspaceContent = session ? (
    workspaceTab === "dashboard" ? (
      <AiBuilderDashboard />
    ) : workspaceTab === "insights" ? (
      <AiBuilderProjectInsights />
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
        <AiBuilderReview
          onReviewCommand={submitReviewCommand}
          pendingReviewItems={pendingReviewItems}
          onBack={() => selectWorkspaceTab("overview")}
          onLaunchChat={() => navigateToStep("chat")}
          showLaunchChat={false}
          embedded
        />
      </>
    ) : workspaceTab === "overview" ? (
      <AiBuilderProgress
        builder={builder}
        session={session}
        complete
        percent={100}
        onReview={() => selectWorkspaceTab("knowledge")}
        embedded
      />
    ) : workspaceTab === "sources" ? (
      <AiBuilderSources />
    ) : (
      <AiBuilderSettings />
    )
  ) : null;

  if (step === "form") {
    return <AiBuilderEmptyWorkspace builder={builder} error={error} onChange={setBuilder} onBuild={buildAi} />;
  }

  if (step === "chat" && knowledgePack && session) {
    return (
      <AiBuilderShell>
        <AiBuilderWorkspaceProvider
          projectId={session.id}
          project={project}
          renameProject={renameProject}
          session={session}
          websiteKnowledge={websiteKnowledge}
          diagnostics={diagnostics}
          messages={chatThread?.messages ?? []}
          activeTab={workspaceTab}
          overviewOpen={false}
          knowledgeOpen={workspaceTab === "knowledge"}
          setActiveTab={selectAiBuilderWorkspaceTab}
          openOverview={() => selectWorkspaceTab("overview")}
          closeOverview={() => undefined}
          openKnowledge={() => selectWorkspaceTab("knowledge")}
          closeKnowledge={() => selectWorkspaceTab("overview")}
        >
          <AiBuilderDemoChat
            onBack={() => {
              setWorkspaceTab("knowledge");
              navigateToStep("review");
            }}
          />
        </AiBuilderWorkspaceProvider>
      </AiBuilderShell>
    );
  }

  return (
    <AiBuilderShell>
      {step === "loading" ? (
        <div className="relative mx-auto max-w-3xl rounded-[30px] border border-amber-300/20 bg-[#000000] px-6 py-12 text-center shadow-[0_24px_90px_rgba(0,0,0,0.34),0_0_50px_rgba(245,158,11,0.06)]">
          <AiBuilderAuthCta />
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-300">Loading AI project</p>
          <p className="mt-4 text-base text-slate-400">Restoring your saved business knowledge.</p>
        </div>
      ) : null}

      {step === "building" ? (
        <AiBuilderProgress
          builder={builder}
          session={null}
          complete={false}
          percent={buildPercent}
          onReview={() => undefined}
        />
      ) : null}

      {session && knowledgePack && (step === "results" || step === "review") ? (
        <AiBuilderWorkspaceProvider
          projectId={session.id}
          project={project}
          renameProject={renameProject}
          session={session}
          websiteKnowledge={websiteKnowledge}
          diagnostics={diagnostics}
          messages={chatThread?.messages ?? []}
          activeTab={workspaceTab}
          overviewOpen={false}
          knowledgeOpen={workspaceTab === "knowledge"}
          setActiveTab={selectAiBuilderWorkspaceTab}
          openOverview={() => selectWorkspaceTab("overview")}
          closeOverview={() => undefined}
          openKnowledge={() => selectWorkspaceTab("knowledge")}
          closeKnowledge={() => selectWorkspaceTab("overview")}
        >
          <AiBuilderWorkspaceFrame
            title={WORKSPACE_ITEMS.find(([value]) => value === workspaceTab)?.[1] ?? "AI Builder"}
            items={WORKSPACE_ITEMS.map(([value, label]) => ({
              value,
              label,
              active: workspaceTab === value,
              onSelect: () => selectWorkspaceTab(value),
            }))}
            onBuilderSelect={() => setProjectsOpen(true)}
            builderActive={false}
            rightRail={<AiBuilderDemoChat onBack={() => undefined} />}
            overlays={projectsOpen ? <AiBuilderProjects embedded onClose={() => setProjectsOpen(false)} /> : null}
          >
            {workspaceContent}
          </AiBuilderWorkspaceFrame>
        </AiBuilderWorkspaceProvider>
      ) : null}
    </AiBuilderShell>
  );
}
