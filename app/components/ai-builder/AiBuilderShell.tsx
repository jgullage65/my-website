import { ReactNode } from "react";
import ImpersonationBanner from "./ImpersonationBanner";

export default function AiBuilderShell({ children }: { children: ReactNode }) {
  return (
    <section className="ai-builder-shell relative min-h-screen text-white xl:fixed xl:inset-x-0 xl:bottom-0 xl:top-[74px] xl:z-40 xl:min-h-0 xl:overflow-hidden xl:rounded-none xl:bg-[#020611]">
      <div className="ai-builder-shell__content mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-20 xl:h-full xl:max-w-none xl:overflow-hidden xl:rounded-none xl:px-0 xl:py-0">
        <ImpersonationBanner />
        {children}
      </div>
    </section>
  );
}
