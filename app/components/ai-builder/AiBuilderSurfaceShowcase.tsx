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

  useEffect(() => {
    setBuilderValue(builder);
  }, [builder]);

  useEffect(() => {
    if (!autoAdvance) return;
    const timer = window.setTimeout(() => {
      setActiveSlide((current) => {
        const index = AI_BUILDER_SHOWCASE_SLIDES.findIndex((slide) => slide.id === current);
        return AI_BUILDER_SHOWCASE_SLIDES[(index + 1) % AI_BUILDER_SHOWCASE_SLIDES.length]!.id;
      });
    }, 6500);
    return () => window.clearTimeout(timer);
  }, [activeSlide, autoAdvance]);

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

  return (
    <div className={className}>
      <div className="overflow-hidden rounded-[24px] border border-amber-300/30 bg-black p-3 shadow-[0_28px_90px_rgba(0,0,0,.58)] sm:p-4">
        <div className={`${SHOWCASE_VIEWPORT_CLASS} overflow-hidden`}>
          <div className="h-full overflow-y-auto overscroll-contain sm:hidden">
            <div className="pointer-events-none min-h-full">{surface}</div>
          </div>
          <div className="relative hidden h-full sm:block lg:hidden">
            <div className="pointer-events-none absolute left-1/2 top-0 w-[900px] origin-top -translate-x-1/2 scale-[0.72]">
              {surface}
            </div>
          </div>
          <div className="hidden h-full lg:block">{surface}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
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
    </div>
  );
}
