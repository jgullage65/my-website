"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { aiBuilderCornerCtaClassName } from "./AiBuilderAuthCta";

const primaryButton =
  "cta-raised inline-flex min-h-12 items-center justify-center rounded-xl border border-amber-300/20 bg-[#080808] px-5 py-3 text-sm font-black text-white shadow-[0_10px_24px_rgba(0,0,0,.28),inset_0_1px_0_rgba(255,255,255,.05)] transition duration-300 hover:-translate-y-0.5 hover:border-amber-300/35 hover:bg-[#111111]";
const secondaryButton =
  "inline-flex min-h-12 items-center justify-center rounded-xl border border-amber-300/15 bg-transparent px-5 py-3 text-sm font-bold text-slate-300 transition duration-300 hover:-translate-y-0.5 hover:border-amber-300/30 hover:text-white";
const dashboardPanel = "rounded-xl border border-white/[.08] bg-[#050505] p-5";
const reviewPanel = "overflow-hidden rounded-[14px] border border-white/[0.055] bg-[#080808]/90 shadow-[0_14px_36px_rgba(0,0,0,0.2)]";
const reviewAction = "cta-raised min-w-0 w-full rounded-lg border border-amber-300/20 bg-black px-3 py-2.5 text-xs font-bold text-white";
const modelButton = "cta-raised relative h-10 w-full rounded-lg border border-amber-300/20 bg-black px-10 text-center text-sm font-semibold text-white";

const Check = () => (
  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-amber-300/20 bg-[#070707] text-[11px] font-black text-amber-200">✓</span>
);

const ShellLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] font-black uppercase tracking-[.24em] text-amber-300">{children}</p>
);

const DashboardProductPreview = () => (
  <div className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-black shadow-[0_28px_90px_rgba(0,0,0,.58)]">
    <div className="grid aspect-[16/9] min-h-[350px] grid-cols-[98px_minmax(0,1fr)_165px] max-[900px]:grid-cols-[82px_minmax(0,1fr)] max-[900px]:[&_.assistant-pane]:hidden">
      <aside className="border-r border-white/[0.08] bg-[#020202] p-3">
        <p className="text-[9px] text-slate-500">← All Projects</p>
        <p className="mt-4 text-[11px] font-bold text-white">JG Creative Studio</p>
        <p className="mt-1 truncate text-[9px] text-slate-600">jgecreativestudios.com</p>
        <p className="mt-6 text-[8px] font-black uppercase tracking-[.18em] text-slate-600">Workspace</p>
        <div className="mt-2 space-y-1 text-[8px] font-semibold">
          {["Dashboard", "Project Insights", "Overview", "Business Knowledge", "Sources", "Settings"].map((item, index) => (
            <div key={item} className={`rounded-md px-2 py-1.5 ${index === 0 ? "border-l-2 border-amber-300 bg-white/[0.03] text-amber-100" : "text-slate-500"}`}>{item}</div>
          ))}
        </div>
      </aside>

      <section className="min-w-0 bg-black p-3">
        <section className="border-b border-white/[.08] pb-4 text-center">
          <p className="text-[9px] font-bold uppercase tracking-[.18em] text-amber-300">Project readiness</p>
          <h2 className="mt-1.5 text-sm font-semibold tracking-[-.03em] text-white">Ready for testing</h2>
          <p className="mx-auto mt-1 max-w-md text-[9px] leading-4 text-slate-500">The knowledge is prepared. Test real questions to validate the assistant.</p>
          <p className="mt-2 text-[9px] font-semibold text-slate-300">4 of 5 readiness checks complete</p>
          <div className="mx-auto mt-2 flex max-w-xl flex-wrap justify-center gap-x-3 gap-y-1 text-[8px] font-medium">
            {["Source connected", "Knowledge generated", "Review complete", "Build completed"].map((item) => <span key={item} className="text-amber-200">✓ {item}</span>)}
            <span className="text-slate-600">○ Assistant tested</span>
          </div>
        </section>
        <div className="mt-3 grid gap-3 md:grid-cols-[1.1fr_.9fr]">
          <section className={`${dashboardPanel} p-3.5`}>
            <h3 className="text-center text-xs font-semibold text-white">Needs attention</h3>
            <div className="mt-2 divide-y divide-white/[.07]">
              {["No website source connected", "Assistant has not been tested"].map((label) => (
                <div key={label} className="py-2.5"><p className="text-[10px] font-semibold text-white">{label}</p><p className="mt-1 text-[9px] leading-4 text-slate-500">{label.startsWith("No website") ? "Import a website to broaden the assistant’s source material." : "Run a few real customer questions before launch."}</p></div>
              ))}
            </div>
          </section>
          <section className={`${dashboardPanel} p-3.5 text-center`}>
            <h3 className="text-xs font-semibold text-white">Last AI build</h3>
            <p className="mt-2 text-[9px] text-slate-500">Built Jul 18, 2026, 9:54 PM</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2"><span className="rounded-full border border-white/10 bg-black px-3 py-1.5 text-[9px] font-semibold text-slate-200">✓ 0 Approved Q&A</span></div>
          </section>
        </div>
      </section>

      <aside className="assistant-pane border-l border-white/[0.08] bg-[#020202] p-3">
        <div className="text-center"><ShellLabel>Live assistant test</ShellLabel><p className="mt-2 text-[8px] font-black uppercase tracking-[.2em] text-slate-500">Active model</p></div>
        <button type="button" className={`${modelButton} mt-2 text-[10px]`}>Claude Sonnet<span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-200/70">⌄</span></button>
        <div className="mt-4 rounded-2xl border border-amber-300/20 bg-[#070707] p-3 text-[10px] leading-5 text-slate-200">Hi, I’m LeadForge AI. Ask me anything about this business.</div>
        <div className="mt-20 border-t border-white/[0.06] pt-3">
          <div className={`mb-3 w-fit ${aiBuilderCornerCtaClassName}`}>Buy This AI Assistant</div>
          <div className="rounded-2xl border border-amber-300/20 bg-[#070707] p-3 text-[9px] leading-5 text-slate-600">Ask about services, pricing, policies, or the business...</div>
        </div>
      </aside>
    </div>
  </div>
);

const BuilderProductPreview = () => (
  <div className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-black p-4 shadow-[0_28px_90px_rgba(0,0,0,.58)]">
    <div className="grid gap-4 xl:grid-cols-[.72fr_1.28fr]">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <div className="sm:col-span-2 xl:col-span-1 text-center"><ShellLabel>AI Builder</ShellLabel><p className="mt-2 text-[0.64rem] font-bold uppercase tracking-[0.2em] text-slate-400">Active model</p><button type="button" className={`${modelButton} mt-1.5`}>GPT-5.5<span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-200/70">⌄</span></button></div>
        <article className="rounded-2xl border border-amber-300/20 bg-[#070707]/88 p-5 text-center shadow-[0_14px_42px_rgba(0,0,0,0.2)]">
          <ShellLabel>Connect your website</ShellLabel>
          <p className="mx-auto mt-3 max-w-md text-xs leading-5 text-slate-500">We safely crawl public pages and organize the useful information into a read-only source.</p>
          <div className="mt-4 rounded-xl border border-white/10 bg-[#020202] px-4 py-3 text-center text-xs text-slate-500">https://yourbusiness.com</div>
          <div className={`mx-auto mt-3 max-w-xs ${aiBuilderCornerCtaClassName}`}>Import Website</div>
        </article>
        <article className="rounded-2xl border border-amber-300/20 bg-[#070707]/88 p-5 text-center shadow-[0_14px_42px_rgba(0,0,0,0.2)]">
          <ShellLabel>Communication style</ShellLabel>
          <p className="mt-3 text-sm font-semibold text-white">How should your AI sound?</p>
          <div className="mt-4 rounded-xl border border-white/10 bg-[#020202] px-4 py-3 text-center text-xs text-slate-300">Professional⌄</div>
        </article>
      </div>
      <div>
        <div className="text-center"><ShellLabel>Your expertise</ShellLabel><p className="mt-2 text-xs text-slate-500">Your answers always take priority over imported website knowledge.</p></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            ["Business profile", "JG Creative Studio\nWeb design and AI automation agency"],
            ["Products & Services", "Describe services, packages, deliverables, pricing structure, and what each option is for."],
            ["Ideal Customers", "Describe your best-fit customers, industries, locations, needs, and goals."],
            ["Additional Business Knowledge", "Share private pricing, policies, processes, guarantees, objections, FAQs, and anything else your AI should know."],
          ].map(([title, copy]) => (
            <article key={title} className="rounded-2xl border border-amber-300/20 bg-[#070707]/88 p-5 text-center shadow-[0_14px_42px_rgba(0,0,0,0.2)]">
              <h3 className="text-sm font-semibold text-white">{title}</h3>
              <div className="mt-4 min-h-24 whitespace-pre-line rounded-xl border border-white/10 bg-[#020202] px-4 py-4 text-xs leading-5 text-slate-400">{copy}</div>
            </article>
          ))}
        </div>
        <article className="mx-auto mt-4 max-w-xl rounded-2xl border border-amber-300/20 bg-[#070707]/88 p-5 text-center shadow-[0_14px_42px_rgba(0,0,0,0.2)]">
          <ShellLabel>Final step</ShellLabel><p className="mt-3 text-sm font-semibold text-white">Ready to build your AI?</p><div className={`mx-auto mt-4 w-fit ${aiBuilderCornerCtaClassName}`}>Build My AI</div>
        </article>
      </div>
    </div>
  </div>
);

const ModelProductPreview = () => (
  <div className="rounded-[24px] border border-white/[0.08] bg-black p-5 shadow-[0_28px_90px_rgba(0,0,0,.58)]">
    <div className="relative mx-auto grid max-w-sm justify-items-center gap-1.5">
      <span className="text-center text-[0.64rem] font-bold uppercase tracking-[0.2em] text-slate-400">Active model</span>
      <button type="button" className={modelButton}>GPT-5.5<span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-200/70">⌃</span></button>
      <div className="mt-2 grid w-full gap-2 rounded-xl border border-amber-300/20 bg-[#050505] p-2 shadow-[0_24px_70px_rgba(0,0,0,.75)] sm:grid-cols-2">
        {[
          ["OpenAI", ["GPT-5 mini", "GPT-5", "GPT-5.5", "GPT-5.5 Pro"]],
          ["Anthropic", ["Claude Haiku", "Claude Sonnet", "Claude Opus"]],
          ["Google", ["Gemini 2.5 Flash", "Gemini 2.5 Pro"]],
          ["xAI", ["Grok Fast", "Grok"]],
        ].map(([provider, items]) => (
          <div key={provider as string} className="rounded-lg bg-black/40 p-1.5">
            <p className="px-2 pb-1.5 pt-1 text-left text-[0.62rem] font-bold uppercase tracking-[0.18em] text-slate-500">{provider}</p>
            <div className="space-y-0.5">{(items as string[]).map((item) => <div key={item} className={`flex min-h-9 w-full items-center justify-between gap-3 rounded-lg border px-2.5 text-left text-xs ${item === "GPT-5.5" ? "border-amber-300/20 bg-black text-white" : "border-transparent text-slate-300"}`}><span>{item}</span>{item === "GPT-5.5 Pro" ? <span className="text-[0.52rem] font-bold uppercase tracking-[0.08em] text-amber-200">High usage</span> : null}</div>)}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const ReviewProductPreview = () => (
  <div className="rounded-[24px] border border-white/[0.08] bg-black p-5 shadow-[0_28px_90px_rgba(0,0,0,.58)]">
    <div className="mx-auto max-w-5xl rounded-[22px] bg-[#020202]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
        <div className="text-center"><p className="text-sm font-semibold text-white">Business Knowledge</p><p className="mt-1 text-[10px] text-slate-600">Review and govern the assistant’s business memory</p></div>
        <div className={aiBuilderCornerCtaClassName}>Done</div>
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-3">
        {[
          ["Mission / Value Proposition", "Tagline / value proposition", "Premium websites. AI systems built for real business."],
          ["Products", "AI Systems (product)", "Custom AI copilots, customer support AI, internal knowledge assistants, CRM automation, scheduling systems, dashboards, and multi-step workflows."],
          ["Customer Segments", "Served customer types", "Businesses that need sharper digital presence and operational tools; pricing explicitly references established businesses."],
        ].map(([section, title, copy]) => (
          <div key={section} className="min-w-0">
            <p className="mb-3 text-center text-[9px] font-black uppercase tracking-[.2em] text-slate-400">{section}</p>
            <article className={`${reviewPanel} flex h-full flex-col text-center`}>
              <div className="flex-1 p-5"><h3 className="text-sm font-semibold text-white">{title}</h3><p className="mx-auto mt-3 max-w-xl text-xs leading-6 text-slate-400">{copy}</p></div>
              <div className="grid grid-cols-2 gap-2 border-t border-white/[0.05] p-3"><div className={reviewAction}>Edit</div><div className={reviewAction}>Remove</div></div>
            </article>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default function AiBuilderLanding() {
  return (
    <div className="h-full overflow-y-auto bg-black text-white">
      <main className="relative overflow-hidden px-5 pb-24 pt-10 sm:px-8 sm:pt-14 xl:px-14 xl:pb-28 xl:pt-16 min-[1500px]:px-20">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.018)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_64%)]" />

        <section className="relative mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-[minmax(0,.72fr)_minmax(660px,1.28fr)] lg:gap-14">
          <div className="max-w-2xl">
            <ShellLabel>Arkena AI Builder</ShellLabel>
            <h1 className="mt-5 text-4xl font-semibold leading-[.98] tracking-[-.055em] text-white sm:text-6xl xl:text-7xl">Build the Brain.<span className="block text-slate-400">Keep the knowledge.</span></h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-400 sm:text-lg">Choose the model that learns your business, review what it finds, and use the same approved Business Brain across every assistant you create.</p>
            <div className="mt-7 grid max-w-xl gap-3 sm:grid-cols-2">{["Choose GPT, Claude, Gemini, or Grok", "Import the website without losing your expertise", "Review and govern every knowledge item", "Test the assistant before anyone else uses it"].map((item) => <div key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-300"><Check /><span>{item}</span></div>)}</div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row"><SignUpButton mode="modal" forceRedirectUrl="/ai-builder"><button type="button" className={primaryButton}>Build your Business Brain</button></SignUpButton><SignInButton mode="modal" forceRedirectUrl="/ai-builder"><button type="button" className={secondaryButton}>Sign in</button></SignInButton></div>
          </div>
          <DashboardProductPreview />
        </section>

        <section className="relative mx-auto mt-20 grid max-w-7xl items-center gap-10 border-t border-white/[0.07] pt-16 xl:grid-cols-[1.12fr_.88fr] xl:gap-14">
          <BuilderProductPreview />
          <div><ShellLabel>Website intelligence</ShellLabel><h2 className="mt-4 text-3xl font-semibold tracking-[-.045em] text-white sm:text-5xl">Bring in the website. Keep your expertise in control.</h2><p className="mt-5 max-w-xl text-base leading-7 text-slate-400">Arkena safely crawls the public website, organizes what matters, and keeps imported knowledge separate from the information only you can provide.</p><div className="mt-7 grid gap-4 sm:grid-cols-3 xl:grid-cols-1">{["Products, services, pricing, FAQs, policies, and structured data", "Your answers always take priority over imported website knowledge", "The crawl result becomes a reviewable source, not hidden model context"].map((item) => <div key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-300"><Check /><span>{item}</span></div>)}</div></div>
        </section>

        <section className="relative mx-auto mt-20 grid max-w-7xl gap-10 border-t border-white/[0.07] pt-16 xl:grid-cols-2 xl:gap-14">
          <div className="grid items-center gap-10 lg:grid-cols-[.88fr_1.12fr] xl:grid-cols-1">
            <div><ShellLabel>Model freedom</ShellLabel><h2 className="mt-4 text-3xl font-semibold tracking-[-.045em] text-white sm:text-5xl">Pick the model that builds it. Change the model that answers.</h2><p className="mt-5 max-w-xl text-base leading-7 text-slate-400">The Business Brain is the stable layer. GPT, Claude, Gemini, and Grok can all work from the same approved business knowledge.</p><div className="mt-7 grid gap-4 sm:grid-cols-2"><div className={dashboardPanel}><p className="text-sm font-semibold text-white">One Brain</p><p className="mt-2 text-sm leading-6 text-slate-500">No rebuilding company context every time the model changes.</p></div><div className={dashboardPanel}><p className="text-sm font-semibold text-white">Real comparison</p><p className="mt-2 text-sm leading-6 text-slate-500">Test which model represents the business most accurately.</p></div></div></div>
            <ModelProductPreview />
          </div>

          <div className="grid items-center gap-10 lg:grid-cols-[1.12fr_.88fr] xl:grid-cols-1">
            <ReviewProductPreview />
            <div><ShellLabel>Review and approval</ShellLabel><h2 className="mt-4 text-3xl font-semibold tracking-[-.045em] text-white sm:text-5xl">Nothing becomes business memory until you review it.</h2><p className="mt-5 max-w-xl text-base leading-7 text-slate-400">The review screen gives you direct control over the Business Brain. Edit what is wrong, remove what should not be used, and approve the knowledge you trust.</p><div className="mt-7 grid gap-4 sm:grid-cols-3 xl:grid-cols-1">{["Business knowledge grouped into clear review sections", "Source-backed facts remain visible and governable", "The final Brain reflects the business owner’s decisions"].map((item) => <div key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-300"><Check /><span>{item}</span></div>)}</div></div>
          </div>
        </section>

        <section className="relative mx-auto mt-20 max-w-7xl overflow-hidden rounded-[32px] border border-white/[0.08] bg-[#020202] px-6 py-10 shadow-[0_36px_110px_rgba(0,0,0,.55)] sm:px-10 lg:px-14">
          <div className="grid items-center gap-10 lg:grid-cols-[.9fr_1.1fr]">
            <div><ShellLabel>Use it your way</ShellLabel><h2 className="mt-4 text-3xl font-semibold tracking-[-.045em] text-white sm:text-5xl">Your Brain should not belong to one chatbot.</h2><p className="mt-5 max-w-xl text-base leading-7 text-slate-400">Host the assistant with Arkena, test it inside the workspace, add it to a website, or export the approved knowledge as a Knowledge Pack.</p><div className="mt-7 flex flex-col gap-3 sm:flex-row"><SignUpButton mode="modal" forceRedirectUrl="/ai-builder"><button type="button" className={primaryButton}>Start building</button></SignUpButton><SignInButton mode="modal" forceRedirectUrl="/ai-builder"><button type="button" className={secondaryButton}>Open existing Brain</button></SignInButton></div></div>
            <div className="grid gap-4 sm:grid-cols-2">{["Hosted assistant", "Website widget", "Knowledge Pack", "Any AI model"].map((label) => <div key={label} className={dashboardPanel}><p className="text-sm font-semibold text-white">{label}</p><p className="mt-2 text-xs leading-5 text-slate-500">Powered by the same approved business knowledge.</p><div className={`mt-4 w-fit ${aiBuilderCornerCtaClassName}`}>Open</div></div>)}</div>
          </div>
        </section>
      </main>
    </div>
  );
}
