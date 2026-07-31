"use client";

import { useEffect, useMemo, useState } from "react";
import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
import type { BuilderState } from "./AiBuilderClient";
import type { AiBuilderModelChoice } from "./AiBuilderModelSelect";
import type { ProjectDiagnostics } from "./AiBuilderProjectInsights";
import AiBuilderWorkspaceView from "./AiBuilderWorkspaceView";

export const AI_BUILDER_SHOWCASE_SLIDES = [
  { id: "builder", label: "Builder" },
  { id: "review", label: "Review" },
  { id: "dashboard", label: "Dashboard" },
  { id: "insights", label: "Insights" },
] as const;

export type AiBuilderShowcaseSlide = (typeof AI_BUILDER_SHOWCASE_SLIDES)[number]["id"];

// Every slide shares one viewport so changing surfaces cannot resize the
// landing-page showcase or push the content below it.
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
  const [builderValue, setBuilderValue] = useState(builder);
  const [demoOpen, setDemoOpen] = useState(false);

  useEffect(() => {
    setBuilderValue(builder);
  }, [builder]);

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

  const surface = useMemo(() => {
    if (activeSlide === "builder") {
      return (
        <AiBuilderWorkspaceView
          mode="demo"
          activeView="builder"
          session={session}
          builder={builderValue}
          previewMode
        />
      );
    }

    if (activeSlide === "review") {
      return <AiBuilderWorkspaceView mode="demo" activeView="review" session={session} builder={builderValue} embeddedReview />;
    }

    if (activeSlide === "dashboard") {
      return <AiBuilderWorkspaceView mode="demo" activeView="dashboard" session={session} builder={builderValue} diagnostics={diagnostics} dashboardShowcase />;
    }

    return <AiBuilderWorkspaceView mode="demo" activeView="insights" session={session} builder={builderValue} diagnostics={diagnostics} />;
  }, [activeSlide, builderValue, diagnostics, session]);

  const switcher = (compact = false) => (
    <div className={`grid grid-cols-4 gap-2 ${compact ? "w-full max-w-2xl" : ""}`}>
      {AI_BUILDER_SHOWCASE_SLIDES.map((slide) => (
        <button
          key={slide.id}
          type="button"
          onClick={() => setActiveSlide(slide.id)}
          className={`rounded-lg border px-2 py-2 text-[11px] font-semibold transition sm:px-3 sm:text-xs ${
            activeSlide === slide.id
              ? "border-amber-300/30 bg-[#0a0a0a] text-white"
              : "border-white/[0.06] bg-[#030303] text-slate-500 hover:text-white"
          }`}
        >
          {slide.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className={className}>
      <div className="overflow-hidden rounded-[24px] border border-amber-300/30 bg-black p-3 shadow-[0_28px_90px_rgba(0,0,0,.58)] sm:p-4">
        <div className={`${SHOWCASE_VIEWPORT_CLASS} overflow-hidden`}>
          <div className="relative h-full lg:hidden">
            <div className="pointer-events-none absolute left-1/2 top-0 w-[900px] origin-top -translate-x-1/2 scale-[0.36] sm:scale-[0.72]">
              {surface}
            </div>
          </div>
          <div className="hidden h-full lg:block">{surface}</div>
        </div>
      </div>

      <div className="mt-3">{switcher()}</div>

      <div className="mt-4 flex justify-center">
        <button
          type="button"
          onClick={() => setDemoOpen(true)}
          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-amber-300/30 bg-[#0a0a0a] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_35px_rgba(0,0,0,.32)] transition hover:border-amber-200/50 hover:bg-[#101010]"
        >
          Open Demo
        </button>
      </div>

      {demoOpen ? (
        <div
          className="fixed inset-0 z-[200] flex min-h-0 flex-col bg-black"
          role="dialog"
          aria-modal="true"
          aria-label="AI Builder visual demo"
        >
          <div className="relative flex shrink-0 items-center justify-center border-b border-white/[0.08] bg-black/95 px-4 py-3 backdrop-blur sm:px-6 lg:hidden">
            <h2 className="text-sm font-semibold text-white sm:text-base">
              <span className="sm:hidden">Mobile Visual Demo</span>
              <span className="hidden sm:inline">Tablet Visual Demo</span>
            </h2>
            <button
              type="button"
              onClick={() => setDemoOpen(false)}
              aria-label="Close demo"
              className="absolute right-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.1] bg-[#090909] text-xl leading-none text-white transition hover:border-amber-300/40 hover:bg-[#111] sm:right-6"
            >
              ×
            </button>
          </div>

          <button
            type="button"
            onClick={() => setDemoOpen(false)}
            aria-label="Close demo"
            className="absolute right-6 top-6 z-10 hidden h-10 w-10 items-center justify-center rounded-full border border-white/[0.1] bg-[#090909] text-xl leading-none text-white transition hover:border-amber-300/40 hover:bg-[#111] lg:inline-flex"
          >
            ×
          </button>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-black">
            <div className="min-h-full">{surface}</div>
          </div>

          <div className="shrink-0 border-t border-white/[0.08] bg-black/95 px-3 py-3 backdrop-blur sm:px-5">
            <div className="mx-auto flex justify-center">{switcher(true)}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
