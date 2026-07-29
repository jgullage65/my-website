"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";

const primaryButton =
  "cta-raised inline-flex min-h-12 items-center justify-center rounded-xl border border-amber-300/20 bg-[#080808] px-5 py-3 text-sm font-black text-white shadow-[0_10px_24px_rgba(0,0,0,.28),inset_0_1px_0_rgba(255,255,255,.05)] transition duration-300 hover:-translate-y-0.5 hover:border-amber-300/35 hover:bg-[#111111]";

const secondaryButton =
  "inline-flex min-h-12 items-center justify-center rounded-xl border border-amber-300/15 bg-transparent px-5 py-3 text-sm font-bold text-slate-300 transition duration-300 hover:-translate-y-0.5 hover:border-amber-300/30 hover:text-white";

const mockCtaClass =
  "inline-flex min-h-9 items-center justify-center rounded-lg border border-amber-300/15 bg-[#080808] px-3 py-2 text-[10px] font-black text-white shadow-[0_8px_18px_rgba(0,0,0,.24),inset_0_1px_0_rgba(255,255,255,.04)]";

const panelClass = "rounded-2xl border border-amber-300/12 bg-[#030303]";
const fieldClass = "rounded-xl border border-amber-300/12 bg-black";

const Check = () => (
  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-amber-300/20 bg-[#070707] text-[11px] font-black text-amber-200">
    ✓
  </span>
);

const ShellLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] font-black uppercase tracking-[.24em] text-amber-300">{children}</p>
);

const WorkspacePreview = () => (
  <div className="overflow-hidden rounded-[24px] border border-amber-300/12 bg-black shadow-[0_28px_90px_rgba(0,0,0,.58)]">
    <div className="grid min-h-[390px] grid-cols-[104px_minmax(0,1fr)_170px] max-[900px]:grid-cols-[82px_minmax(0,1fr)] max-[900px]:[&_.assistant-pane]:hidden">
      <aside className="border-r border-amber-300/10 bg-[#020202] p-3">
        <p className="text-[9px] text-slate-500">← All Projects</p>
        <div className="mt-4">
          <p className="text-[11px] font-bold text-white">JG Creative Studio</p>
          <p className="mt-1 truncate text-[9px] text-slate-600">jgecreativestudios.com</p>
        </div>
        <p className="mt-6 text-[8px] font-black uppercase tracking-[.18em] text-slate-600">Workspace</p>
        <div className="mt-2 space-y-1.5 text-[9px] font-semibold">
          {[
            "Dashboard",
            "Project Insights",
            "Overview",
            "Business Knowledge",
            "Sources",
            "Settings",
          ].map((item, index) => (
            <div key={item} className={`rounded-md px-2 py-1.5 ${index === 0 ? "border-l-2 border-amber-300 bg-white/[0.035] text-amber-100" : "text-slate-500"}`}>
              {item}
            </div>
          ))}
        </div>
      </aside>

      <section className="min-w-0 bg-black">
        <div className="border-b border-amber-300/8 px-4 py-3 text-center">
          <p className="text-xs font-semibold text-white">Dashboard</p>
          <p className="mt-1 text-[9px] text-slate-600">Priorities, readiness, and recent project changes</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 border-b border-amber-300/8 px-3 py-2.5 text-[8px] text-slate-600">
          {["Source connected", "Knowledge generated", "Review complete", "Build completed", "Assistant tested"].map((item, index) => (
            <span key={item} className={index > 0 && index < 4 ? "text-amber-200" : ""}>{index > 0 && index < 4 ? "✓ " : "○ "}{item}</span>
          ))}
        </div>
        <div className="grid gap-2.5 p-3 md:grid-cols-2">
          <article className={`${panelClass} p-3.5`}>
            <h3 className="text-center text-xs font-semibold text-white">Needs attention</h3>
            <div className="mt-4 space-y-3 text-[10px]">
              <div><p className="font-semibold text-white">No website source connected</p><p className="mt-1 text-slate-600">Import a website to broaden the assistant’s source material.</p></div>
              <div className="border-t border-amber-300/8 pt-3"><p className="font-semibold text-white">Assistant has not been tested</p><p className="mt-1 text-slate-600">Run a few real customer questions before launch.</p></div>
            </div>
          </article>
          <article className={`${panelClass} p-3.5 text-center`}>
            <h3 className="text-xs font-semibold text-white">Last AI build</h3>
            <p className="mt-2 text-[10px] text-slate-600">Built Jul 18, 2026, 9:54 PM</p>
            <div className={`mx-auto mt-4 w-fit ${mockCtaClass}`}>✓ 0 Approved Q&A</div>
          </article>
          <article className={`${panelClass} p-3.5 text-center`}>
            <h3 className="text-xs font-semibold text-white">Knowledge source mix</h3>
            <p className="mt-4 text-[10px] leading-5 text-slate-600">Source composition will appear after knowledge is generated.</p>
            <div className={`mx-auto mt-4 w-fit ${mockCtaClass}`}>Inspect source material</div>
          </article>
          <article className={`${panelClass} p-3.5`}>
            <h3 className="text-center text-xs font-semibold text-white">Recent project changes</h3>
            <div className="mt-3 space-y-2.5 text-[9px]">
              {["How can I contact LeadForge for support?", "Are subscriptions refundable?", "What features are included in LeadForge?"].map((item) => (
                <div key={item} className="grid grid-cols-[82px_1fr] gap-2 border-t border-amber-300/8 pt-2.5"><span className="font-black uppercase tracking-[.08em] text-amber-200">Q&A archived</span><span className="text-slate-400">{item}</span></div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <aside className="assistant-pane border-l border-amber-300/10 bg-[#020202] p-3">
        <div className="text-center"><ShellLabel>Live assistant test</ShellLabel><p className="mt-2 text-[8px] font-black uppercase tracking-[.2em] text-slate-500">Active model</p></div>
        <div className={`mt-2.5 ${fieldClass} px-3 py-2 text-center text-[10px] font-semibold text-white`}>Claude Sonnet⌄</div>
        <div className={`mt-4 ${fieldClass} p-3 text-[10px] leading-5 text-slate-200`}>Hi, I’m LeadForge AI. Ask me anything about this business.</div>
        <div className="mt-28 border-t border-amber-300/8 pt-3">
          <div className={`mb-3 w-fit ${mockCtaClass}`}>Buy This AI Assistant</div>
          <div className={`${fieldClass} p-3 text-[9px] leading-5 text-slate-600`}>Ask about services, pricing, policies, or the business...</div>
        </div>
      </aside>
    </div>
  </div>
);

const BuilderPreview = () => (
  <div className="overflow-hidden rounded-[24px] border border-amber-300/12 bg-black p-4 shadow-[0_28px_90px_rgba(0,0,0,.58)]">
    <div className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
      <div className="space-y-3">
        <div className="text-center"><ShellLabel>AI Builder</ShellLabel><p className="mt-2 text-[8px] font-black uppercase tracking-[.2em] text-slate-500">Active model</p><div className={`mx-auto mt-2 max-w-[250px] ${fieldClass} px-4 py-2.5 text-xs font-semibold text-white`}>GPT-5.5⌄</div></div>
        <article className={`${panelClass} p-4 text-center`}>
          <ShellLabel>Connect your website</ShellLabel>
          <p className="mx-auto mt-3 max-w-md text-[11px] leading-5 text-slate-500">We safely crawl public pages and organize the useful information into a read-only source.</p>
          <div className={`mt-4 ${fieldClass} px-4 py-3 text-xs text-slate-400`}>https://yourbusiness.com</div>
          <div className={`mx-auto mt-3 max-w-xs ${mockCtaClass}`}>Import Website</div>
        </article>
        <article className={`${panelClass} p-4 text-center`}>
          <ShellLabel>Communication style</ShellLabel>
          <p className="mt-3 text-sm font-semibold text-white">How should your AI sound?</p>
          <div className={`mt-4 ${fieldClass} px-4 py-3 text-xs text-slate-300`}>Professional⌄</div>
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
            <article key={title} className={`${panelClass} p-4 text-center`}>
              <h3 className="text-sm font-semibold text-white">{title}</h3>
              <div className={`mt-4 min-h-24 whitespace-pre-line ${fieldClass} px-4 py-4 text-xs leading-5 text-slate-400`}>{copy}</div>
            </article>
          ))}
        </div>
        <article className={`mx-auto mt-4 max-w-xl ${panelClass} p-4 text-center`}>
          <ShellLabel>Final step</ShellLabel><p className="mt-3 text-sm font-semibold text-white">Ready to build your AI?</p><div className={`mx-auto mt-4 w-fit ${mockCtaClass}`}>Build My AI</div>
        </article>
      </div>
    </div>
  </div>
);

const ReviewPreview = () => (
  <div className="rounded-[24px] border border-amber-300/12 bg-black p-4 shadow-[0_28px_90px_rgba(0,0,0,.58)]">
    <div className="mx-auto max-w-2xl rounded-[22px] border border-amber-300/10 bg-[#020202]">
      <div className="flex items-center justify-between border-b border-amber-300/8 px-5 py-4">
        <div className="text-center"><p className="text-sm font-semibold text-white">Business Knowledge</p><p className="mt-1 text-[10px] text-slate-600">Review and govern the assistant’s business memory</p></div>
        <div className={mockCtaClass}>Done</div>
      </div>
      <div className="space-y-5 p-4">
        {[
          ["Mission / Value Proposition", "Tagline / value proposition", "Premium websites. AI systems built for real business."],
          ["Products", "AI Systems (product)", "Custom AI copilots, customer support AI, internal knowledge assistants, CRM automation, scheduling systems, dashboards, and multi-step workflows."],
          ["Customer Segments", "Served customer types", "Businesses that need sharper digital presence and operational tools; pricing explicitly references established businesses."],
        ].map(([section, title, copy]) => (
          <div key={section}>
            <div className="mb-3 flex items-center gap-3"><div className="h-px flex-1 bg-amber-300/8" /><p className="text-[9px] font-black uppercase tracking-[.24em] text-slate-400">{section}</p><div className="h-px flex-1 bg-amber-300/8" /></div>
            <article className={`overflow-hidden ${panelClass} text-center`}>
              <div className="p-4"><h3 className="text-sm font-semibold text-white">{title}</h3><p className="mx-auto mt-3 max-w-xl text-xs leading-6 text-slate-400">{copy}</p></div>
              <div className="grid grid-cols-2 gap-2 border-t border-amber-300/8 p-3 text-[10px] font-semibold text-white"><div className={mockCtaClass}>Edit</div><div className={mockCtaClass}>Remove</div></div>
            </article>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const ModelMenuPreview = () => (
  <div className="rounded-[24px] border border-amber-300/12 bg-black p-4 shadow-[0_28px_90px_rgba(0,0,0,.58)]">
    <p className="text-center text-[9px] font-black uppercase tracking-[.22em] text-slate-500">Active model</p>
    <div className={`mx-auto mt-3 max-w-sm ${fieldClass} px-4 py-3 text-center text-sm font-semibold text-white`}>GPT-5.5⌃</div>
    <div className="mx-auto mt-2 max-w-sm rounded-2xl border border-amber-300/12 bg-[#020202] p-4 text-sm">
      {[
        ["OpenAI", ["GPT-5 mini", "GPT-5", "GPT-5.5", "GPT-5.5 Pro"]],
        ["Anthropic", ["Claude Haiku", "Claude Sonnet", "Claude Opus"]],
        ["Google", ["Gemini 2.5 Flash", "Gemini 2.5 Pro"]],
        ["xAI", ["Grok Fast", "Grok"]],
      ].map(([group, items]) => (
        <div key={group as string} className="mb-4 last:mb-0"><p className="text-[9px] font-black uppercase tracking-[.2em] text-slate-500">{group}</p><div className="mt-2 space-y-1 text-slate-300">{(items as string[]).map((item) => (<div key={item} className={`flex items-center justify-between rounded-lg px-2 py-1.5 ${item === "GPT-5.5" ? "border border-amber-300/14 bg-white/[0.015] text-white" : ""}`}><span>{item}</span>{item === "GPT-5.5 Pro" ? <span className="text-[9px] font-black uppercase tracking-[.12em] text-amber-200">High usage</span> : null}</div>))}</div></div>
      ))}
    </div>
  </div>
);

export default function AiBuilderLanding() {
  return (
    <div className="h-full overflow-y-auto bg-black text-white">
      <main className="relative overflow-hidden px-5 pb-24 pt-10 sm:px-8 sm:pt-14 xl:px-14 xl:pb-28 xl:pt-16 min-[1500px]:px-20">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.018)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_64%)]" />

        <section className="relative mx-auto grid w-full max-w-7xl items-center gap-14 lg:grid-cols-[minmax(0,.78fr)_minmax(620px,1.22fr)] lg:gap-16">
          <div className="max-w-2xl">
            <ShellLabel>Arkena AI Builder</ShellLabel>
            <h1 className="mt-5 text-4xl font-semibold leading-[.98] tracking-[-.055em] text-white sm:text-6xl xl:text-7xl">Build the Brain.<span className="block text-slate-400">Keep the knowledge.</span></h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-400 sm:text-lg">Choose the model that learns your business, review what it finds, and use the same approved Business Brain across every assistant you create.</p>
            <div className="mt-7 grid max-w-xl gap-3 sm:grid-cols-2">
              {["Choose GPT, Claude, Gemini, or Grok", "Import the website without losing your expertise", "Review and govern every knowledge item", "Test the assistant before anyone else uses it"].map((item) => (<div key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-300"><Check /><span>{item}</span></div>))}
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row"><SignUpButton mode="modal" forceRedirectUrl="/ai-builder"><button type="button" className={primaryButton}>Build your Business Brain</button></SignUpButton><SignInButton mode="modal" forceRedirectUrl="/ai-builder"><button type="button" className={secondaryButton}>Sign in</button></SignInButton></div>
          </div>
          <WorkspacePreview />
        </section>

        <section className="relative mx-auto mt-28 grid max-w-7xl items-center gap-14 border-t border-amber-300/8 pt-20 lg:grid-cols-[1.08fr_.92fr] lg:gap-20">
          <BuilderPreview />
          <div><ShellLabel>Website intelligence</ShellLabel><h2 className="mt-4 text-3xl font-semibold tracking-[-.045em] text-white sm:text-5xl">Bring in the website. Keep your expertise in control.</h2><p className="mt-5 max-w-xl text-base leading-7 text-slate-400">Arkena safely crawls the public website, organizes what matters, and keeps imported knowledge separate from the information only you can provide.</p><div className="mt-7 space-y-4">{["Products, services, pricing, FAQs, policies, and structured data", "Your answers always take priority over imported website knowledge", "The crawl result becomes a reviewable source, not hidden model context"].map((item) => <div key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-300"><Check /><span>{item}</span></div>)}</div></div>
        </section>

        <section className="relative mx-auto mt-28 grid max-w-7xl items-center gap-14 border-t border-amber-300/8 pt-20 lg:grid-cols-[.88fr_1.12fr] lg:gap-20">
          <div><ShellLabel>Model freedom</ShellLabel><h2 className="mt-4 text-3xl font-semibold tracking-[-.045em] text-white sm:text-5xl">Pick the model that builds it. Change the model that answers.</h2><p className="mt-5 max-w-xl text-base leading-7 text-slate-400">The Business Brain is the stable layer. GPT, Claude, Gemini, and Grok can all work from the same approved business knowledge.</p><div className="mt-7 grid gap-4 sm:grid-cols-2"><div className={`${panelClass} p-4`}><p className="text-sm font-semibold text-white">One Brain</p><p className="mt-2 text-sm leading-6 text-slate-500">No rebuilding company context every time the model changes.</p></div><div className={`${panelClass} p-4`}><p className="text-sm font-semibold text-white">Real comparison</p><p className="mt-2 text-sm leading-6 text-slate-500">Test which model represents the business most accurately.</p></div></div></div>
          <ModelMenuPreview />
        </section>

        <section className="relative mx-auto mt-28 grid max-w-7xl items-center gap-14 border-t border-amber-300/8 pt-20 lg:grid-cols-[1.08fr_.92fr] lg:gap-20">
          <ReviewPreview />
          <div><ShellLabel>Review and approval</ShellLabel><h2 className="mt-4 text-3xl font-semibold tracking-[-.045em] text-white sm:text-5xl">Nothing becomes business memory until you review it.</h2><p className="mt-5 max-w-xl text-base leading-7 text-slate-400">The review screen gives you direct control over the Business Brain. Edit what is wrong, remove what should not be used, and approve the knowledge you trust.</p><div className="mt-7 space-y-4">{["Business knowledge grouped into clear review sections", "Source-backed facts remain visible and governable", "The final Brain reflects the business owner’s decisions"].map((item) => <div key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-300"><Check /><span>{item}</span></div>)}</div></div>
        </section>

        <section className="relative mx-auto mt-28 max-w-7xl overflow-hidden rounded-[32px] border border-amber-300/12 bg-[#020202] px-6 py-12 shadow-[0_36px_110px_rgba(0,0,0,.55)] sm:px-10 sm:py-16 lg:px-14">
          <div className="grid items-center gap-12 lg:grid-cols-[.9fr_1.1fr]">
            <div><ShellLabel>Use it your way</ShellLabel><h2 className="mt-4 text-3xl font-semibold tracking-[-.045em] text-white sm:text-5xl">Your Brain should not belong to one chatbot.</h2><p className="mt-5 max-w-xl text-base leading-7 text-slate-400">Host the assistant with Arkena, test it inside the workspace, add it to a website, or export the approved knowledge as a Knowledge Pack.</p><div className="mt-7 flex flex-col gap-3 sm:flex-row"><SignUpButton mode="modal" forceRedirectUrl="/ai-builder"><button type="button" className={primaryButton}>Start building</button></SignUpButton><SignInButton mode="modal" forceRedirectUrl="/ai-builder"><button type="button" className={secondaryButton}>Open existing Brain</button></SignInButton></div></div>
            <div className="relative min-h-[360px]">
              <div className="absolute left-1/2 top-1/2 z-10 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[26px] border border-amber-300/20 bg-black shadow-[0_20px_60px_rgba(0,0,0,.55)]"><div className="text-center"><span className="mx-auto block h-2 w-2 rounded-full bg-amber-300" /><p className="mt-3 text-[10px] font-black uppercase tracking-[.18em] text-amber-200">Business Brain</p></div></div>
              <div className="absolute left-1/2 top-1/2 h-px w-[72%] -translate-x-1/2 bg-gradient-to-r from-transparent via-amber-300/25 to-transparent" /><div className="absolute left-1/2 top-1/2 h-[72%] w-px -translate-y-1/2 bg-gradient-to-b from-transparent via-amber-300/25 to-transparent" />
              {[["Hosted assistant", "left-0 top-5"], ["Website widget", "right-0 top-5"], ["Knowledge Pack", "bottom-5 left-0"], ["Any AI model", "bottom-5 right-0"]].map(([label, position], index) => (<div key={label} className={`absolute ${position} w-[44%] ${panelClass} p-4 shadow-xl transition duration-300 hover:-translate-y-1 hover:border-amber-300/20`}><div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-white">{label}</span><span className="text-xs font-black text-amber-200">0{index + 1}</span></div><div className="mt-3 h-px bg-amber-300/8" /><p className="mt-3 text-xs leading-5 text-slate-500">Powered by the same approved business knowledge.</p></div>))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
