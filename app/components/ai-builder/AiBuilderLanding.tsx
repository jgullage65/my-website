"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignIn, useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
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

type BillingPeriod = "monthly" | "yearly";

const plans = [
  {
    name: "Business Brain",
    monthlyPrice: 12,
    yearlyPrice: 120,
    description: "Build, review, and manage Business Brains for multiple websites.",
    features: [
      "Build Business Brains for multiple websites",
      "Review, approve, edit, and organize knowledge",
      "Export or download any Business Brain as a PDF",
    ],
  },
  {
    name: "Hosted Assistant",
    monthlyPrice: 39,
    yearlyPrice: 390,
    description: "Turn your Business Brain into one hosted assistant for your business.",
    features: [
      "Everything in Business Brain",
      "One hosted assistant per month",
      "Connect your AI provider",
      "Deploy and manage one live assistant",
    ],
  },
  {
    name: "Growth",
    monthlyPrice: 79,
    yearlyPrice: 790,
    description: "Operate multiple assistants with a small team from one workspace.",
    features: [
      "Everything in Hosted Assistant",
      "Up to three hosted assistants per month",
      "Team workspace for up to three members",
      "Priority access to new platform features",
    ],
  },
] as const;

function BillingToggle({ billingPeriod, onChange }: { billingPeriod: BillingPeriod; onChange: (period: BillingPeriod) => void }) {
  return (
    <div className="flex justify-center">
      <div className="inline-grid grid-cols-2 gap-1 rounded-xl border border-white/[0.08] bg-black p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_10px_24px_rgba(0,0,0,0.28)]" role="tablist" aria-label="Billing period">
        {(["monthly", "yearly"] as BillingPeriod[]).map((period) => {
          const selected = billingPeriod === period;
          return (
            <button
              key={period}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(period)}
              className={[
                "min-w-[108px] rounded-lg border px-4 py-2 text-sm font-semibold transition-[border-color,background-color,color,box-shadow] duration-150",
                selected
                  ? "border-amber-300/35 bg-[#0b0b0b] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_0_0_1px_rgba(245,158,11,0.05)]"
                  : "border-transparent bg-black text-slate-400 hover:bg-white/[0.025] hover:text-slate-200",
              ].join(" ")}
            >
              <span className="capitalize">{period}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AiBuilderLanding() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const [signInOpen, setSignInOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");

  useEffect(() => {
    if (isSignedIn) setSignInOpen(false);
  }, [isSignedIn]);

  const handleSignIn = () => {
    if (!isLoaded) return;

    if (isSignedIn) {
      router.push("/brain-builder");
      return;
    }

    setSignInOpen(true);
  };

  return (
    <>
      <div className="min-h-dvh bg-black text-white">
        <main className="relative overflow-hidden px-4 pb-16 pt-10 sm:px-6 lg:px-8 xl:px-10">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.018)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_64%)]" />

          <div className="relative flex min-h-[calc(100dvh-136px)] flex-col">
          <section className="grid w-full items-center gap-8 xl:grid-cols-[minmax(360px,.58fr)_minmax(0,1.42fr)] 2xl:gap-10">
            <div className="max-w-xl">
              <Image src="/image/Arkenalogo.png" alt="Arkena Studio" width={260} height={72} priority className="h-auto w-[180px] object-contain sm:w-[210px] xl:w-[230px]" />
              <h1 className="mt-5 text-3xl font-medium leading-[1.04] tracking-[-.035em] text-white sm:text-4xl xl:text-5xl">Build the Brain.<span className="block text-slate-400">Keep the knowledge.</span></h1>
              <p className="mt-5 text-base leading-7 text-slate-400">Choose the model that builds your Business Brain, review every insight before it becomes trusted knowledge, and use that approved Business Brain with GPT, Claude, Gemini, Grok, and future models.</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <button type="button" className={primaryButton} onClick={() => setPlansOpen(true)}>Plans</button>
                <button type="button" className={primaryButton} onClick={handleSignIn}>Sign In</button>
              </div>

              <div className="mt-8 grid gap-7 border-t border-white/[0.07] pt-6">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-white">Model freedom</p>
                  <p className="mt-3 text-base leading-7 text-slate-400">Build your Business Brain with the model you choose today. Switch the model that answers tomorrow without rebuilding your business knowledge.</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-white">Review and approval</p>
                  <p className="mt-3 text-base leading-7 text-slate-400">Nothing becomes Business Memory until you approve it. Edit what isn’t right, remove what doesn’t belong, and trust what you keep.</p>
                </div>
              </div>
            </div>
            <AiBuilderSurfaceShowcase session={aiBuilderDemoSession} builder={aiBuilderDemoBuilder} models={aiBuilderDemoModels} diagnostics={aiBuilderDemoDiagnostics} autoAdvance className="min-w-0" />
          </section>

          <section className="mt-6 grid w-full gap-4 border-t border-white/[0.07] pt-6 min-[641px]:grid-cols-2 xl:mt-auto xl:grid-cols-4">
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
                <button type="button" className={primaryButton} onClick={() => setPlansOpen(true)}>Plans</button>
                <button type="button" className={primaryButton} onClick={handleSignIn}>Sign In</button>
                <Link href="/contact" className={primaryButton}>Contact</Link>
              </div>
            </div>
          </section>
        </main>
      </div>

      {plansOpen ? (
        <div className="fixed inset-0 z-[9998] overflow-y-auto overscroll-contain bg-black text-white [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:bg-black/85 sm:px-4 sm:py-8 sm:backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Business Brain plans">
          <button type="button" className="fixed inset-0 hidden cursor-default sm:block" aria-label="Close plans" onClick={() => setPlansOpen(false)} />
          <div className="relative z-10 min-h-dvh w-full bg-black px-4 pb-8 pt-5 sm:mx-auto sm:my-4 sm:min-h-0 sm:max-w-6xl sm:rounded-[28px] sm:border sm:border-white/[0.09] sm:p-7 sm:shadow-[0_30px_100px_rgba(0,0,0,.7)] lg:p-8">
            <button type="button" onClick={() => setPlansOpen(false)} className="fixed right-4 top-4 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.1] bg-[#090909] text-xl text-white transition hover:border-amber-300/40 hover:bg-[#111111] sm:absolute" aria-label="Close plans">×</button>

            <div className="pt-1 sm:pt-0">
              <BillingToggle billingPeriod={billingPeriod} onChange={setBillingPeriod} />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {plans.map((plan) => {
                const price = billingPeriod === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
                const suffix = billingPeriod === "monthly" ? "/month" : "/year";
                return (
                  <article key={plan.name} className="flex h-full flex-col rounded-[22px] border border-white/[0.08] bg-[#050505] p-5 shadow-[0_16px_44px_rgba(0,0,0,.26)] sm:p-6">
                    <div className="text-center">
                      <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
                      <div className="mt-3 flex items-end justify-center gap-1">
                        <span className="text-4xl font-semibold tracking-[-.04em] text-white">${price}</span>
                        <span className="pb-1 text-sm text-slate-500">{suffix}</span>
                      </div>
                      <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-slate-400">{plan.description}</p>
                    </div>

                    <div className="mt-6 grid gap-3 border-t border-white/[0.07] pt-5">
                      {plan.features.map((feature) => (
                        <div key={feature} className="flex items-start gap-3">
                          <Check />
                          <p className="text-sm leading-6 text-slate-300">{feature}</p>
                        </div>
                      ))}
                    </div>

                    <button type="button" onClick={() => { setPlansOpen(false); handleSignIn(); }} className={`${primaryButton} mt-6 w-full`}>Choose {plan.name}</button>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {signInOpen && !isSignedIn ? (
        <div className="pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center px-4 py-8" role="dialog" aria-modal="true" aria-label="Sign in">
          <div className="pointer-events-auto relative w-full max-w-md">
            <button type="button" onClick={() => setSignInOpen(false)} className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-amber-300/20 bg-[#090909] text-lg text-amber-300 transition hover:border-amber-300/40 hover:bg-[#111111]" aria-label="Close sign in">×</button>
            <SignIn
              routing="hash"
              forceRedirectUrl="/brain-builder"
              fallbackRedirectUrl="/brain-builder"
              appearance={{
                elements: {
                  rootBox: "w-full",
                  cardBox: "w-full shadow-none",
                  card: "w-full rounded-[24px] border border-amber-300/20 bg-black shadow-[0_26px_70px_rgba(0,0,0,.5)]",
                },
              }}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
