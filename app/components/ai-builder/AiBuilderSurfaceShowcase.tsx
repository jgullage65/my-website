"use client";

import { useEffect, useMemo, useState } from "react";
import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
import type { BuilderState } from "./AiBuilderClient";
import type { AiBuilderModelChoice } from "./AiBuilderModelSelect";
import AiBuilderModelSelect from "./AiBuilderModelSelect";
import AiBuilderWorkspaceView from "./AiBuilderWorkspaceView";

export const AI_BUILDER_SHOWCASE_SLIDES = [
  { id: "dashboard", label: "Dashboard" },
  { id: "builder", label: "Builder" },
  { id: "review", label: "Review" },
  { id: "models", label: "Models" },
] as const;

export type AiBuilderShowcaseSlide = (typeof AI_BUILDER_SHOWCASE_SLIDES)[number]["id"];

// Every slide shares one viewport so changing surfaces cannot resize the
// landing-page showcase or push the content below it.
const SHOWCASE_VIEWPORT_CLASS = "h-[clamp(430px,calc(100dvh-360px),620px)]";

export type AiBuilderSurfaceShowcaseProps = {
  session: AiBuilderSession;
  builder: BuilderState;
  models: AiBuilderModelChoice[];
  initialSlide?: AiBuilderShowcaseSlide;
  autoAdvance?: boolean;
  className?: string;
};

export default function AiBuilderSurfaceShowcase({
  session,
  builder,
  models,
  initialSlide = "dashboard",
  autoAdvance = false,
  className = "",
}: AiBuilderSurfaceShowcaseProps) {
  const [activeSlide, setActiveSlide] = useState<AiBuilderShowcaseSlide>(initialSlide);
  const [builderValue, setBuilderValue] = useState(builder);
  const [selectedModel, setSelectedModel] = useState(models[0]?.id ?? "");
  const [showDashboardInsights, setShowDashboardInsights] = useState(false);

  useEffect(() => {
    setBuilderValue(builder);
  }, [builder]);

  useEffect(() => {
    if (!selectedModel && models[0]?.id) setSelectedModel(models[0].id);
  }, [models, selectedModel]);

  useEffect(() => {
    if (!autoAdvance) return;
    const timer = window.setTimeout(() => {
      setActiveSlide((current) => {
        const index = AI_BUILDER_SHOWCASE_SLIDES.findIndex((slide) => slide.id === current);
        return AI_BUILDER_SHOWCASE_SLIDES[(index + 1) % AI_BUILDER_SHOWCASE_SLIDES.length]!.id;
      });
    }, activeSlide === "dashboard" ? 13_000 : 6500);
    return () => window.clearTimeout(timer);
  }, [activeSlide, autoAdvance]);

  useEffect(() => {
    setShowDashboardInsights(false);
    if (activeSlide !== "dashboard") return;
    const timer = window.setTimeout(() => setShowDashboardInsights(true), 6500);
    return () => window.clearTimeout(timer);
  }, [activeSlide]);

  const surface = useMemo(() => {
    if (activeSlide === "dashboard") {
      return (
        <div className={`h-full transition-transform duration-700 ease-in-out ${showDashboardInsights ? "-translate-y-full" : "translate-y-0"}`}>
          <div className="h-full pb-5">
            <AiBuilderWorkspaceView mode="demo" activeView="dashboard" session={session} builder={builderValue} dashboardShowcase />
          </div>
          {showDashboardInsights ? (
            <div className="h-full overflow-hidden pt-5">
              <AiBuilderWorkspaceView mode="demo" activeView="insights" session={session} builder={builderValue} />
            </div>
          ) : null}
        </div>
      );
    }

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

    return (
      <div className="flex min-h-[430px] items-start justify-center pt-12">
        <AiBuilderModelSelect
          models={models}
          value={selectedModel}
          disabled={false}
          onChange={setSelectedModel}
          defaultOpen
        />
      </div>
    );
  }, [activeSlide, builderValue, models, selectedModel, session, showDashboardInsights]);

  return (
    <div className={className}>
      <div className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-black p-4 shadow-[0_28px_90px_rgba(0,0,0,.58)]">
        <div className={`${SHOWCASE_VIEWPORT_CLASS} overflow-hidden`}>{surface}</div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {AI_BUILDER_SHOWCASE_SLIDES.map((slide) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => setActiveSlide(slide.id)}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              activeSlide === slide.id
                ? "border-amber-300/30 bg-[#0a0a0a] text-white"
                : "border-white/[0.06] bg-[#030303] text-slate-500 hover:text-white"
            }`}
          >
            {slide.label}
          </button>
        ))}
      </div>
    </div>
  );
}
