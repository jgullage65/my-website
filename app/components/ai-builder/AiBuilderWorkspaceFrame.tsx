"use client";

import { SignOutButton } from "@clerk/nextjs";
import { ReactNode, useEffect, useState } from "react";
import AiBuilderDesktopScrollArea from "./AiBuilderDesktopScrollArea";
import AiBuilderShell from "./AiBuilderShell";

type NavigationItem = {
  value: string;
  label: string;
  active?: boolean;
  mobileOnly?: boolean;
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
  const visibleItems = items.filter((item) => item.value !== "overview");
  const desktopItems = visibleItems.filter((item) => !item.mobileOnly);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [mobileMenuOpen]);

  const select = (action: () => void) => {
    setMobileMenuOpen(false);
    action();
  };

  const selectBuilder = () => {
    if (builderActive) {
      select(onBuilderSelect);
      return;
    }

    setMobileMenuOpen(false);
    window.location.assign("/brain-builder/new");
  };

  const renderNavigation = (navigationItems: NavigationItem[]) => (
    <>
      <button
        type="button"
        onClick={selectBuilder}
        className={`relative mb-0.5 w-full rounded-lg px-3 py-2.5 text-left text-[0.82rem] font-semibold transition ${
          builderActive
            ? "bg-white/[0.07] text-amber-200 before:absolute before:bottom-2 before:left-0 before:top-2 before:w-0.5 before:rounded-full before:bg-amber-300"
            : "text-white hover:bg-white/[0.055] hover:text-amber-200"
        }`}
      >
        Brain Builder
      </button>
      <p className="mt-4 px-3 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-white">Workspace</p>
      <nav className="mt-3 space-y-0.5" aria-label="AI Builder workspace">
        {navigationItems.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => select(item.onSelect)}
            aria-current={item.active ? "page" : undefined}
            className={`relative flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[0.82rem] font-semibold transition ${
              item.active
                ? "bg-white/[0.07] text-amber-200 before:absolute before:bottom-2 before:left-0 before:top-2 before:w-0.5 before:rounded-full before:bg-amber-300"
                : "text-white hover:bg-white/[0.055] hover:text-amber-200"
            }`}
          >
            <span>{item.label}</span>
            {item.active ? <span aria-hidden="true" className="text-[0.65rem] text-amber-300">●</span> : null}
          </button>
        ))}
      </nav>
    </>
  );

  return (
    <AiBuilderShell>
      <div
        className={`relative grid min-h-[70vh] w-full overflow-hidden border-y border-white/[0.1] bg-[#102A43] xl:h-full xl:min-h-0 ${
          rightRail
            ? "grid-cols-1 xl:grid-cols-[208px_minmax(0,1fr)_400px] min-[1500px]:grid-cols-[220px_minmax(0,1fr)_420px]"
            : "grid-cols-1 xl:grid-cols-[208px_minmax(0,1fr)] min-[1500px]:grid-cols-[220px_minmax(0,1fr)]"
        }`}
      >
        <aside className="hidden min-h-0 flex-col border-r border-white/[0.1] bg-[#0D2438] px-4 py-5 xl:flex">
          <div className="mb-5 flex min-h-[92px] items-center justify-center border-b border-white/[0.1] pb-5">
            <img src="/image/Arkenalogo.png" alt="Arkena Studio" className="h-auto max-h-20 w-full max-w-[188px] object-contain" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">{renderNavigation(desktopItems)}</div>
          <div className="mt-4 border-t border-white/[0.1] pt-4">
            <SignOutButton redirectUrl="/brain-builder">
              <button type="button" className="w-full rounded-lg px-3 py-2.5 text-left text-[0.82rem] font-semibold text-white transition hover:bg-white/[0.055] hover:text-amber-200">Sign out</button>
            </SignOutButton>
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-col bg-[#12304D]">
          <header className="sticky top-0 z-40 flex min-h-[68px] flex-none items-center justify-center border-b border-white/[0.1] bg-[#12304D] px-16 text-center xl:static xl:min-h-[76px] xl:px-6 xl:py-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open workspace menu"
              aria-haspopup="dialog"
              aria-expanded={mobileMenuOpen}
              className="absolute left-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg border border-white/[0.1] bg-[#163A5F] text-lg text-slate-100 xl:hidden"
            >
              ☰
            </button>
            <h1 className="truncate text-sm font-semibold text-slate-100 xl:text-xl">{title}</h1>
          </header>

          <AiBuilderDesktopScrollArea>{children}</AiBuilderDesktopScrollArea>
        </main>

        {rightRail ? <aside className="hidden min-h-0 flex-col border-l border-white/[0.1] bg-[#0F2942] xl:flex">{rightRail}</aside> : null}

        {mobileMenuOpen ? (
          <div
            className="fixed inset-0 z-[90] bg-[#081A2A]/80 xl:hidden"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setMobileMenuOpen(false);
            }}
          >
            <aside
              role="dialog"
              aria-modal="true"
              aria-label="AI Builder workspace navigation"
              className="flex h-[100dvh] w-[min(240px,88vw)] flex-col overflow-hidden border-r border-white/[0.1] bg-[#0D2438] px-4 py-5 shadow-[20px_0_60px_rgba(0,0,0,.35)]"
            >
              <div className="mb-5 flex shrink-0 items-center justify-end">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close workspace menu"
                  className="grid h-10 w-10 place-items-center rounded-lg border border-white/[0.1] bg-[#163A5F] text-2xl text-slate-300 transition hover:text-white"
                >
                  ×
                </button>
              </div>
              <div className="mb-5 flex min-h-[84px] shrink-0 items-center justify-center border-b border-white/[0.1] pb-5">
                <img src="/image/Arkenalogo.png" alt="Arkena Studio" className="h-auto max-h-16 w-full max-w-[184px] object-contain" />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] touch-pan-y [&::-webkit-scrollbar]:hidden">
                {renderNavigation(visibleItems)}
              </div>
              <div className="mt-4 shrink-0 border-t border-white/[0.1] pt-4">
                <SignOutButton redirectUrl="/brain-builder">
                  <button type="button" className="w-full rounded-lg px-3 py-2.5 text-left text-[0.82rem] font-semibold text-white transition hover:bg-white/[0.055] hover:text-amber-200">Sign out</button>
                </SignOutButton>
              </div>
            </aside>
          </div>
        ) : null}

        {overlays}
      </div>
    </AiBuilderShell>
  );
}
