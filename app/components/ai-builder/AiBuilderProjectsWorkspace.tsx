"use client";

import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import AiBuilderProjects from "./AiBuilderProjects";
import AiBuilderShell from "./AiBuilderShell";
import { aiBuilderCornerCtaClassName } from "./AiBuilderAuthCta";

export default function AiBuilderProjectsWorkspace() {
  return (
    <AiBuilderShell>
      <div className="relative hidden h-full min-h-0 w-full overflow-hidden border-y border-white/[0.08] bg-[#020202] xl:grid xl:grid-cols-[208px_minmax(0,1fr)_400px] min-[1500px]:grid-cols-[220px_minmax(0,1fr)_420px]">
        <aside className="flex min-h-0 flex-col border-r border-white/[0.08] bg-[#050505] px-4 py-5">
          <div className="mb-5 border-b border-white/[0.08] px-3 pb-5 text-center">
            <p className="truncate text-sm font-semibold text-white">Brain Builder</p>
          </div>
          <p className="px-3 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-white">Workspace</p>
          <nav className="mt-3 space-y-0.5">
            <Link href="/ai-builder?new=1" className="block w-full rounded-lg px-3 py-2.5 text-left text-[0.82rem] font-semibold text-white transition hover:bg-white/[0.035]">
              Brain Builder
            </Link>
            <Link href="/ai-builder/projects" className="relative block w-full rounded-lg bg-white/[0.055] px-3 py-2.5 text-left text-[0.82rem] font-semibold text-amber-200 before:absolute before:bottom-2 before:left-0 before:top-2 before:w-0.5 before:rounded-full before:bg-amber-300">
              Projects
            </Link>
          </nav>
          <div className="mt-auto border-t border-white/[0.08] pt-4">
            <SignOutButton redirectUrl="/ai-builder">
              <button type="button" className="w-full rounded-lg px-3 py-2.5 text-left text-[0.82rem] font-semibold text-white transition hover:bg-white/[0.035] hover:text-amber-200">Sign out</button>
            </SignOutButton>
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-col bg-[#020202]">
          <header className="flex min-h-[76px] flex-none items-center justify-center border-b border-white/[0.08] px-6 py-3 text-center">
            <h1 className="truncate text-xl font-semibold text-slate-100">Projects</h1>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            <div className="mx-auto w-full max-w-[1100px] [&>div]:!static [&>div]:!block [&>div]:!bg-transparent [&>div]:!p-0 [&>div>section]:!max-h-none [&>div>section]:!max-w-none [&>div>section]:!overflow-visible [&>div>section]:!rounded-none [&>div>section]:!border-0 [&>div>section]:!bg-transparent [&>div>section]:!px-0 [&>div>section]:!py-0 [&>div>section]:!shadow-none">
              <AiBuilderProjects embedded />
            </div>
          </div>
        </main>

        <aside className="flex min-h-0 flex-col border-l border-white/[0.08] bg-black">
          <div className="flex h-full min-h-0 items-center justify-center px-8 text-center">
            <div>
              <p className="text-sm font-semibold text-white">Manage your Business Brains</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">Open, rename, archive, or restore a saved project from one place.</p>
            </div>
          </div>
        </aside>
      </div>

      <div className="xl:hidden">
        <header className="sticky top-0 z-40 flex min-h-[68px] items-center justify-center border-b border-white/[0.08] bg-black/95 px-4 text-center backdrop-blur">
          <h1 className="text-sm font-semibold text-white">Projects</h1>
        </header>
        <nav className="flex items-center justify-center gap-3 border-b border-white/[0.08] bg-[#050505] px-4 py-4">
          <Link href="/ai-builder?new=1" className={aiBuilderCornerCtaClassName}>Brain Builder</Link>
          <Link href="/ai-builder/projects" className={`${aiBuilderCornerCtaClassName} border-amber-300/35 bg-[#111111] text-amber-200`}>Projects</Link>
        </nav>
        <main className="px-4 py-5 sm:px-6 sm:py-6 [&>div]:!static [&>div]:!block [&>div]:!bg-transparent [&>div]:!p-0 [&>div>section]:!max-h-none [&>div>section]:!max-w-none [&>div>section]:!overflow-visible [&>div>section]:!rounded-none [&>div>section]:!border-0 [&>div>section]:!bg-transparent [&>div>section]:!px-0 [&>div>section]:!py-0 [&>div>section]:!shadow-none">
          <AiBuilderProjects embedded />
        </main>
      </div>
    </AiBuilderShell>
  );
}
