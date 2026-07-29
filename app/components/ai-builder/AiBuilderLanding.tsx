"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";
import type { AiBuilderModelChoice } from "./AiBuilderModelSelect";
import AiBuilderSurfaceShowcase from "./AiBuilderSurfaceShowcase";
import type { BuilderState } from "./AiBuilderClient";
import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";

const primaryButton =
  "cta-raised inline-flex min-h-12 items-center justify-center rounded-xl border border-amber-300/20 bg-[#080808] px-5 py-3 text-sm font-black text-white shadow-[0_10px_24px_rgba(0,0,0,.28),inset_0_1px_0_rgba(255,255,255,.05)] transition duration-300 hover:-translate-y-0.5 hover:border-amber-300/35 hover:bg-[#111111]";
const secondaryButton =
  "inline-flex min-h-12 items-center justify-center rounded-xl border border-amber-300/15 bg-transparent px-5 py-3 text-sm font-bold text-slate-300 transition duration-300 hover:-translate-y-0.5 hover:border-amber-300/30 hover:text-white";

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
            <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-amber-300">Arkena AI Builder</p>
            <h1 className="mt-4 text-3xl font-medium leading-[1.04] tracking-[-.035em] text-white sm:text-4xl xl:text-5xl">Build the Brain.<span className="block text-slate-400">Keep the knowledge.</span></h1>
            <p className="mt-5 text-base leading-7 text-slate-400">Choose the model that learns your business, review what it finds, and use the same approved Business Brain across every assistant you create.</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row"><SignUpButton mode="modal" forceRedirectUrl="/ai-builder"><button type="button" className={primaryButton}>Build your Business Brain</button></SignUpButton><SignInButton mode="modal" forceRedirectUrl="/ai-builder"><button type="button" className={secondaryButton}>Sign in</button></SignInButton></div>
          </div>
          <AiBuilderSurfaceShowcase session={demoSession} builder={demoBuilder} models={models} autoAdvance className="min-w-0" />
        </section>

        <section className="mt-6 grid w-full gap-4 border-t border-white/[0.07] pt-6 sm:grid-cols-2 xl:mt-auto xl:grid-cols-4">
          {[
            ["Choose the model", "Use GPT, Claude, Gemini, or Grok without rebuilding the business context."],
            ["Import the website", "Bring in public pages while keeping owner expertise separate and in control."],
            ["Review everything", "Edit, remove, and approve the knowledge before it becomes business memory."],
            ["Use one Business Brain", "Test it, host it, or reuse the approved knowledge across assistants."],
          ].map(([title, copy]) => (
            <article key={title} className="rounded-2xl border border-white/[0.07] bg-[#050505] p-5">
              <div className="flex items-start gap-3"><Check /><div><h2 className="text-sm font-semibold text-white">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{copy}</p></div></div>
            </article>
          ))}
        </section>
        </div>

        <section className="relative mt-12 grid w-full gap-8 border-t border-white/[0.07] pt-10 lg:grid-cols-2 lg:gap-12">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-amber-300">Website intelligence</p>
            <h2 className="mt-3 max-w-xl text-2xl font-medium leading-tight tracking-[-.025em] text-white sm:text-3xl">Bring in the website. Keep your expertise in control.</h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">Arkena safely crawls the public website, organizes what matters, and keeps imported knowledge separate from the information only you can provide.</p>
          </div>
          <div className="grid gap-4">
            {["Products, services, pricing, FAQs, policies, and structured data", "Your answers always take priority over imported website knowledge", "The crawl result becomes a reviewable source, not hidden model context"].map((item) => <div key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-300"><Check /><span>{item}</span></div>)}
          </div>
        </section>

        <section className="relative mt-12 grid w-full gap-10 border-t border-white/[0.07] pt-10 lg:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-amber-300">Model freedom</p>
            <h2 className="mt-3 text-2xl font-medium leading-tight tracking-[-.025em] text-white sm:text-3xl">Pick the model that builds it. Change the model that answers.</h2>
            <p className="mt-4 text-base leading-7 text-slate-400">The Business Brain is the stable layer. GPT, Claude, Gemini, and Grok can all work from the same approved business knowledge.</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-amber-300">Review and approval</p>
            <h2 className="mt-3 text-2xl font-medium leading-tight tracking-[-.025em] text-white sm:text-3xl">Nothing becomes business memory until you review it.</h2>
            <p className="mt-4 text-base leading-7 text-slate-400">Edit what is wrong, remove what should not be used, and approve the knowledge you trust.</p>
          </div>
        </section>

        <section className="relative mt-12 grid w-full items-center gap-8 rounded-[28px] border border-white/[0.08] bg-[#020202] p-6 shadow-[0_36px_110px_rgba(0,0,0,.55)] lg:grid-cols-[.7fr_1.3fr] xl:p-8">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-amber-300">Use it your way</p>
            <h2 className="mt-3 max-w-xl text-2xl font-medium leading-tight tracking-[-.025em] text-white sm:text-3xl">Your Brain should not belong to one chatbot.</h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">Host the assistant with Arkena, test it inside the workspace, add it to a website, or export the approved knowledge as a Knowledge Pack.</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row"><SignUpButton mode="modal" forceRedirectUrl="/ai-builder"><button type="button" className={primaryButton}>Start building</button></SignUpButton><SignInButton mode="modal" forceRedirectUrl="/ai-builder"><button type="button" className={secondaryButton}>Open existing Brain</button></SignInButton></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{["Hosted assistant", "Website widget", "Knowledge Pack", "Any AI model"].map((label) => <div key={label} className="rounded-2xl border border-white/[0.07] bg-[#050505] p-5"><p className="text-sm font-semibold text-white">{label}</p><p className="mt-2 text-xs leading-5 text-slate-500">Powered by the same approved business knowledge.</p></div>)}</div>
        </section>
      </main>
    </div>
  );
}
