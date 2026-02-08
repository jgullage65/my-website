import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Tools",
  description:
    "AI Business Solutions: chatbots, lead capture, automations, and custom AI templates for small businesses.",
};

export default function AIToolsPage() {
  return (
    <main className="bg-slate-50">
      {/* HERO */}
      <section className="mx-auto max-w-6xl px-6 pt-14 pb-10">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 md:p-12 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">
            AI BUSINESS SOLUTIONS
          </p>

          <h1 className="mt-3 text-4xl md:text-6xl font-black tracking-tight text-slate-900">
            Automations + AI tools
            <span className="block">that save you time.</span>
          </h1>

          <p className="mt-5 max-w-2xl text-lg md:text-xl text-slate-600">
            I help small businesses set up practical AI — simple chatbots, lead
            capture, follow-up automations, and custom templates — so you get
            more done without hiring a full team.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-xl bg-[var(--navy)] px-7 py-3 font-semibold text-white hover:opacity-90"
            >
              Get an AI Quote →
            </Link>

            <Link
              href="/services"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-7 py-3 font-semibold text-slate-900 hover:bg-slate-100"
            >
              View All Services
            </Link>
          </div>

          <p className="mt-4 text-sm text-slate-500">
            Want the “lead magnet” version? Tell me your industry + goal and
            I’ll recommend the simplest setup.
          </p>
        </div>
      </section>

      {/* FEATURE GRID */}
      <section className="mx-auto max-w-6xl px-6 pb-6">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">CHATBOTS</p>
            <h2 className="mt-2 text-xl font-black text-slate-900">
              Website assistant (24/7)
            </h2>
            <p className="mt-2 text-slate-600">
              Answers common questions, guides visitors, and pushes them toward
              booking or contacting you.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">LEAD CAPTURE</p>
            <h2 className="mt-2 text-xl font-black text-slate-900">
              Forms + instant follow-up
            </h2>
            <p className="mt-2 text-slate-600">
              Collects name/email/needs and sends an auto-response so leads don’t
              go cold.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">AUTOMATIONS</p>
            <h2 className="mt-2 text-xl font-black text-slate-900">
              Repeatable workflows
            </h2>
            <p className="mt-2 text-slate-600">
              Simple “if this, then that” automations for intake, scheduling,
              reminders, and content.
            </p>
          </div>
        </div>
      </section>

      {/* WHAT YOU GET */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 md:p-10">
          <h2 className="text-3xl font-black text-slate-900">
            What you’ll get
          </h2>
          <p className="mt-2 text-slate-600 max-w-2xl">
            No confusing “AI speak.” Just a clean setup that works and is easy
            to maintain.
          </p>

          <div className="mt-7 grid gap-4 md:grid-cols-2">
            {[
              "A clear plan based on your business goal",
              "A simple chatbot / assistant flow (if needed)",
              "Lead capture questions + recommended next steps",
              "Templates for replies, follow-ups, and FAQs",
              "Basic analytics guidance (what to track)",
              "A short handoff doc so you can run it yourself",
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
              >
                <p className="font-semibold text-slate-900">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="rounded-3xl bg-[var(--navy)] text-white p-10 md:p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-black">
            Want an AI chatbot on your site?
          </h2>
          <p className="mt-3 text-white/80 max-w-2xl mx-auto">
            Tell me what industry you’re in and what kind of leads you want.
            We’ll build the simplest version that actually converts.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/contact"
              className="rounded-xl bg-[var(--gold)] px-8 py-3 font-semibold text-[var(--navy)] hover:opacity-90"
            >
              Start AI Setup →
            </Link>
            <Link
              href="/pricing"
              className="rounded-xl border border-white/30 bg-transparent px-8 py-3 font-semibold hover:bg-white/10"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}