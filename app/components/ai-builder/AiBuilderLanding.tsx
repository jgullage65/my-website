"use client";

import Image from "next/image";
import { SignInButton } from "@clerk/nextjs";
import AiBuilderSurfaceShowcase from "./AiBuilderSurfaceShowcase";
import {
  aiBuilderDemoBuilder,
  aiBuilderDemoDiagnostics,
  aiBuilderDemoModels,
  aiBuilderDemoSession,
} from "./aiBuilderDemoPack";

const primaryButton =
  "cta-raised inline-flex min-h-12 items-center justify-center rounded-xl border border-amber-300/20 bg-[#080808] px-5 py-3 text-sm font-black text-white shadow-[0_10px_24px_rgba(0,0,0,.28),inset_0_1px_0_rgba(255,255,255,.05)] transition duration-300 hover:-translate-y-0.5 hover:border-amber-300/35 hover:bg-[#111111]";

const Check = () => (
  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-amber-300/20 bg-[#070707] text-[11px] font-black text-amber-200">✓</span>
);

export default function AiBuilderLanding() {
  return (
    <div className="h-[calc(100dvh-56px)] min-h-0 overflow-y-scroll overscroll-y-contain bg-black text-white xl:h-full">
      <main className="relative overflow-hidden px-4 pb-16 pt-10 sm:px-6 lg:px-8 xl:px-10">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.018)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_64%)]" />

        <div className="relative flex min-h-[calc(100dvh-136px)] flex-col">
        <section className="grid w-full items-center gap-8 xl:grid-cols-[minmax(360px,.58fr)_minmax(0,1.42fr)] 2xl:gap-10">
          <div className="max-w-xl">
            <Image src="/image/Arkenalogo.png" alt="Arkena Studio" width={260} height={72} priority className="h-auto w-[180px] object-contain sm:w-[210px] xl:w-[230px]" />
            <h1 className="mt-5 text-3xl font-medium leading-[1.04] tracking-[-.035em] text-white sm:text-4xl xl:text-5xl">Build the Brain.<span className="block text-slate-400">Keep the knowledge.</span></h1>
            <p className="mt-5 text-base leading-7 text-slate-400">Choose the model that builds your Business Brain, review every insight before it becomes trusted knowledge, and use that approved Business Brain with GPT, Claude, Gemini, Grok, and future models.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button type="button" className={primaryButton}>Build Your Business Brain</button>
              <SignInButton mode="modal" forceRedirectUrl="/ai-builder">
                <button type="button" className={primaryButton}>Sign In</button>
              </SignInButton>
            </div>

            <div className="mt-8 grid gap-7 border-t border-white/[0.07] pt-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-amber-300">Model freedom</p>
                <p className="mt-3 text-base leading-7 text-slate-400">Build your Business Brain with the model you choose today. Switch the model that answers tomorrow without rebuilding your business knowledge.</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-amber-300">Review and approval</p>
                <p className="mt-3 text-base leading-7 text-slate-400">Nothing becomes Business Memory until you approve it. Edit what isn’t right, remove what doesn’t belong, and trust what you keep.</p>
              </div>
            </div>
          </div>
          <AiBuilderSurfaceShowcase session={aiBuilderDemoSession} builder={aiBuilderDemoBuilder} models={aiBuilderDemoModels} diagnostics={aiBuilderDemoDiagnostics} autoAdvance className="min-w-0" />
        </section>

        <section className="mt-6 grid w-full gap-4 border-t border-white/[0.07] pt-6 sm:grid-cols-2 xl:mt-auto xl:grid-cols-4">
          {[
            ["Choose the model", "Use GPT, Claude, Gemini, or Grok without rebuilding the business context."],
            ["Import the website", "Bring in public pages while keeping owner expertise separate and in control."],
            ["Review everything", "Edit, remove, and approve the knowledge before it becomes business memory."],
            ["Use one Business Brain", "Test it, host it, or reuse the approved knowledge across assistants."],
            ["Deploy Your Assistant", "Choose a plan, connect your API key, and bring your Business Brain online."],
            ["Business Brain PDF", "Generate a polished PDF of your approved Business Brain to review, archive, or share with your team."],
            ["Create for Others", "Train, review, and deploy Business Brains for anyone from a single workspace."],
            ["Expand Your Business Brain", "Expand your Business Brain expertise across new assistants, tools, and experiences as the platform grows."],
          ].map(([title, copy]) => (
            <article key={title} className="rounded-2xl border border-white/[0.07] bg-[#050505] p-5">
              <div className="flex items-start gap-3"><Check /><div><h2 className="text-sm font-semibold text-white">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{copy}</p></div></div>
            </article>
          ))}
        </section>
        </div>

        <section className="relative mt-12 w-full border-t border-white/[0.07] pt-10 text-center">
          <div className="mx-auto max-w-3xl rounded-[24px] border border-white/[0.08] bg-[#030303] px-5 py-8 shadow-[0_18px_50px_rgba(0,0,0,.28)] sm:px-8 sm:py-10">
            <h2 className="text-2xl font-medium tracking-[-.025em] text-white sm:text-3xl">Ready to start your Business Brain?</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">Choose how you want to move forward. We’ll wire each path into the right experience next.</p>
            <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <button type="button" className={primaryButton}>Build Your Business Brain</button>
              <button type="button" className={primaryButton}>Sign In</button>
              <button type="button" className={primaryButton}>Ask Support</button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
