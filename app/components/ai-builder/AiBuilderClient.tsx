"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
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
  const [reviewChangesPending, setReviewChangesPending] =
    useState(false);
  const [saveStatus, setSaveStatus] =
    useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(
    null,
  );
  const [buildPercent, setBuildPercent] = useState(0);

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

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
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

  useEffect(() => {
    if (!initialProjectId) return;

    const projectId = initialProjectId;
    let cancelled = false;

    async function loadProject() {
      setError(null);
      setSaveError(null);
      setSaveStatus("idle");
      setReviewChangesPending(false);
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

  useEffect(() => {
    if (!session || !reviewChangesPending) return;

    const controller = new AbortController();

    const saveTimer = window.setTimeout(async () => {
      setSaveStatus("saving");
      setSaveError(null);

      try {
        const response = await fetch(
          `/api/ai-builder/projects/${encodeURIComponent(
            session.id,
          )}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              session,
            }),
            signal: controller.signal,
          },
        );

        const payload = (await response.json()) as {
          ok?: boolean;
          error?: {
            message?: string;
          };
        };

        if (!response.ok || !payload.ok) {
          throw new Error(
            payload.error?.message ||
              "The AI Builder project changes could not be saved.",
          );
        }

        setReviewChangesPending(false);
        setSaveStatus("saved");
      } catch (saveRequestError) {
        if (
          saveRequestError instanceof DOMException &&
          saveRequestError.name === "AbortError"
        ) {
          return;
        }

        setSaveStatus("error");
        setSaveError(
          saveRequestError instanceof Error
            ? saveRequestError.message
            : "The AI Builder project changes could not be saved.",
        );
      }
    }, 800);

    return () => {
      window.clearTimeout(saveTimer);
      controller.abort();
    };
  }, [session, reviewChangesPending]);

  const handleSessionChange = (
    nextSession: AiBuilderSession,
  ) => {
    setSession(nextSession);
    setReviewChangesPending(true);
    setSaveStatus("idle");
    setSaveError(null);
  };

  const buildAi = async () => {
    setError(null);
    setSaveError(null);
    setSaveStatus("idle");
    setReviewChangesPending(false);
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

        setSession(
          savedProject.session ?? payload.session,
        );
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

      {step === "results" && session ? (
        <AiBuilderProgress
          builder={builder}
          session={session}
          complete
          percent={100}
          onReview={() => navigateToStep("review")}
        />
      ) : null}

      {step === "review" && session ? (
        <>
          {saveStatus !== "idle" || saveError ? (
            <div
              className={`mx-auto mb-4 max-w-5xl rounded-xl border px-4 py-3 text-center text-sm ${
                saveStatus === "error"
                  ? "border-red-500/30 bg-red-500/10 text-red-200"
                  : "border-amber-300/20 bg-[#030713] text-slate-400"
              }`}
              role={
                saveStatus === "error" ? "alert" : "status"
              }
              aria-live="polite"
            >
              {saveStatus === "saving"
                ? "Saving changes..."
                : saveStatus === "saved"
                  ? "Changes saved."
                  : saveError}
            </div>
          ) : null}

          <AiBuilderReview
            session={session}
            onSessionChange={handleSessionChange}
            onBack={() => navigateToStep("results")}
            onLaunchChat={() => navigateToStep("chat")}
          />
        </>
      ) : null}

      {step === "chat" && knowledgePack && session ? (
        <AiBuilderDemoChat
          knowledge={knowledgePack}
          projectId={session.id}
          chatThread={chatThread}
          onBack={() => navigateToStep("review")}
        />
      ) : null}
    </AiBuilderShell>
  );
}
