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

  useEffect(() => {
    setBuilderValue(builder);
  }, [builder]);

  useEffect(() => {
    if (!selectedModel && models[0]?.id) setSelectedModel(models[0].id);
  }, [models, selectedModel]);

  useEffect(() => {
    if (!autoAdvance) return;
    const timer = window.setInterval(() => {
      setActiveSlide((current) => {
        const index = AI_BUILDER_SHOWCASE_SLIDES.findIndex((slide) => slide.id === current);
        return AI_BUILDER_SHOWCASE_SLIDES[(index + 1) % AI_BUILDER_SHOWCASE_SLIDES.length]!.id;
      });
    }, 6500);
    return () => window.clearInterval(timer);
  }, [autoAdvance]);

  const surface = useMemo(() => {
    if (activeSlide === "dashboard") {
      return <AiBuilderWorkspaceView mode="demo" activeView="dashboard" session={session} builder={builderValue} />;
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
      return (
        <div className="pointer-events-none origin-top-left scale-[0.76] sm:scale-[0.84] xl:scale-[0.7] 2xl:scale-[0.8]">
          <div className="w-[132%] sm:w-[119%] xl:w-[143%] 2xl:w-[125%]">
            <AiBuilderWorkspaceView mode="demo" activeView="review" session={session} builder={builderValue} embeddedReview />
          </div>
        </div>
      );
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
  }, [activeSlide, builderValue, models, selectedModel, session]);

  return (
    <div className={className}>
      <div className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-black p-4 shadow-[0_28px_90px_rgba(0,0,0,.58)]">
        <div className="h-[clamp(430px,calc(100dvh-300px),680px)] overflow-hidden">{surface}</div>
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
