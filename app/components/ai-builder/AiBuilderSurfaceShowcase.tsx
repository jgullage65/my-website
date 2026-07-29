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
  const surfaceHeight = activeSlide === "builder"
    ? "h-[760px] sm:h-[820px] xl:h-[760px] 2xl:h-[820px]"
    : activeSlide === "review"
      ? "h-[650px] sm:h-[700px] xl:h-[660px] 2xl:h-[720px]"
      : "h-[500px] sm:h-[540px]";

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
        <div className={`h-full transition-transform duration-700 ease-in-out ${showDashboardInsights ? "-translate-y-1/2" : "translate-y-0"}`}>
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
        <div className="pointer-events-none origin-top-left scale-[0.68] sm:scale-[0.76] xl:scale-[0.62] 2xl:scale-[0.72]">
          <div className="w-[147%] sm:w-[132%] xl:w-[161%] 2xl:w-[139%]">
            <AiBuilderWorkspaceView mode="demo" activeView="builder" session={session} builder={builderValue} />
          </div>
        </div>
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
        <div className={`${surfaceHeight} overflow-hidden`}>{surface}</div>
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
