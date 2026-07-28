"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";

const authButton =
  "cta-raised inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-amber-300/20 bg-black px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:border-amber-300/40 hover:bg-[#0a0a0a]";

const steps = [
  ["01", "Bring in the business", "Import the website, then add the details only you know."],
  ["02", "Review the knowledge", "Approve what is right. Correct or remove what is not."],
  ["03", "Test real questions", "Use the assistant like a customer and compare the available models."],
] as const;

const reasons = [
  "See exactly what the assistant knows before you test it.",
  "Keep website sources, manual knowledge, and Q&A in one project.",
  "Nothing is published from this demo.",
] as const;

export default function AiBuilderLanding() {
  return (
    <div className="min-h-full bg-black px-5 py-10 sm:px-8 sm:py-14 xl:grid xl:grid-cols-[minmax(0,1fr)_380px] xl:items-center xl:gap-14 xl:px-14 xl:py-12 min-[1500px]:gap-20 min-[1500px]:px-20">
      <main className="mx-auto w-full max-w-4xl xl:mx-0">
        <header className="text-center xl:text-left">
          <p className="text-xs font-black uppercase tracking-[.24em] text-amber-300">AI Builder Demo</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-.04em] text-white sm:text-4xl xl:max-w-3xl xl:text-5xl">Build the knowledge. Test the assistant.</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-400 xl:mx-0">Import a business website, fill in what it misses, review the result, and test the same knowledge across different models.</p>
        </header>

        <section className="mt-10 border-y border-white/[0.08] py-8">
          <h2 className="text-center text-sm font-semibold text-white xl:text-left">How it works</h2>
          <div className="mt-5 grid gap-px overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.08] md:grid-cols-3">
            {steps.map(([number, title, copy]) => <article key={number} className="bg-[#050505] p-5 text-center md:text-left"><p className="text-xs font-bold text-amber-300">{number}</p><h3 className="mt-3 text-sm font-semibold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{copy}</p></article>)}
          </div>
        </section>

        <section className="py-8">
          <h2 className="text-center text-sm font-semibold text-white xl:text-left">Why use it</h2>
          <ul className="mx-auto mt-5 grid max-w-2xl gap-3 text-sm text-slate-400 xl:mx-0">
            {reasons.map((reason) => <li key={reason} className="flex items-start gap-3"><span aria-hidden="true" className="mt-0.5 text-amber-300">✓</span><span>{reason}</span></li>)}
          </ul>
        </section>
      </main>

      <aside className="mx-auto mt-2 w-full max-w-md rounded-2xl border border-amber-300/20 bg-[#050505] p-6 text-center shadow-[0_24px_70px_rgba(0,0,0,.45)] sm:p-8 xl:mt-0">
        <p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">Open the builder</p>
        <h2 className="mt-3 text-xl font-semibold text-white">Start with a free demo project</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">Sign in to save your work, or create an account to begin.</p>
        <div className="mt-6 grid gap-3">
          <SignUpButton mode="modal" forceRedirectUrl="/ai-builder"><button type="button" className={authButton}>Create account</button></SignUpButton>
          <SignInButton mode="modal" forceRedirectUrl="/ai-builder"><button type="button" className={authButton}>Sign in</button></SignInButton>
        </div>
      </aside>
    </div>
  );
}
