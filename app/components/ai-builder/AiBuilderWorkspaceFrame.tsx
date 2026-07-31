"use client";

import { SignOutButton } from "@clerk/nextjs";
import { ReactNode, useState } from "react";
import AiBuilderDesktopScrollArea from "./AiBuilderDesktopScrollArea";
import AiBuilderShell from "./AiBuilderShell";

type NavigationItem = {
  value: string;
  label: string;
  active?: boolean;
  onSelect: () => void;
};

type Props = {
  title: string;
  items: NavigationItem[];
  onBuilderSelect: () => void;
  builderActive?: boolean;
  children: ReactNode;
  rightRail?: ReactNode;
  overlays?: ReactNode;
};

export default function AiBuilderWorkspaceFrame({
  title,
  items,
  onBuilderSelect,
  builderActive = false,
  children,
  rightRail,
  overlays,
}: Props) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const select = (action: () => void) => {
    setMobileMenuOpen(false);
    action();
  };

  const navigation = (
    <>
      <button
        type="button"
        onClick={() => select(onBuilderSelect)}
        className={`relative mb-0.5 w-full rounded-lg px-3 py-2.5 text-left text-[0.82rem] font-semibold transition ${
          builderActive
            ? "bg-white/[0.055] text-amber-200 before:absolute before:bottom-2 before:left-0 before:top-2 before:w-0.5 before:rounded-full before:bg-amber-300"
            : "text-white hover:bg-white/[0.035] hover:text-amber-200"
        }`}
      >
        AI Builder
      </button>
      <p className="mt-4 px-3 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-white">Workspace</p>
      <nav className="mt-3 space-y-0.5">
        {items.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => select(item.onSelect)}
            className={`relative w-full rounded-lg px-3 py-2.5 text-left text-[0.82rem] font-semibold transition ${
              item.active
                ? "bg-white/[0.055] text-amber-200 before:absolute before:bottom-2 before:left-0 before:top-2 before:w-0.5 before:rounded-full before:bg-amber-300"
                : "text-white hover:bg-white/[0.035] hover:text-amber-200"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </>
  );

  return (
    <AiBuilderShell>
      <div className={`relative hidden h-full min-h-0 w-full overflow-hidden border-y border-white/[0.08] bg-[#020202] xl:grid ${rightRail ? "xl:grid-cols-[208px_minmax(0,1fr)_400px] min-[1500px]:grid-cols-[220px_minmax(0,1fr)_420px]" : "xl:grid-cols-[208px_minmax(0,1fr)] min-[1500px]:grid-cols-[220px_minmax(0,1fr)]"}`}>
        <aside className="flex min-h-0 flex-col border-r border-white/[0.08] bg-[#050505] px-4 py-5">
          <div className="mb-5 flex min-h-[92px] items-center justify-center border-b border-white/[0.08] pb-5">
            <img src="/image/Arkenalogo.png" alt="Arkena Studio" className="h-auto max-h-20 w-full max-w-[188px] object-contain" />
          </div>
          {navigation}
          <div className="mt-0.5">
            <SignOutButton redirectUrl="/ai-builder">
              <button type="button" className="w-full rounded-lg px-3 py-2.5 text-left text-[0.82rem] font-semibold text-white transition hover:bg-white/[0.035] hover:text-amber-200">Sign out</button>
            </SignOutButton>
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-col bg-[#020202]">
          <header className="flex min-h-[76px] flex-none items-center justify-center border-b border-white/[0.08] px-6 py-3 text-center">
            <h1 className="truncate text-xl font-semibold text-slate-100">{title}</h1>
          </header>
          <AiBuilderDesktopScrollArea>{children}</AiBuilderDesktopScrollArea>
        </main>

        {rightRail ? <aside className="flex min-h-0 flex-col border-l border-white/[0.08] bg-black">{rightRail}</aside> : null}
        {overlays}
      </div>

      <div className="xl:hidden">
        <div className="min-h-[70vh] bg-black">
          <header className="sticky top-0 z-40 flex min-h-[68px] items-center justify-center border-b border-white/[0.08] bg-black/95 px-16 text-center backdrop-blur">
            <button type="button" onClick={() => setMobileMenuOpen(true)} aria-label="Open workspace menu" className="absolute left-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg border border-white/[0.1] bg-[#080808] text-lg text-slate-200">☰</button>
            <p className="truncate text-sm font-semibold text-white">{title}</p>
          </header>
          {mobileMenuOpen ? (
            <div className="fixed inset-0 z-[90] bg-black/70" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMobileMenuOpen(false); }}>
              <aside role="dialog" aria-modal="true" className="flex h-fit max-h-dvh w-[min(220px,86vw)] flex-col overflow-y-auto rounded-br-xl border-b border-r border-white/[0.08] bg-[#050505] px-4 py-5 shadow-[0_18px_50px_rgba(0,0,0,0.55)]">
                <div className="mb-5 flex items-center justify-end"><button type="button" onClick={() => setMobileMenuOpen(false)} className="text-2xl text-slate-400">×</button></div>
                <div className="mb-5 flex min-h-[84px] items-center justify-center border-b border-white/[0.08] pb-5"><img src="/image/Arkenalogo.png" alt="Arkena Studio" className="h-auto max-h-16 w-full max-w-[184px] object-contain" /></div>
                {navigation}
                <div className="mt-0.5"><SignOutButton redirectUrl="/ai-builder"><button type="button" className="w-full rounded-lg px-3 py-2.5 text-left text-[0.82rem] font-semibold text-white transition hover:bg-white/[0.035] hover:text-amber-200">Sign out</button></SignOutButton></div>
              </aside>
            </div>
          ) : null}
          <main className="px-4 py-5 sm:px-6 sm:py-6">{children}</main>
        </div>
      </div>
    </AiBuilderShell>
  );
}
