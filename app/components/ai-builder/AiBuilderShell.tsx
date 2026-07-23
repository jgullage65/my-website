import { ReactNode } from "react";
import ImpersonationBanner from "./ImpersonationBanner";

export default function AiBuilderShell({ children }: { children: ReactNode }) {
  return (
    <section className="ai-builder-shell relative min-h-screen text-white">
      <div className="ai-builder-shell__content mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-20">
        <ImpersonationBanner />
        {children}
      </div>
    </section>
  );
}
