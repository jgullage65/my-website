import { ReactNode } from "react";

export default function AiBuilderShell({ children }: { children: ReactNode }) {
  return (
    <section className="relative min-h-screen text-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-20">
        {children}
      </div>
    </section>
  );
}
