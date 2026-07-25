"use client";

import { ReactNode, useEffect } from "react";
import ImpersonationBanner from "./ImpersonationBanner";

export default function AiBuilderShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.body.dataset.aiBuilderWorkspace = "true";

    return () => {
      delete document.body.dataset.aiBuilderWorkspace;
    };
  }, []);

  return (
    <>
      <style jsx global>{`
        @media (max-width: 1199.99px) {
          body[data-ai-builder-workspace="true"] .ai-builder-shell {
            width: 100vw;
            min-height: calc(100dvh - 56px);
          }

          body[data-ai-builder-workspace="true"] .ai-builder-shell__content {
            width: 100%;
            max-width: none;
            min-height: calc(100dvh - 56px);
            margin: 0;
            padding: 0;
          }
        }

        @media (min-width: 1280px) {
          body[data-ai-builder-workspace="true"] footer {
            display: none;
          }

          body[data-ai-builder-workspace="true"] .site-page-shell {
            min-height: 0;
          }
        }
      `}</style>

      <section className="ai-builder-shell relative min-h-screen text-white xl:h-[calc(100dvh-56px)] xl:min-h-0 xl:overflow-hidden xl:rounded-none">
        <div className="ai-builder-shell__content mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-20 xl:h-full xl:max-w-none xl:overflow-hidden xl:rounded-none xl:px-0 xl:py-0">
          <ImpersonationBanner />
          {children}
        </div>
      </section>
    </>
  );
}
