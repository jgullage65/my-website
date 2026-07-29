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
