"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
import type { PersistedWebsiteKnowledge } from "@/app/lib/ai-engine/knowledge/websiteKnowledge";
import type { BuilderState } from "./AiBuilderClient";
import type { AiBuilderModelChoice } from "./AiBuilderModelSelect";
import type { ProjectDiagnostics } from "./AiBuilderProjectInsights";
import { useCanonicalConfirm } from "@/app/components/ui/CanonicalConfirmDialog";
import AiBuilderWorkspaceView from "./AiBuilderWorkspaceView";
import AiBuilderDeterministicDemoWorkspace from "./AiBuilderDeterministicDemoWorkspace";

export const AI_BUILDER_SHOWCASE_SLIDES = [
  { id: "builder", label: "AI Builder" },
  { id: "dashboard", label: "Dashboard" },
  { id: "insights", label: "Project Insights" },
  { id: "review", label: "Business Knowledge" },
  { id: "sources", label: "Sources" },
] as const;

export type AiBuilderShowcaseSlide = (typeof AI_BUILDER_SHOWCASE_SLIDES)[number]["id"];

const SHOWCASE_VIEWPORT_CLASS = "h-[clamp(430px,calc(100dvh-360px),620px)]";
const heroButtonClass =
  "cta-raised inline-flex min-h-12 items-center justify-center rounded-xl border border-amber-300/20 bg-[#080808] px-5 py-3 text-sm font-black text-white shadow-[0_10px_24px_rgba(0,0,0,.28),inset_0_1px_0_rgba(255,255,255,.05)] transition duration-300 hover:-translate-y-0.5 hover:border-amber-300/35 hover:bg-[#111111]";

const showcaseWebsiteKnowledge = {
  schema_version: 2,
  document_version: 1,
  current_crawl_attempt_id: "landing-demo-crawl-3",
  imported_at: "2026-07-18T21:42:14.000Z",
  requested_url: "https://arkena.studio",
  resolved_url: "https://arkena.studio",
  pages: [
    {
      url: "https://arkena.studio",
      title: "Arkena Studio",
      pageType: "website",
      sourceDocumentId: "landing-source-home",
    },
    {
      url: "https://arkena.studio/services",
      title: "AI Products and Automation Services",
      pageType: "website",
      sourceDocumentId: "landing-source-services",
    },
    {
      url: "https://arkena.studio/ai-builder",
      title: "AI Builder",
      pageType: "website",
      sourceDocumentId: "landing-source-builder",
    },
    {
      url: "https://arkena.studio/about",
      title: "About Arkena Studio",
      pageType: "website",
      sourceDocumentId: "landing-source-about",
    },
    {
      url: "https://arkena.studio/contact",
      title: "Contact",
      pageType: "website",
      sourceDocumentId: "landing-source-contact",
    },
    {
      url: "https://arkena.studio/privacy",
      title: "Privacy Policy",
      pageType: "website",
      sourceDocumentId: "landing-source-privacy",
    },
  ],
  warnings: [
    "Duplicate page content was skipped during extraction.",
  ],
  knowledge: {
    facts: [],
    coverage: {},
    unresolvedQuestions: [],
  },
  source_documents: [
    {
      id: "landing-source-home",
      url: "https://arkena.studio",
      canonicalUrl: "https://arkena.studio",
      title: "Arkena Studio",
      sourceType: "html",
      contentType: "text/html",
      fetchedAt: "2026-07-18T21:42:01.000Z",
      status: "retained",
      sourceTruncated: false,
      extractionTruncated: false,
    },
    {
      id: "landing-source-services",
      url: "https://arkena.studio/services",
      canonicalUrl: "https://arkena.studio/services",
      title: "AI Products and Automation Services",
      sourceType: "html",
      contentType: "text/html",
      fetchedAt: "2026-07-18T21:42:04.000Z",
      status: "retained",
      sourceTruncated: false,
      extractionTruncated: false,
    },
    {
      id: "landing-source-builder",
      url: "https://arkena.studio/ai-builder",
      canonicalUrl: "https://arkena.studio/ai-builder",
      title: "AI Builder",
      sourceType: "rendered_html",
      contentType: "text/html",
      fetchedAt: "2026-07-18T21:42:07.000Z",
      status: "retained",
      sourceTruncated: false,
      extractionTruncated: false,
    },
    {
      id: "landing-source-about",
      url: "https://arkena.studio/about",
      canonicalUrl: "https://arkena.studio/about",
      title: "About Arkena Studio",
      sourceType: "html",
      contentType: "text/html",
      fetchedAt: "2026-07-18T21:42:09.000Z",
      status: "retained",
      sourceTruncated: false,
      extractionTruncated: false,
    },
    {
      id: "landing-source-contact",
      url: "https://arkena.studio/contact",
      canonicalUrl: "https://arkena.studio/contact",
      title: "Contact",
      sourceType: "html",
      contentType: "text/html",
      fetchedAt: "2026-07-18T21:42:11.000Z",
      status: "retained",
      sourceTruncated: false,
      extractionTruncated: false,
    },
    {
      id: "landing-source-privacy",
      url: "https://arkena.studio/privacy",
      canonicalUrl: "https://arkena.studio/privacy",
      title: "Privacy Policy",
      sourceType: "html",
      contentType: "text/html",
      fetchedAt: "2026-07-18T21:42:13.000Z",
      status: "retained",
      sourceTruncated: false,
      extractionTruncated: false,
    },
  ],
  source_blocks: [],
} as unknown as PersistedWebsiteKnowledge;

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
  const [heroActions, setHeroActions] = useState<HTMLElement | null>(null);
  const { showConfirm, confirmDialogNode } = useCanonicalConfirm();

  useEffect(() => {
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("button"));
    const signInButton = buttons.find((button) => {
      if (button.textContent?.trim() !== "Sign In") return false;
      return Array.from(button.parentElement?.children ?? []).some(
        (sibling) => sibling.textContent?.trim() === "Plans",
      );
    });
    setHeroActions(signInButton?.parentElement ?? null);
  }, []);

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
        "Explore the full AI Builder workspace without signing in. You can move through the platform, review the Business Brain, and test the assistant. Your demo is temporary and resets when you close it.",
      confirmLabel: "Open Full Demo",
      cancelLabel: "Cancel",
    });
    if (confirmed) setDemoOpen(true);
  };

  let showcaseSurface = null;

  if (activeSlide === "builder") {
    showcaseSurface = (
      <AiBuilderWorkspaceView
        mode="demo"
        activeView="builder"
        session={session}
        builder={builder}
        websiteKnowledge={showcaseWebsiteKnowledge}
        diagnostics={diagnostics}
        previewMode
      />
    );
  } else if (activeSlide === "dashboard") {
    showcaseSurface = (
      <AiBuilderWorkspaceView
        mode="demo"
        activeView="dashboard"
        session={session}
        builder={builder}
        websiteKnowledge={showcaseWebsiteKnowledge}
        diagnostics={diagnostics}
        dashboardShowcase
      />
    );
  } else if (activeSlide === "insights") {
    showcaseSurface = (
      <AiBuilderWorkspaceView
        mode="demo"
        activeView="insights"
        session={session}
        builder={builder}
        websiteKnowledge={showcaseWebsiteKnowledge}
        diagnostics={diagnostics}
      />
    );
  } else if (activeSlide === "review") {
    showcaseSurface = (
      <AiBuilderWorkspaceView
        mode="demo"
        activeView="review"
        session={session}
        builder={builder}
        websiteKnowledge={showcaseWebsiteKnowledge}
        diagnostics={diagnostics}
        embeddedReview
      />
    );
  } else {
    showcaseSurface = (
      <AiBuilderWorkspaceView
        mode="demo"
        activeView="sources"
        session={session}
        builder={builder}
        websiteKnowledge={showcaseWebsiteKnowledge}
        diagnostics={diagnostics}
      />
    );
  }

  return (
    <div className={className}>
      {confirmDialogNode}
      {heroActions
        ? createPortal(
            <button type="button" onClick={openDemo} className={heroButtonClass}>
              Open Demo
            </button>,
            heroActions,
          )
        : null}

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
