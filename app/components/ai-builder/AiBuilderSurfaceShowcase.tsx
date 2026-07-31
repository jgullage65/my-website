"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const DESKTOP_VIEWPORT_WIDTH = 1440;
const DESKTOP_VIEWPORT_HEIGHT = 900;

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
  const [viewportScale, setViewportScale] = useState(1);
  const viewportRef = useRef<HTMLDivElement>(null);

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
    }, 7000);
    return () => window.clearTimeout(timer);
  }, [activeSlide, autoAdvance]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateScale = () => {
      setViewportScale(viewport.clientWidth / DESKTOP_VIEWPORT_WIDTH);
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const surface = useMemo(() => {
    if (activeSlide === "dashboard") {
      return (
        <AiBuilderWorkspaceView
          mode="demo"
          activeView="dashboard"
          session={session}
          builder={builderValue}
        />
      );
    }

    if (activeSlide === "builder") {
      return (
        <AiBuilderWorkspaceView
          mode="demo"
          activeView="builder"
          session={session}
          builder={builderValue}
        />
      );
    }

    if (activeSlide === "review") {
      return (
        <AiBuilderWorkspaceView
          mode="demo"
          activeView="review"
          session={session}
          builder={builderValue}
        />
      );
    }

    return (
      <div className="flex h-full items-start justify-center bg-black pt-24">
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
      <div className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-black shadow-[0_28px_90px_rgba(0,0,0,.58)]">
        <div
          ref={viewportRef}
          className="relative aspect-[16/10] w-full overflow-hidden bg-black"
        >
          <div
            className="absolute left-0 top-0 overflow-hidden bg-black"
            style={{
              width: DESKTOP_VIEWPORT_WIDTH,
              height: DESKTOP_VIEWPORT_HEIGHT,
              transform: `scale(${viewportScale})`,
              transformOrigin: "top left",
            }}
          >
            {surface}
          </div>
        </div>
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
