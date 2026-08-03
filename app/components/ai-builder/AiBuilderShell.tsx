"use client";

import { ReactNode, useEffect } from "react";
import ImpersonationBanner from "./ImpersonationBanner";
import {
  applyAiBuilderPreferences,
  loadAiBuilderPreferences,
} from "./AiBuilderSettings";

export default function AiBuilderShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.body.dataset.aiBuilderWorkspace = "true";
    const preferences = loadAiBuilderPreferences();
    applyAiBuilderPreferences(preferences);

    let cleanupThemeListener: (() => void) | undefined;
    if (preferences.theme === "system") {
      const media = window.matchMedia("(prefers-color-scheme: light)");
      const sync = () => applyAiBuilderPreferences(preferences);
      media.addEventListener("change", sync);
      cleanupThemeListener = () => media.removeEventListener("change", sync);
    }

    return () => {
      cleanupThemeListener?.();
      delete document.body.dataset.aiBuilderWorkspace;
    };
  }, []);

  return (
    <>
      <style jsx global>{`
        body[data-ai-builder-workspace="true"] {
          background: #000;
        }

        body[data-ai-builder-workspace="true"] footer {
          display: none;
        }

        body[data-ai-builder-workspace="true"] .site-page-shell {
          min-height: 0;
          background: #000;
        }

        body[data-ai-builder-workspace="true"] .ai-builder-shell {
          width: 100%;
          min-height: 100dvh;
          background: #000;
        }

        body[data-ai-builder-workspace="true"] .ai-builder-shell__content {
          width: 100%;
          max-width: none;
          min-height: 100dvh;
          margin: 0;
          padding: 0;
          background: #000;
        }

        @media (max-width: 1279px) {
          body[data-ai-builder-workspace="true"]
            .ai-builder-shell__content
            article[class*="bg-[#070707]"] {
            background-color: #020202 !important;
          }
        }

        @media (max-width: 1199.99px) {
          body[data-ai-builder-workspace="true"]
            .ai-builder-shell__content
            section[class~="min-w-0"][class~="sm:grid-cols-2"][class~="xl:grid-cols-4"]
            > article:first-child
            > p:nth-child(2),
          body[data-ai-builder-workspace="true"]
            .ai-builder-shell__content
            section[class~="min-w-0"][class~="sm:grid-cols-2"][class~="xl:grid-cols-4"]
            > article:nth-child(4)
            > p:nth-child(2),
          body[data-ai-builder-workspace="true"]
            .ai-builder-shell__content
            section[class~="sm:grid-cols-2"][class~="xl:grid-cols-4"]
            > article:first-child
            > p:nth-child(2)[class~="truncate"] {
            font-size: 0.8rem !important;
            line-height: 1.05rem !important;
            letter-spacing: 0 !important;
          }
        }

        @media (max-width: 639px) {
          body[data-ai-builder-workspace="true"]
            .ai-builder-shell__content
            section[class~="sm:grid-cols-2"][class~="xl:grid-cols-4"] {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0.625rem;
          }

          body[data-ai-builder-workspace="true"]
            .ai-builder-shell__content
            section[class~="sm:grid-cols-2"][class~="xl:grid-cols-4"]
            > article {
            min-width: 0;
            border-radius: 14px;
            padding: 0.75rem;
          }

          body[data-ai-builder-workspace="true"]
            .ai-builder-shell__content
            section[class~="sm:grid-cols-2"][class~="xl:grid-cols-4"]
            > article
            > p:first-child {
            font-size: 0.6rem;
            line-height: 0.85rem;
            letter-spacing: 0.1em;
          }

          body[data-ai-builder-workspace="true"]
            .ai-builder-shell__content
            section[class~="sm:grid-cols-2"][class~="xl:grid-cols-4"]
            > article
            > p:nth-child(2) {
            margin-top: 0.35rem;
            font-size: 1.25rem;
            line-height: 1.5rem;
          }

          body[data-ai-builder-workspace="true"]
            .ai-builder-shell__content
            section[class~="sm:grid-cols-2"][class~="xl:grid-cols-4"]
            > article
            > p:nth-child(3) {
            margin-top: 0.35rem;
            font-size: 0.68rem;
            line-height: 1rem;
          }

          body[data-ai-builder-workspace="true"]
            .ai-builder-shell__content
            div[class*="xl:grid-cols-[minmax(0,1fr)_160px_160px_160px]"]
            input,
          body[data-ai-builder-workspace="true"]
            .ai-builder-shell__content
            div[class*="xl:grid-cols-[minmax(0,1fr)_160px_160px_160px]"]
            select {
            text-align: center;
            text-align-last: center;
          }

          body[data-ai-builder-workspace="true"]
            .ai-builder-shell__content
            div[class*="xl:grid-cols-[minmax(0,1fr)_160px_160px_160px]"]
            input::placeholder {
            text-align: center;
          }

          body[data-ai-builder-workspace="true"]
            .ai-builder-shell__content
            div[class*="xl:grid-cols-[minmax(0,1fr)_160px_160px_160px]"]
            + div[class~="divide-y"]
            > div,
          body[data-ai-builder-workspace="true"]
            .ai-builder-shell__content
            div[class*="xl:grid-cols-[minmax(0,1fr)_160px_160px_160px]"]
            + div[class~="divide-y"]
            > div
            > div {
            text-align: center;
          }

          body[data-ai-builder-workspace="true"]
            .ai-builder-shell__content
            div[class*="xl:grid-cols-[minmax(0,1fr)_160px_160px_160px]"]
            + div[class~="divide-y"]
            > div
            a {
            justify-content: center;
            text-align: center;
          }

          body[data-ai-builder-workspace="true"]
            .ai-builder-shell__content
            div[class*="xl:grid-cols-[minmax(0,1fr)_160px_160px_160px]"]
            + div[class~="divide-y"]
            > div
            > div:last-child {
            justify-content: center;
          }
        }

        @media (min-width: 1280px) {
          body[data-ai-builder-workspace="true"] .ai-builder-shell {
            height: 100dvh;
            min-height: 0;
            overflow: hidden;
          }

          body[data-ai-builder-workspace="true"] .ai-builder-shell__content {
            height: 100%;
            min-height: 0;
            overflow: hidden;
          }
        }
      `}</style>

      <section className="ai-builder-shell relative w-full bg-black text-white">
        <div className="ai-builder-shell__content w-full bg-black">
          <ImpersonationBanner />
          {children}
        </div>
      </section>
    </>
  );
}
