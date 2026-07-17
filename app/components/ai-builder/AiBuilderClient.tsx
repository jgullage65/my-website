"use client";

import { useMemo, useState } from "react";
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

type BuilderStep = "form" | "building" | "results" | "review" | "chat";

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

export default function AiBuilderClient() {
  const [step, setStep] = useState<BuilderStep>("form");
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
