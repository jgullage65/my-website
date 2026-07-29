"use client";

import { useEffect, useMemo, useState } from "react";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import AiBuilderDashboard from "./AiBuilderDashboard";
import AiBuilderModelSelect, { type AiBuilderModelChoice } from "./AiBuilderModelSelect";
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

const slides = [
  { id: "dashboard", label: "Dashboard" },
  { id: "builder", label: "Builder" },
  { id: "review", label: "Review" },
  { id: "models", label: "Models" },
] as const;

type SlideId = (typeof slides)[number]["id"];

const Check = () => (
  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-amber-300/20 bg-[#070707] text-[11px] font-black text-amber-200">✓</span>
);

function BuilderSurface() {
  return (
    <div className="grid gap-4 xl:grid-cols-[.72fr_1.28fr]">
      <div className="grid gap-3">
        <article className="rounded-2xl border border-amber-300/20 bg-[#070707]/88 p-5 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-amber-300">Connect your website</p>
          <p className="mx-auto mt-3 max-w-md text-xs leading-5 text-slate-500">Safely crawl public pages and organize useful information into a reviewable source.</p>
          <div className="mt-4 rounded-xl border border-white/10 bg-[#020202] px-4 py-3 text-xs text-slate-500">https://yourbusiness.com</div>
          <div className="cta-raised mx-auto mt-3 w-fit rounded-lg border border-amber-300/20 bg-black px-4 py-2.5 text-xs font-black text-white">Import Website</div>
        </article>
        <article className="rounded-2xl border border-amber-300/20 bg-[#070707]/88 p-5 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-amber-300">Communication style</p>
          <p className="mt-3 text-sm font-semibold text-white">How should your AI sound?</p>
          <div className="mt-4 rounded-xl border border-white/10 bg-[#020202] px-4 py-3 text-xs text-slate-300">Professional⌄</div>
        </article>
      </div>
      <div>
        <div className="text-center"><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-amber-300">Your expertise</p><p className="mt-2 text-xs text-slate-500">Your answers always take priority over imported website knowledge.</p></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {["Business profile", "Products & Services", "Ideal Customers", "Additional Business Knowledge"].map((title) => (
            <article key={title} className="rounded-2xl border border-amber-300/20 bg-[#070707]/88 p-5 text-center">
              <h3 className="text-sm font-semibold text-white">{title}</h3>
              <div className="mt-4 min-h-24 rounded-xl border border-white/10 bg-[#020202] px-4 py-4 text-xs leading-5 text-slate-400">Add the details only you know about the business.</div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReviewSurface() {
  return (
    <div className="rounded-[22px] bg-[#020202]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
        <div><p className="text-sm font-semibold text-white">Business Knowledge</p><p className="mt-1 text-[10px] text-slate-600">Review and govern the assistant’s business memory</p></div>
        <div className="cta-raised rounded-lg border border-amber-300/20 bg-black px-4 py-2.5 text-xs font-black text-white">Done</div>
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-3">
        {[
          ["Mission / Value Proposition", "Premium websites. AI systems built for real business."],
          ["Products", "Custom AI copilots, support AI, knowledge assistants, CRM automation, scheduling systems, and dashboards."],
          ["Customer Segments", "Established businesses that need a sharper digital presence and better operational tools."],
        ].map(([title, copy]) => (
          <article key={title} className="overflow-hidden rounded-[14px] border border-white/[0.055] bg-[#080808]/90 text-center">
            <div className="p-5"><h3 className="text-sm font-semibold text-white">{title}</h3><p className="mt-3 text-xs leading-6 text-slate-400">{copy}</p></div>
            <div className="grid grid-cols-2 gap-2 border-t border-white/[0.05] p-3"><div className="cta-raised rounded-lg border border-amber-300/20 bg-black px-3 py-2.5 text-xs font-bold text-white">Edit</div><div className="cta-raised rounded-lg border border-amber-300/20 bg-black px-3 py-2.5 text-xs font-bold text-white">Remove</div></div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ProductShowcase() {
  const [activeSlide, setActiveSlide] = useState<SlideId>("dashboard");
  const [selectedModel, setSelectedModel] = useState("gpt-5.5");

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => {
        const index = slides.findIndex((slide) => slide.id === current);
        return slides[(index + 1) % slides.length]!.id;
      });
    }, 6500);
    return () => window.clearInterval(timer);
  }, []);

  const content = useMemo(() => {
    if (activeSlide === "dashboard") {
      return <AiBuilderDashboard session={demoSession} websiteKnowledge={null} messages={[]} diagnostics={null} onNavigate={() => undefined} />;
    }
    if (activeSlide === "builder") return <BuilderSurface />;
    if (activeSlide === "review") return <ReviewSurface />;
    return <div className="flex min-h-[430px] items-start justify-center pt-12"><AiBuilderModelSelect models={models} value={selectedModel} disabled={false} onChange={setSelectedModel} defaultOpen /></div>;
  }, [activeSlide, selectedModel]);

  return (
    <div className="min-w-0">
      <div className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-black p-4 shadow-[0_28px_90px_rgba(0,0,0,.58)]">
        <div className="min-h-[430px]">{content}</div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {slides.map((slide) => (
          <button key={slide.id} type="button" onClick={() => setActiveSlide(slide.id)} className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${activeSlide === slide.id ? "border-amber-300/30 bg-[#0a0a0a] text-white" : "border-white/[0.06] bg-[#030303] text-slate-500 hover:text-white"}`}>{slide.label}</button>
        ))}
      </div>
    </div>
  );
}

export default function AiBuilderLanding() {
  return (
    <div className="h-full overflow-y-auto bg-black text-white">
      <main className="relative overflow-hidden px-4 pb-16 pt-10 sm:px-6 lg:px-8 xl:px-10">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.018)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_64%)]" />

        <section className="relative grid w-full items-center gap-8 xl:grid-cols-[minmax(360px,.58fr)_minmax(0,1.42fr)] 2xl:gap-10">
          <div className="max-w-xl">
            <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-amber-300">Arkena AI Builder</p>
            <h1 className="mt-4 text-3xl font-medium leading-[1.04] tracking-[-.035em] text-white sm:text-4xl xl:text-5xl">Build the Brain.<span className="block text-slate-400">Keep the knowledge.</span></h1>
            <p className="mt-5 text-base leading-7 text-slate-400">Choose the model that learns your business, review what it finds, and use the same approved Business Brain across every assistant you create.</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row"><SignUpButton mode="modal" forceRedirectUrl="/ai-builder"><button type="button" className={primaryButton}>Build your Business Brain</button></SignUpButton><SignInButton mode="modal" forceRedirectUrl="/ai-builder"><button type="button" className={secondaryButton}>Sign in</button></SignInButton></div>
          </div>
          <ProductShowcase />
        </section>

        <section className="relative mt-10 grid w-full gap-4 border-t border-white/[0.07] pt-8 sm:grid-cols-2 xl:grid-cols-4">
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
      </main>
    </div>
  );
}
