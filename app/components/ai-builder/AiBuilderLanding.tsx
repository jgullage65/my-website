"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";

const primaryButton =
  "cta-raised inline-flex min-h-12 items-center justify-center rounded-xl border border-amber-300/25 bg-amber-300 px-5 py-3 text-sm font-black text-black transition duration-300 hover:-translate-y-0.5 hover:bg-amber-200";

const secondaryButton =
  "inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-bold text-white transition duration-300 hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-white/[0.06]";

const Check = () => (
  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-amber-300/30 bg-amber-300/10 text-[11px] font-black text-amber-200">
    ✓
  </span>
);

const ModelChip = ({ name, active = false }: { name: string; active?: boolean }) => (
  <span
    className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
      active
        ? "border-amber-300/40 bg-amber-300/12 text-amber-200 shadow-[0_0_24px_rgba(251,191,36,.12)]"
        : "border-white/10 bg-black/40 text-slate-400"
    }`}
  >
    {name}
  </span>
);

export default function AiBuilderLanding() {
  return (
    <div className="h-full overflow-y-auto bg-black text-white">
      <main className="relative overflow-hidden px-5 pb-20 pt-10 sm:px-8 sm:pt-14 xl:px-14 xl:pb-28 xl:pt-16 min-[1500px]:px-20">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[760px] bg-[radial-gradient(circle_at_72%_18%,rgba(245,158,11,.14),transparent_28%),radial-gradient(circle_at_14%_8%,rgba(255,255,255,.05),transparent_22%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:linear-gradient(to_bottom,black,transparent_76%)]" />

        <section className="relative mx-auto grid w-full max-w-7xl items-center gap-14 lg:grid-cols-[minmax(0,.88fr)_minmax(520px,1.12fr)] lg:gap-16">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/[0.06] px-3 py-1.5 text-xs font-black uppercase tracking-[.2em] text-amber-200">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />
              Arkena AI Builder
            </div>

            <h1 className="mt-6 text-4xl font-semibold leading-[.98] tracking-[-.055em] text-white sm:text-6xl xl:text-7xl">
              Build the Brain.
              <span className="block bg-gradient-to-r from-amber-100 via-amber-300 to-amber-500 bg-clip-text text-transparent">
                Keep the knowledge.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-slate-400 sm:text-lg">
              Choose the model that learns your business, review every fact it finds, then use the same approved Business Brain anywhere you want.
            </p>

            <div className="mt-7 grid max-w-xl gap-3 sm:grid-cols-2">
              {[
                "Pick the model that builds it",
                "Approve knowledge before it is used",
                "Compare answers across AI models",
                "Host it, embed it, or export it",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-300">
                  <Check />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <SignUpButton mode="modal" forceRedirectUrl="/ai-builder">
                <button type="button" className={primaryButton}>Build your Business Brain</button>
              </SignUpButton>
              <SignInButton mode="modal" forceRedirectUrl="/ai-builder">
                <button type="button" className={secondaryButton}>Sign in</button>
              </SignInButton>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-3xl lg:mx-0">
            <div className="pointer-events-none absolute -inset-12 rounded-full bg-amber-400/[0.07] blur-3xl" />
            <div className="relative min-h-[520px] overflow-hidden rounded-[30px] border border-white/10 bg-[#050505]/95 p-3 shadow-[0_40px_120px_rgba(0,0,0,.72),0_0_0_1px_rgba(245,158,11,.04)] sm:p-4">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/60 to-transparent" />
              <div className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-black/70 px-4 py-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.18em] text-slate-500">Business Brain</p>
                  <p className="mt-1 text-sm font-semibold text-white">Acme Growth Studio</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-emerald-300">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
                  Live build
                </div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-[.92fr_1.08fr]">
                <div className="space-y-3">
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black uppercase tracking-[.16em] text-amber-200">Source crawl</p>
                      <span className="text-xs text-slate-500">18 pages</span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {[
                        ["Services", "Mapped"],
                        ["Pricing", "Verified"],
                        ["FAQ", "Extracted"],
                        ["Policies", "Linked"],
                      ].map(([label, status], index) => (
                        <div key={label} className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-black/50 px-3 py-3">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-sm font-semibold text-slate-200">{label}</span>
                            <span className="text-[11px] font-bold text-amber-200">{status}</span>
                          </div>
                          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.05]">
                            <div
                              className="h-full animate-[pulse_2.8s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-amber-500 to-amber-200"
                              style={{ width: `${72 + index * 7}%`, animationDelay: `${index * 160}ms` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
                    <p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Choose the builder</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <ModelChip name="GPT" active />
                      <ModelChip name="Claude" />
                      <ModelChip name="Gemini" />
                      <ModelChip name="Open model" />
                    </div>
                  </div>
                </div>

                <div className="relative rounded-2xl border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.015))] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Knowledge review</p>
                      <p className="mt-1 text-sm font-semibold text-white">Approve before the Brain goes live</p>
                    </div>
                    <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[11px] font-black text-emerald-200">12 approved</span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {[
                      ["Primary service", "AI-assisted lead generation for agencies"],
                      ["Pricing", "Monthly plans from $99"],
                      ["Ideal customer", "Small agencies and solo operators"],
                    ].map(([title, copy], index) => (
                      <div key={title} className="rounded-xl border border-white/[0.08] bg-black/50 p-3 transition duration-300 hover:-translate-y-0.5 hover:border-amber-300/25">
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-amber-300/25 bg-amber-300/10 text-xs font-black text-amber-200">{index + 1}</span>
                          <div>
                            <p className="text-xs font-black uppercase tracking-[.14em] text-slate-500">{title}</p>
                            <p className="mt-1 text-sm leading-6 text-slate-200">{copy}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-2 pl-9 text-[11px] font-bold">
                          <span className="rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-emerald-200">Approve</span>
                          <span className="rounded-md border border-white/10 px-2 py-1 text-slate-400">Correct</span>
                          <span className="rounded-md border border-white/10 px-2 py-1 text-slate-400">Remove</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs font-black uppercase tracking-[.14em] text-amber-200">Brain readiness</span>
                      <span className="text-sm font-black text-white">84%</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/60">
                      <div className="h-full w-[84%] rounded-full bg-gradient-to-r from-amber-500 via-amber-300 to-amber-100 shadow-[0_0_20px_rgba(251,191,36,.35)]" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pointer-events-none absolute bottom-5 right-5 hidden rounded-2xl border border-white/10 bg-black/90 p-3 shadow-2xl sm:block sm:w-60 sm:animate-[float_5s_ease-in-out_infinite]">
                <p className="text-[11px] font-black uppercase tracking-[.16em] text-amber-200">Model comparison</p>
                <p className="mt-2 text-xs leading-5 text-slate-300">Claude gave the clearest answer using the same approved Brain.</p>
                <div className="mt-3 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Answer quality</span>
                  <span className="font-black text-emerald-200">9.4 / 10</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative mx-auto mt-28 grid max-w-7xl items-center gap-14 border-t border-white/[0.07] pt-20 lg:grid-cols-[1.02fr_.98fr] lg:gap-20">
          <div className="relative order-2 lg:order-1">
            <div className="absolute -inset-8 bg-[radial-gradient(circle_at_35%_50%,rgba(245,158,11,.12),transparent_38%)] blur-2xl" />
            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#050505] p-5 shadow-[0_30px_90px_rgba(0,0,0,.55)] sm:p-6">
              <div className="flex items-center justify-between border-b border-white/[0.07] pb-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.18em] text-amber-200">Intelligent crawl</p>
                  <p className="mt-1 text-sm font-semibold text-white">arkanagrowth.com</p>
                </div>
                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-200">Complete</span>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-[180px_1fr]">
                <div className="space-y-2">
                  {[
                    "Home",
                    "Services",
                    "Pricing",
                    "Case studies",
                    "FAQ",
                    "Terms",
                  ].map((item, index) => (
                    <div key={item} className={`rounded-xl border px-3 py-2.5 text-xs font-bold ${index === 1 ? "border-amber-300/25 bg-amber-300/10 text-amber-200" : "border-white/[0.07] bg-black/40 text-slate-500"}`}>
                      {item}
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border border-white/[0.08] bg-black/45 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black uppercase tracking-[.15em] text-slate-500">Extracted knowledge</p>
                    <span className="text-xs text-slate-600">Source attached</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {[
                      ["Service", "AI strategy and automation systems"],
                      ["Audience", "Growth-focused service businesses"],
                      ["Difference", "Business Brain stays portable"],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                        <p className="text-[11px] font-black uppercase tracking-[.14em] text-amber-200">{label}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-300">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <p className="text-xs font-black uppercase tracking-[.22em] text-amber-300">Website intelligence</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-.045em] text-white sm:text-5xl">It does not just scrape a homepage.</h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-400">
              Arkena follows the structure of the business, finds the pages that matter, separates useful facts from website clutter, and keeps the source attached.
            </p>
            <div className="mt-7 space-y-4">
              {[
                "Follows important pages, sitemaps, PDFs, tables, and structured data",
                "Finds services, pricing, policies, FAQs, integrations, and differentiators",
                "Preserves source context so every important fact can be reviewed",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-300">
                  <Check />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative mx-auto mt-28 grid max-w-7xl items-center gap-14 border-t border-white/[0.07] pt-20 lg:grid-cols-[.92fr_1.08fr] lg:gap-20">
          <div>
            <p className="text-xs font-black uppercase tracking-[.22em] text-amber-300">Model freedom</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-.045em] text-white sm:text-5xl">Choose who builds it. Test who answers best.</h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-400">
              The knowledge stays consistent while the model changes. That means you can compare real answers instead of rebuilding the business context every time.
            </p>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
                <p className="text-sm font-semibold text-white">One approved Brain</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">The same source of truth powers every model you test.</p>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
                <p className="text-sm font-semibold text-white">Real side-by-side results</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">Compare clarity, accuracy, tone, and customer fit.</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute -inset-10 bg-[radial-gradient(circle_at_62%_45%,rgba(245,158,11,.12),transparent_38%)] blur-3xl" />
            <div className="relative rounded-[28px] border border-white/10 bg-[#050505] p-5 shadow-[0_30px_90px_rgba(0,0,0,.55)] sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <ModelChip name="GPT" />
                <ModelChip name="Claude" active />
                <ModelChip name="Gemini" />
              </div>
              <div className="mt-5 rounded-2xl border border-white/[0.08] bg-black/50 p-4">
                <p className="text-xs font-black uppercase tracking-[.15em] text-slate-500">Customer question</p>
                <p className="mt-2 text-sm leading-6 text-slate-200">What makes your service different from a normal chatbot setup?</p>
              </div>
              <div className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.055] p-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs font-black uppercase tracking-[.15em] text-amber-200">Claude response</p>
                  <span className="text-xs font-black text-emerald-200">Best match</span>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-200">
                  Your Business Brain is reviewed and approved before it is used. It can then power different AI models, a hosted assistant, a website widget, or an exported Knowledge Pack without rebuilding the company context.
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px] font-bold">
                  <div className="rounded-lg border border-white/[0.07] bg-black/40 px-2 py-2 text-slate-400"><span className="block text-sm text-white">9.6</span>Accuracy</div>
                  <div className="rounded-lg border border-white/[0.07] bg-black/40 px-2 py-2 text-slate-400"><span className="block text-sm text-white">9.2</span>Clarity</div>
                  <div className="rounded-lg border border-white/[0.07] bg-black/40 px-2 py-2 text-slate-400"><span className="block text-sm text-white">9.5</span>Brand fit</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative mx-auto mt-28 max-w-7xl overflow-hidden rounded-[34px] border border-amber-300/15 bg-[linear-gradient(135deg,rgba(245,158,11,.08),rgba(255,255,255,.025)_42%,rgba(0,0,0,.8))] px-6 py-12 shadow-[0_40px_120px_rgba(0,0,0,.55)] sm:px-10 sm:py-16 lg:px-14">
          <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-amber-300/[0.08] blur-3xl" />
          <div className="relative grid items-center gap-12 lg:grid-cols-[1fr_1.05fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[.22em] text-amber-300">Portable by design</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-.045em] text-white sm:text-5xl">Your Brain should not belong to one chatbot.</h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
                Build and approve the knowledge once, then decide how it gets used. The Brain stays yours even when the interface, model, or platform changes.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <SignUpButton mode="modal" forceRedirectUrl="/ai-builder">
                  <button type="button" className={primaryButton}>Start building</button>
                </SignUpButton>
                <SignInButton mode="modal" forceRedirectUrl="/ai-builder">
                  <button type="button" className={secondaryButton}>Open existing Brain</button>
                </SignInButton>
              </div>
            </div>

            <div className="relative min-h-[330px]">
              <div className="absolute left-1/2 top-1/2 z-10 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[28px] border border-amber-300/30 bg-black shadow-[0_0_60px_rgba(245,158,11,.2)]">
                <div className="text-center">
                  <div className="mx-auto h-2.5 w-2.5 animate-pulse rounded-full bg-amber-300" />
                  <p className="mt-3 text-xs font-black uppercase tracking-[.16em] text-amber-200">Business Brain</p>
                </div>
              </div>
              <div className="absolute left-1/2 top-1/2 h-px w-[72%] -translate-x-1/2 bg-gradient-to-r from-transparent via-amber-300/35 to-transparent" />
              <div className="absolute left-1/2 top-1/2 h-[72%] w-px -translate-y-1/2 bg-gradient-to-b from-transparent via-amber-300/35 to-transparent" />

              {[
                ["Hosted assistant", "left-0 top-5"],
                ["Website widget", "right-0 top-5"],
                ["Knowledge Pack", "bottom-5 left-0"],
                ["Any AI model", "bottom-5 right-0"],
              ].map(([label, position], index) => (
                <div key={label} className={`absolute ${position} w-[44%] rounded-2xl border border-white/10 bg-black/75 p-4 shadow-xl transition duration-300 hover:-translate-y-1 hover:border-amber-300/25`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-white">{label}</span>
                    <span className="text-xs font-black text-amber-200">0{index + 1}</span>
                  </div>
                  <div className="mt-3 h-1 rounded-full bg-white/[0.06]"><div className="h-full w-2/3 rounded-full bg-amber-300/60" /></div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
