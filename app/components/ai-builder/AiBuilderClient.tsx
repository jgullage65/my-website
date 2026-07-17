"use client";

import { useEffect, useMemo, useState } from "react";
import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
import { buildKnowledgePack } from "@/app/lib/ai-engine/knowledge";
import AiBuilderShell from "./AiBuilderShell";
import AiBuilderForm from "./AiBuilderForm";
import AiBuilderProgress from "./AiBuilderProgress";
import AiBuilderReview from "./AiBuilderReview";
import AiBuilderDemoChat from "./AiBuilderDemoChat";
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
  pages: Array<{
    url: string;
    title: string;
    pageType: string;
  }>;
  warnings: string[];
  importedAt: string;
};

export type BuilderState = {
  businessName: string;
  industry: string;
  website: string;
  tone: string;
  userKnowledge: UserKnowledge;
  websiteKnowledge: WebsiteKnowledge | null;
};

type BuilderStep = "form" | "loading" | "building" | "results" | "review" | "chat";

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
};

export default function AiBuilderClient({ initialProjectId = null }: Props) {
  const [step, setStep] = useState<BuilderStep>(
    initialProjectId ? "loading" : "form",
  );
  const [builder, setBuilder] = useState(initial);
  const [session, setSession] = useState<AiBuilderSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const knowledgePack = useMemo(
    () =>
      session?.status === "ready"
        ? buildKnowledgePack(session)
        : null,
    [session],
  );

  useEffect(() => {
    if (!initialProjectId) return;

    let cancelled = false;

    async function loadProject() {
      setError(null);
      setStep("loading");

      try {
        const response = await fetch(
          `/api/ai-builder/projects/${encodeURIComponent(initialProjectId)}`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as {
          ok?: boolean;
          session?: AiBuilderSession;
          builder?: {
            businessName?: string;
            industry?: string;
            website?: string;
            tone?: string;
          };
          error?: {
            message?: string;
          };
        };

        if (!response.ok || !payload.ok || !payload.session) {
          throw new Error(
            payload.error?.message ||
              "The AI Builder project could not be loaded.",
          );
        }

        if (cancelled) return;

        setBuilder((current) => ({
          ...current,
          businessName: payload.builder?.businessName ?? "",
          industry: payload.builder?.industry ?? "",
          website: payload.builder?.website ?? "",
          tone: payload.builder?.tone ?? "Professional",
        }));
        setSession(payload.session);
        setStep("results");
      } catch (loadError) {
        if (cancelled) return;

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
    setSession(null);
    setStep("building");

    try {
      const response = await fetch("/api/ai-builder/intake", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(builder),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        projectId?: string;
        session?: AiBuilderSession;
        error?: {
          code?: string;
          message?: string;
        };
      };

      if (!response.ok || !payload.ok || !payload.session) {
        throw new Error(
          payload.error?.message ||
            "The AI builder could not process this information.",
        );
      }

      setSession(payload.session);
      setStep("results");

      const projectId = payload.projectId ?? payload.session.id;
      const url = new URL(window.location.href);
      url.searchParams.set("projectId", projectId);
      window.history.replaceState(null, "", url.toString());
    } catch (buildError) {
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
        <div className="mx-auto max-w-3xl rounded-[30px] border border-amber-300/20 bg-[#030713] px-6 py-12 text-center shadow-[0_24px_90px_rgba(0,0,0,0.34),0_0_50px_rgba(245,158,11,0.06)]">
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
          onReview={() => undefined}
        />
      )}

      {step === "results" && session ? (
        <AiBuilderProgress
          builder={builder}
          session={session}
          complete
          onReview={() => setStep("review")}
        />
      ) : null}

      {step === "review" && session ? (
        <AiBuilderReview
          session={session}
          onSessionChange={setSession}
          onBack={() => setStep("results")}
          onLaunchChat={() => setStep("chat")}
        />
      ) : null}

      {step === "chat" && knowledgePack ? (
        <AiBuilderDemoChat
          knowledge={knowledgePack}
          onBack={() => setStep("review")}
        />
      ) : null}
    </AiBuilderShell>
  );
}
