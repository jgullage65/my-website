"use client";

import { SignOutButton } from "@clerk/nextjs";
import { useState } from "react";
import AiBuilderDesktopScrollArea from "./AiBuilderDesktopScrollArea";
import AiBuilderForm from "./AiBuilderForm";
import AiBuilderShell from "./AiBuilderShell";
import type { BuilderState } from "./AiBuilderClient";

type Props = {
  builder: BuilderState;
  error?: string | null;
  onChange: (value: BuilderState) => void;
  onBuild: () => void;
};

const WORKSPACE_ITEMS = [
  "Projects",
  "Dashboard",
  "Project Insights",
  "Overview",
  "Business Knowledge",
  "Sources",
  "Settings",
] as const;

export default function AiBuilderEmptyWorkspace({ builder, error = null, onChange, onBuild }: Props) {
  const [mobileWorkspaceMenuOpen, setMobileWorkspaceMenuOpen] = useState(false);

  return (
    <AiBuilderShell>
      <div className="hidden h-full min-h-0 w-full overflow-hidden border-y border-white/[0.08] bg-[#020202] xl:grid xl:grid-cols-[208px_minmax(0,1fr)] min-[1500px]:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r border-white/[0.08] bg-[#050505] px-4 py-5">
          <div className="mb-5 flex min-h-[92px] items-center justify-center border-b border-white/[0.08] pb-5">
            <img src="/image/Arkenalogo.png" alt="Arkena Studio" className="h-auto max-h-20 w-full max-w-[188px] object-contain" />
          </div>
          <button type="button" className="relative mb-0.5 w-full rounded-lg bg-white/[0.055] px-3 py-2.5 text-left text-[0.82rem] font-semibold text-amber-200 before:absolute before:bottom-2 before:left-0 before:top-2 before:w-0.5 before:rounded-full before:bg-amber-300">
            AI Builder
          </button>
          <p className="mt-4 px-3 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-white">Workspace</p>
          <nav className="mt-3 space-y-0.5">
            {WORKSPACE_ITEMS.map((label) => (
              <button key={label} type="button" className="w-full rounded-lg px-3 py-2.5 text-left text-[0.82rem] font-semibold text-white transition hover:bg-white/[0.035] hover:text-amber-200">
                {label}
              </button>
            ))}
          </nav>
          <div className="mt-0.5">
            <SignOutButton redirectUrl="/ai-builder">
              <button type="button" className="w-full rounded-lg px-3 py-2.5 text-left text-[0.82rem] font-semibold text-white transition hover:bg-white/[0.035] hover:text-amber-200">Sign out</button>
            </SignOutButton>
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-col bg-[#020202]">
          <header className="flex min-h-[76px] flex-none items-center justify-center border-b border-white/[0.08] px-6 py-3 text-center">
            <h1 className="truncate text-xl font-semibold text-slate-100">AI Builder</h1>
          </header>
          <AiBuilderDesktopScrollArea>
            <div className="ai-builder-form mx-auto w-full max-w-[1500px]">
              {error ? <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
              <AiBuilderForm value={builder} onChange={onChange} onBuild={onBuild} />
            </div>
          </AiBuilderDesktopScrollArea>
        </main>
      </div>

      <div className="xl:hidden">
        <div className="min-h-[70vh] bg-black">
          <header className="sticky top-0 z-40 flex min-h-[68px] items-center justify-center border-b border-white/[0.08] bg-black/95 px-16 text-center backdrop-blur">
            <button type="button" onClick={() => setMobileWorkspaceMenuOpen(true)} aria-label="Open workspace menu" className="absolute left-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg border border-white/[0.1] bg-[#080808] text-lg text-slate-200">☰</button>
            <p className="truncate text-sm font-semibold text-white">AI Builder</p>
          </header>
          {mobileWorkspaceMenuOpen ? (
            <div className="fixed inset-0 z-[90] bg-black/70" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMobileWorkspaceMenuOpen(false); }}>
              <aside role="dialog" aria-modal="true" className="flex h-fit max-h-dvh w-[min(220px,86vw)] flex-col overflow-y-auto rounded-br-xl border-b border-r border-white/[0.08] bg-[#050505] px-4 py-5 shadow-[0_18px_50px_rgba(0,0,0,0.55)]">
                <div className="mb-5 flex items-center justify-end"><button type="button" onClick={() => setMobileWorkspaceMenuOpen(false)} className="text-2xl text-slate-400">×</button></div>
                <div className="mb-5 flex min-h-[84px] items-center justify-center border-b border-white/[0.08] pb-5"><img src="/image/Arkenalogo.png" alt="Arkena Studio" className="h-auto max-h-16 w-full max-w-[184px] object-contain" /></div>
                <nav className="space-y-0.5">
                  <button type="button" className="w-full rounded-lg bg-white/[0.055] px-3 py-2.5 text-left text-[0.82rem] font-semibold text-amber-200">AI Builder</button>
                  {WORKSPACE_ITEMS.map((label) => <button key={label} type="button" className="w-full rounded-lg px-3 py-2.5 text-left text-[0.82rem] font-semibold text-white hover:bg-white/[0.04]">{label}</button>)}
                </nav>
                <div className="mt-0.5"><SignOutButton redirectUrl="/ai-builder"><button type="button" className="w-full rounded-lg px-3 py-2.5 text-left text-[0.82rem] font-semibold text-white transition hover:bg-white/[0.035] hover:text-amber-200">Sign out</button></SignOutButton></div>
              </aside>
            </div>
          ) : null}
          <main className="px-4 py-5 sm:px-6 sm:py-6">
            <div className="ai-builder-form">
              {error ? <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
              <AiBuilderForm value={builder} onChange={onChange} onBuild={onBuild} />
            </div>
          </main>
        </div>
      </div>
    </AiBuilderShell>
  );
}
