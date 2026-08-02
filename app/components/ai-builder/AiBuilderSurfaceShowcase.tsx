"use client";

import { useEffect, useMemo, useState } from "react";
import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
import { buildKnowledgePack } from "@/app/lib/ai-engine/knowledge";
import type { BuilderState } from "./AiBuilderClient";
import type { AiBuilderModelChoice } from "./AiBuilderModelSelect";
import type { ProjectDiagnostics } from "./AiBuilderProjectInsights";
import { useCanonicalConfirm } from "@/app/components/ui/CanonicalConfirmDialog";
import AiBuilderWorkspaceView from "./AiBuilderWorkspaceView";
import AiBuilderDeterministicDemoWorkspace from "./AiBuilderDeterministicDemoWorkspace";

export const AI_BUILDER_SHOWCASE_SLIDES = [
  { id: "builder", label: "Builder" },
  { id: "review", label: "Review" },
  { id: "dashboard", label: "Dashboard" },
  { id: "insights", label: "Insights" },
  { id: "chat", label: "Chat" },
] as const;

export type AiBuilderShowcaseSlide = (typeof AI_BUILDER_SHOWCASE_SLIDES)[number]["id"];

const SHOWCASE_VIEWPORT_CLASS = "h-[clamp(430px,calc(100dvh-360px),620px)]";

export type AiBuilderSurfaceShowcaseProps = {
  session: AiBuilderSession;
  builder: BuilderState;
  models: AiBuilderModelChoice[];
  diagnostics?: ProjectDiagnostics | null;
  initialSlide?: AiBuilderShowcaseSlide;
  autoAdvance?: boolean;
  className?: string;
};

export default function AiBuilderSurfaceShowcase({
  session,
  builder,
  diagnostics = null,
  initialSlide = "builder",
  autoAdvance = false,
  className = "",
}: AiBuilderSurfaceShowcaseProps) {
  const [activeSlide, setActiveSlide] = useState<AiBuilderShowcaseSlide>(initialSlide);
  const [demoOpen, setDemoOpen] = useState(false);
  const { showConfirm, confirmDialogNode } = useCanonicalConfirm();

  useEffect(() => {
    if (!autoAdvance || demoOpen) return;
    const timer = window.setTimeout(() => {
      setActiveSlide((current) => {
        const index = AI_BUILDER_SHOWCASE_SLIDES.findIndex((slide) => slide.id === current);
        return AI_BUILDER_SHOWCASE_SLIDES[(index + 1) % AI_BUILDER_SHOWCASE_SLIDES.length]!.id;
      });
    }, 6500);
    return () => window.clearTimeout(timer);
  }, [activeSlide, autoAdvance, demoOpen]);

  useEffect(() => {
    if (!demoOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDemoOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [demoOpen]);

  const openDemo = async () => {
    const confirmed = await showConfirm({
      title: "Try the Full Platform Demo?",
      message:
        "Explore the full AI Builder workspace without signing in. The demo uses temporary deterministic data, makes no AI calls, writes nothing to the database, and resets when you close it.",
      confirmLabel: "Open Full Demo",
      cancelLabel: "Cancel",
    });
    if (confirmed) setDemoOpen(true);
  };

  const knowledge = useMemo(() => buildKnowledgePack(session), [session]);

  const showcaseSurface = useMemo(() => {
    if (activeSlide === "builder") {
      return <AiBuilderWorkspaceView mode="demo" activeView="builder" session={session} builder={builder} previewMode />;
    }
    if (activeSlide === "review") {
      return <AiBuilderWorkspaceView mode="demo" activeView="review" session={session} builder={builder} embeddedReview />;
    }
    if (activeSlide === "dashboard") {
      return <AiBuilderWorkspaceView mode="demo" activeView="dashboard" session={session} builder={builder} diagnostics={diagnostics} dashboardShowcase />;
    }
    if (activeSlide === "insights") {
      return <AiBuilderWorkspaceView mode="demo" activeView="insights" session={session} builder={builder} diagnostics={diagnostics} />;
    }
    return <AiBuilderWorkspaceView mode="demo" activeView="chat" session={session} builder={builder} knowledge={knowledge} projectId={session.id} />;
  }, [activeSlide, builder, diagnostics, knowledge, session]);

  return (
    <div className={className}>
      {confirmDialogNode}
      <div className="overflow-hidden rounded-[24px] border border-amber-300/30 bg-black p-3 shadow-[0_28px_90px_rgba(0,0,0,.58)] sm:p-4">
        <div className={`${SHOWCASE_VIEWPORT_CLASS} overflow-hidden`}>
          <div className="relative h-full lg:hidden">
            <div className="pointer-events-none absolute left-1/2 top-0 w-[900px] origin-top -translate-x-1/2 scale-[0.36] sm:scale-[0.72]">
              {showcaseSurface}
            </div>
          </div>
          <div className="hidden h-full lg:block">{showcaseSurface}</div>
        </div>
      </div>

      <div className="mt-4 flex justify-center">
        <button type="button" onClick={openDemo} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-amber-300/30 bg-[#0a0a0a] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_35px_rgba(0,0,0,.32)] transition hover:border-amber-200/50 hover:bg-[#101010]">Open Demo</button>
      </div>

      {demoOpen ? (
        <AiBuilderDeterministicDemoWorkspace
          session={session}
          builder={builder}
          diagnostics={diagnostics}
          onClose={() => setDemoOpen(false)}
        />
      ) : null}
    </div>
  );
}
