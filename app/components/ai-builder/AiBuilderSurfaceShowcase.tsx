"use client";

import { useEffect, useMemo, useState } from "react";
import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
import type { ReviewCommandRequest } from "@/app/lib/ai-engine/business-memory/review-commands";
import type { BuilderState } from "./AiBuilderClient";
import type { AiBuilderModelChoice } from "./AiBuilderModelSelect";
import type { ProjectDiagnostics } from "./AiBuilderProjectInsights";
import { useCanonicalConfirm } from "@/app/components/ui/CanonicalConfirmDialog";
import AiBuilderWorkspaceView from "./AiBuilderWorkspaceView";

export const AI_BUILDER_SHOWCASE_SLIDES = [
  { id: "builder", label: "Builder" },
  { id: "review", label: "Review" },
  { id: "dashboard", label: "Dashboard" },
  { id: "insights", label: "Insights" },
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

function updatePreviewSession(session: AiBuilderSession, command: ReviewCommandRequest): AiBuilderSession {
  const now = new Date().toISOString();
  const nextContextEntries = session.contextEntries.map((entry) => {
    if (command.itemKind !== "context_entry" || entry.id !== command.itemId) return entry;
    if (command.kind === "approve" || command.kind === "restore") return { ...entry, status: "approved" as const, updatedAt: now };
    if (command.kind === "archive" || command.kind === "reject") return { ...entry, status: "archived" as const, updatedAt: now };
    if (command.kind === "unapprove") return { ...entry, status: "proposed" as const, updatedAt: now };
    return {
      ...entry,
      title: command.correction.title ?? entry.title,
      content: command.correction.content,
      status: "corrected" as const,
      updatedAt: now,
      metadata: { ...entry.metadata, userEdited: true },
    };
  });

  const nextFaqEntries = session.faqEntries.map((faq) => {
    if (command.itemKind !== "faq" || faq.id !== command.itemId) return faq;
    if (command.kind === "approve" || command.kind === "restore") return { ...faq, status: "approved" as const, updatedAt: now };
    if (command.kind === "archive" || command.kind === "reject") return { ...faq, status: "archived" as const, updatedAt: now };
    if (command.kind === "unapprove") return { ...faq, status: "proposed" as const, updatedAt: now };
    return {
      ...faq,
      question: command.correction.question,
      answer: command.correction.answer,
      status: "corrected" as const,
      updatedAt: now,
    };
  });

  const allItems = [...nextContextEntries, ...nextFaqEntries];
  const approved = allItems.filter((item) => item.status === "approved" || item.status === "corrected").length;
  const proposed = allItems.filter((item) => item.status === "proposed").length;
  const archived = allItems.filter((item) => item.status === "archived").length;

  return {
    ...session,
    contextEntries: nextContextEntries,
    faqEntries: nextFaqEntries,
    contextCounts: {
      ...session.contextCounts,
      total: allItems.length,
      approved,
      proposed,
      archived,
    },
    governanceRevision: (session.governanceRevision ?? 0) + 1,
    updatedAt: now,
  };
}

function buildPreviewDiagnostics(base: ProjectDiagnostics | null, session: AiBuilderSession): ProjectDiagnostics | null {
  if (!base) return null;
  const knowledgeCount = session.contextEntries.filter((item) => item.status !== "archived").length;
  const faqCount = session.faqEntries.filter((item) => item.status !== "archived").length;
  const latestGeneration = base.generations[0]
    ? {
        ...base.generations[0],
        knowledge_count: knowledgeCount,
        faq_count: faqCount,
        completed_at: session.updatedAt,
      }
    : undefined;
  return {
    crawls: base.crawls,
    generations: latestGeneration ? [latestGeneration, ...base.generations.slice(1)] : base.generations,
  };
}

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
  const [previewSession, setPreviewSession] = useState(session);
  const [demoOpen, setDemoOpen] = useState(false);
  const [previewBuilding, setPreviewBuilding] = useState(false);
  const [previewBuildStep, setPreviewBuildStep] = useState(0);
  const { showConfirm, confirmDialogNode } = useCanonicalConfirm();

  useEffect(() => {
    setBuilderValue(builder);
  }, [builder]);

  useEffect(() => {
    setPreviewSession(session);
  }, [session]);

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
      if (event.key === "Escape" && !previewBuilding) setDemoOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [demoOpen, previewBuilding]);

  const openDemo = async () => {
    const confirmed = await showConfirm({
      title: "Try the Interactive Demo?",
      message:
        "This demo builds a temporary Business Brain from the information you provide and lets you explore how the workspace works.\n\nAI is not used to deeply reason over your Business Brain or generate assistant responses during the demo. Paid plans use AI-powered reasoning for stronger understanding, deeper synthesis, and better answers.\n\nYour demo is temporary and will not be saved.",
      confirmLabel: "Start Demo",
      cancelLabel: "Cancel",
    });

    if (confirmed) {
      setBuilderValue(builder);
      setPreviewSession(session);
      setActiveSlide("builder");
      setDemoOpen(true);
    }
  };

  const runPreviewBuild = async () => {
    if (previewBuilding) return;
    setPreviewBuilding(true);
    setPreviewBuildStep(0);

    for (let step = 1; step <= 3; step += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 700));
      setPreviewBuildStep(step);
    }

    await new Promise((resolve) => window.setTimeout(resolve, 450));
    setPreviewBuilding(false);
    setActiveSlide("review");
  };

  const handlePreviewReviewCommand = async (command: ReviewCommandRequest) => {
    setPreviewSession((current) => updatePreviewSession(current, command));
  };

  const previewDiagnostics = useMemo(
    () => buildPreviewDiagnostics(diagnostics, previewSession),
    [diagnostics, previewSession],
  );

  const renderSurface = (interactive: boolean) => {
    const mode = interactive ? "preview" : "demo";
    const activeSession = interactive ? previewSession : session;
    const activeDiagnostics = interactive ? previewDiagnostics : diagnostics;

    if (activeSlide === "builder") {
      return (
        <AiBuilderWorkspaceView
          mode={mode}
          activeView="builder"
          session={activeSession}
          builder={builderValue}
          onBuilderChange={interactive ? setBuilderValue : undefined}
          onBuild={interactive ? runPreviewBuild : undefined}
          previewMode
        />
      );
    }

    if (activeSlide === "review") {
      return (
        <AiBuilderWorkspaceView
          mode={mode}
          activeView="review"
          session={activeSession}
          builder={builderValue}
          embeddedReview
          onReviewCommand={interactive ? handlePreviewReviewCommand : undefined}
        />
      );
    }

    if (activeSlide === "dashboard") {
      return <AiBuilderWorkspaceView mode={mode} activeView="dashboard" session={activeSession} builder={builderValue} diagnostics={activeDiagnostics} dashboardShowcase onNavigate={(destination) => destination === "knowledge" && setActiveSlide("review")} />;
    }

    return <AiBuilderWorkspaceView mode={mode} activeView="insights" session={activeSession} builder={builderValue} diagnostics={activeDiagnostics} />;
  };

  const showcaseSurface = useMemo(
    () => renderSurface(false),
    [activeSlide, builderValue, diagnostics, session],
  );

  const previewSurface = useMemo(
    () => renderSurface(true),
    [activeSlide, builderValue, previewBuilding, previewDiagnostics, previewSession],
  );

  const switcher = (compact = false) => (
    <div className={`grid grid-cols-4 gap-2 ${compact ? "w-full max-w-2xl" : ""}`}>
      {AI_BUILDER_SHOWCASE_SLIDES.map((slide) => (
        <button
          key={slide.id}
          type="button"
          onClick={() => !previewBuilding && setActiveSlide(slide.id)}
          disabled={previewBuilding}
          className={`rounded-lg border px-2 py-2 text-[11px] font-semibold transition sm:px-3 sm:text-xs ${
            activeSlide === slide.id
              ? "border-amber-300/30 bg-[#0a0a0a] text-white"
              : "border-white/[0.06] bg-[#030303] text-slate-500 hover:text-white"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {slide.label}
        </button>
      ))}
    </div>
  );

  const previewBuildLabels = [
    "Structuring your business details",
    "Creating temporary Business Brain knowledge",
    "Preparing the review workspace",
  ];

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

      <div className="mt-3">{switcher()}</div>

      <div className="mt-4 flex justify-center">
        <button type="button" onClick={openDemo} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-amber-300/30 bg-[#0a0a0a] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_35px_rgba(0,0,0,.32)] transition hover:border-amber-200/50 hover:bg-[#101010]">Open Demo</button>
      </div>

      {demoOpen ? (
        <div className="fixed inset-0 z-[200] flex min-h-0 flex-col bg-black" role="dialog" aria-modal="true" aria-label="AI Builder interactive demo">
          <div className="relative flex shrink-0 items-center justify-center border-b border-white/[0.08] bg-black/95 px-4 py-3 backdrop-blur sm:px-6 lg:hidden">
            <h2 className="text-sm font-semibold text-white sm:text-base"><span className="sm:hidden">Mobile Interactive Demo</span><span className="hidden sm:inline">Tablet Interactive Demo</span></h2>
            <button type="button" onClick={() => !previewBuilding && setDemoOpen(false)} disabled={previewBuilding} aria-label="Close demo" className="absolute right-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.1] bg-[#090909] text-xl leading-none text-white transition hover:border-amber-300/40 hover:bg-[#111] disabled:cursor-not-allowed disabled:opacity-40 sm:right-6">×</button>
          </div>

          <button type="button" onClick={() => !previewBuilding && setDemoOpen(false)} disabled={previewBuilding} aria-label="Close demo" className="absolute right-6 top-6 z-10 hidden h-10 w-10 items-center justify-center rounded-full border border-white/[0.1] bg-[#090909] text-xl leading-none text-white transition hover:border-amber-300/40 hover:bg-[#111] disabled:cursor-not-allowed disabled:opacity-40 lg:inline-flex">×</button>

          <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain bg-black">
            <div className="min-h-full">{previewSurface}</div>
            {previewBuilding ? (
              <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                <div className="w-full max-w-lg rounded-[26px] border border-amber-300/25 bg-[#050505] p-6 text-center shadow-[0_30px_100px_rgba(0,0,0,.72)] sm:p-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">Interactive demo</p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">Building your temporary Business Brain</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-400">This uses deterministic demo data only. Nothing is saved and no AI reasoning is running.</p>
                  <div className="mt-6 space-y-3 text-left">
                    {previewBuildLabels.map((label, index) => {
                      const complete = previewBuildStep > index;
                      const active = previewBuildStep === index;
                      return (
                        <div key={label} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-black/40 px-4 py-3">
                          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold ${complete ? "border-amber-300/30 bg-amber-300/10 text-amber-200" : active ? "border-white/20 text-white" : "border-white/10 text-slate-600"}`}>{complete ? "✓" : index + 1}</span>
                          <span className={complete || active ? "text-sm text-white" : "text-sm text-slate-500"}>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-white/[0.08] bg-black/95 px-3 py-3 backdrop-blur sm:px-5"><div className="mx-auto flex justify-center">{switcher(true)}</div></div>
        </div>
      ) : null}
    </div>
  );
}
