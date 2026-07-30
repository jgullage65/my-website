"use client";

import Image from "next/image";
import { SignIn } from "@clerk/nextjs";
import type { AiBuilderModelChoice } from "./AiBuilderModelSelect";
import AiBuilderSurfaceShowcase from "./AiBuilderSurfaceShowcase";
import type { BuilderState } from "./AiBuilderClient";
import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";

const primaryButton =
  "cta-raised inline-flex min-h-12 items-center justify-center rounded-xl border border-amber-300/20 bg-[#080808] px-5 py-3 text-sm font-black text-white shadow-[0_10px_24px_rgba(0,0,0,.28),inset_0_1px_0_rgba(255,255,255,.05)] transition duration-300 hover:-translate-y-0.5 hover:border-amber-300/35 hover:bg-[#111111]";
const demoSession: AiBuilderSession = {
  id: "landing-demo",
  status: "ready",
  intakeBlocks: [],
  assistantConfiguration: {
    name: "Arkena Assistant",
    purpose: "Represent the business accurately",
    tone: "Professional",
    responseStyle: "Clear and concise",
    primaryAudience: "Prospective customers",
    escalationInstructions: [],
  },
  contextEntries: [
    {
      id: "business-profile",
      sessionId: "landing-demo",
      category: "business_profile",
      title: "Company overview",
      content: "JG Creative Studio builds premium websites, AI copilots, and automation systems for established businesses.",
      confidence: "high",
      confidenceScore: 0.97,
      status: "approved",
      source: {
        intakeBlockId: "demo",
        excerpt: "Premium websites and AI systems built for real business.",
        sourceType: "manual_intake",
      },
      metadata: {
        generated: false,
        userEdited: true,
        conflictingEntryIds: [],
        tags: [],
      },
      createdAt: "2026-07-18T21:54:00.000Z",
      updatedAt: "2026-07-18T21:54:00.000Z",
    },
    {
      id: "service-entry",
      sessionId: "landing-demo",
      category: "service",
      title: "AI systems",
      content: "Custom copilots, customer support AI, internal knowledge assistants, CRM automation, scheduling systems, and dashboards.",
      confidence: "high",
      confidenceScore: 0.95,
      status: "approved",
      source: {
        intakeBlockId: "demo",
        excerpt: "Custom AI copilots and automation systems.",
        sourceType: "website",
        sourceUrl: "https://example.com/services",
      },
      metadata: {
        generated: true,
        userEdited: false,
        conflictingEntryIds: [],
        tags: ["product_service"],
      },
      createdAt: "2026-07-18T21:55:00.000Z",
      updatedAt: "2026-07-18T21:55:00.000Z",
    },
  ],
  faqEntries: [
    {
      id: "faq-entry",
      sessionId: "landing-demo",
      question: "What does JG Creative Studio build?",
      answer: "Premium websites, AI assistants, and business automation systems.",
      confidence: "high",
      confidenceScore: 0.96,
      sourceEntryIds: [],
      status: "approved",
      createdAt: "2026-07-18T21:56:00.000Z",
      updatedAt: "2026-07-18T21:56:00.000Z",
    },
  ],
  conflicts: [],
  missingInformation: [],
  contextCounts: {
    total: 3,
    approved: 3,
    proposed: 0,
    archived: 0,
    byCategory: { business_profile: 1, service: 1, faq: 1 },
  },
  buildProgress: [
    {
      stage: "complete",
      message: "Business Brain ready",
      completed: true,
      createdAt: "2026-07-18T21:57:00.000Z",
    },
  ],
  createdAt: "2026-07-18T21:50:00.000Z",
  updatedAt: "2026-07-18T21:57:00.000Z",
  expiresAt: null,
};

const models: AiBuilderModelChoice[] = [
  { id: "gpt-5-mini", provider: "openai", displayName: "GPT-5 mini", recommended: false, highUsage: false },
  { id: "gpt-5", provider: "openai", displayName: "GPT-5", recommended: false, highUsage: false },
  { id: "gpt-5.5", provider: "openai", displayName: "GPT-5.5", recommended: true, highUsage: false },
  { id: "gpt-5.5-pro", provider: "openai", displayName: "GPT-5.5 Pro", recommended: false, highUsage: true },
  { id: "claude-haiku", provider: "anthropic", displayName: "Claude Haiku", recommended: false, highUsage: false },
  { id: "claude-sonnet", provider: "anthropic", displayName: "Claude Sonnet", recommended: false, highUsage: false },
  { id: "claude-opus", provider: "anthropic", displayName: "Claude Opus", recommended: false, highUsage: true },
  { id: "gemini-flash", provider: "google", displayName: "Gemini 2.5 Flash", recommended: false, highUsage: false },
  { id: "gemini-pro", provider: "google", displayName: "Gemini 2.5 Pro", recommended: false, highUsage: false },
  { id: "grok-fast", provider: "xai", displayName: "Grok Fast", recommended: false, highUsage: false },
  { id: "grok", provider: "xai", displayName: "Grok", recommended: false, highUsage: false },
];

const demoBuilder: BuilderState = {
  businessName: "JG Creative Studio",
  industry: "Digital services",
  website: "https://yourbusiness.com",
  tone: "Professional",
  userKnowledge: {
    productsServices: "Custom AI copilots, websites, and automation systems.",
    idealCustomers: "Established businesses improving their digital operations.",
    additionalKnowledge: "Owner-provided knowledge remains authoritative.",
  },
  websiteKnowledge: null,
  crawlAttemptIds: [],
};

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
            <div className="mt-7"><a href="/pricing" className={primaryButton}>Build Your Business Brain</a></div>

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
          <AiBuilderSurfaceShowcase session={demoSession} builder={demoBuilder} models={models} autoAdvance className="min-w-0" />
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

        <section className="relative mt-12 grid w-full gap-x-12 gap-y-12 border-t border-white/[0.07] pt-10 lg:grid-cols-[minmax(0,.95fr)_minmax(0,1.05fr)]">
          <div className="grid items-start gap-8 lg:col-start-2 lg:grid-cols-[minmax(280px,.9fr)_minmax(320px,1.1fr)]">
            <div className="flex w-full max-w-sm justify-start overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#050505] lg:-ml-2 xl:-ml-4">
              <SignIn
                routing="hash"
                forceRedirectUrl="/ai-builder"
                appearance={{
                  elements: {
                    rootBox: "w-full max-w-sm",
                    cardBox: "w-full shadow-none",
                    card: "w-full rounded-none border-0 bg-[#050505] shadow-none",
                    headerTitle: "text-white",
                    headerSubtitle: "text-slate-400",
                    socialButtonsBlockButton: "border-white/[0.08] bg-[#080808] text-white hover:bg-[#111111]",
                    socialButtonsBlockButtonText: "text-white",
                    dividerLine: "bg-white/[0.08]",
                    dividerText: "text-slate-500",
                    formFieldLabel: "text-slate-300",
                    formFieldInput: "border-white/[0.08] bg-[#080808] text-white",
                    formButtonPrimary: "border border-amber-300/20 bg-[#080808] text-white hover:bg-[#111111]",
                    footerActionText: "text-slate-400",
                    footerActionLink: "text-amber-300 hover:text-amber-200",
                    identityPreviewText: "text-white",
                    identityPreviewEditButton: "text-amber-300",
                  },
                }}
              />
            </div>

            <form className="rounded-[24px] border border-white/[0.08] bg-[#020202] p-5 text-center shadow-[0_18px_50px_rgba(0,0,0,.28)] sm:p-6">
              <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-amber-300">Contact</p>
              <h3 className="mt-3 text-xl font-medium tracking-[-.02em] text-white">Have a question?</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">Send a quick note and we’ll get back to you.</p>

              <div className="mt-6 grid gap-4">
                <label className="grid gap-2 text-center text-sm font-medium text-slate-300">
                  Name
                  <input type="text" name="name" className="min-h-11 rounded-xl border border-amber-300/10 bg-[#070707] px-4 text-center text-sm text-white outline-none transition placeholder:text-center placeholder:text-slate-600 focus:border-amber-300/30" placeholder="Your name" />
                </label>
                <label className="grid gap-2 text-center text-sm font-medium text-slate-300">
                  Email
                  <input type="email" name="email" className="min-h-11 rounded-xl border border-amber-300/10 bg-[#070707] px-4 text-center text-sm text-white outline-none transition placeholder:text-center placeholder:text-slate-600 focus:border-amber-300/30" placeholder="you@example.com" />
                </label>
                <label className="grid gap-2 text-center text-sm font-medium text-slate-300">
                  Message
                  <textarea name="message" rows={4} className="resize-none rounded-xl border border-amber-300/10 bg-[#070707] px-4 py-3 text-center text-sm text-white outline-none transition placeholder:text-center placeholder:text-slate-600 focus:border-amber-300/30" placeholder="How can we help?" />
                </label>
              </div>

              <button type="submit" className={`${primaryButton} mt-5 w-full`}>Send Message</button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
