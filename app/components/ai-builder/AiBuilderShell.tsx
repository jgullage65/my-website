import { ReactNode } from "react";

export default function AiBuilderShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#06101f] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-18rem] h-[34rem] w-[52rem] -translate-x-1/2 rounded-full bg-amber-500/[0.08] blur-[120px]" />
        <div className="absolute bottom-[-22rem] left-[-14rem] h-[38rem] w-[38rem] rounded-full bg-blue-500/[0.05] blur-[130px]" />
        <div className="absolute right-[-18rem] top-[38rem] h-[34rem] w-[34rem] rounded-full bg-amber-300/[0.04] blur-[120px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:linear-gradient(to_bottom,black,transparent_72%)]" />
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-20">
        {children}
      </div>
    </main>
  );
}
