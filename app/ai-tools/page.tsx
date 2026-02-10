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
          <p className="text-sm font-semibold tracking-wide text-slate-500">
            AI BUSINESS SOLUTIONS
          </p>

          <h1 className="mt-3 text-4xl md:text-6xl font-black tracking-tight text-slate-900">
            AI tools that
            <span className="block text-[var(--navy)]">make your business faster.</span>
          </h1>

          <p className="mt-5 max-w-2xl text-lg md:text-xl text-slate-600">
            I build simple AI systems that help small businesses capture leads, respond faster,
            and automate repetitive tasks — without confusing dashboards or tech overload.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <Link
              href="/contact?service=AI%20Setup&preferred=email"
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
            Not sure what AI would help with? Tell me your industry and I’ll recommend the simplest setup.
          </p>
        </div>
      </section>

      {/* FEATURE CARDS */}
      <section className="mx-auto max-w-6xl px-6 pb-10">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                🤖
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500">CHATBOT</p>
                <h2 className="text-xl font-black text-slate-900">Website AI Assistant</h2>
              </div>
            </div>
            <p className="mt-4 text-slate-600">
              Answers questions, guides visitors, and turns confused clicks into real leads.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                📩
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500">LEAD CAPTURE</p>
                <h2 className="text-xl font-black text-slate-900">Smart Intake Forms</h2>
              </div>
            </div>
            <p className="mt-4 text-slate-600">
              Collects key details automatically so you get better messages and better customers.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                ⚡
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500">AUTOMATION</p>
                <h2 className="text-xl font-black text-slate-900">Workflow Systems</h2>
              </div>
            </div>
            <p className="mt-4 text-slate-600">
              Simple automations that handle follow-ups, scheduling, and repetitive tasks for you.
            </p>
          </div>
        </div>
      </section>

      {/* LIVE DEMO */}
      <section className="mx-auto max-w-6xl px-6 pb-10">
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-100 p-8 md:p-10 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--navy)] px-4 py-2 text-sm font-semibold text-white">
                <span className="text-[var(--gold)]">●</span> LIVE DEMO ON THIS WEBSITE
              </div>

              <h2 className="text-3xl font-black text-slate-900">
                Try the AI assistant right now
              </h2>

              <p className="text-slate-600 max-w-2xl">
                Click the chat bubble in the bottom corner. It collects project info and sends visitors
                into a pre-filled request form.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/contact?service=AI%20Setup&preferred=email"
                className="inline-flex items-center justify-center rounded-xl bg-[var(--gold)] px-7 py-3 font-semibold text-[var(--navy)] hover:opacity-90"
              >
                Set This Up For Me →
              </Link>

              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-7 py-3 font-semibold text-slate-900 hover:bg-slate-100"
              >
                Contact Page
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                title: "Guides Visitors",
                desc: "Helps customers pick the right service without confusion.",
                icon: "🧭",
              },
              {
                title: "Captures Better Leads",
                desc: "Collects details before they contact you (less back-and-forth).",
                icon: "📌",
              },
              {
                title: "Pre-Fills Your Forms",
                desc: "Makes it easier for people to submit requests.",
                icon: "✅",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                <p className="text-2xl">{item.icon}</p>
                <p className="mt-3 font-black text-slate-900">{item.title}</p>
                <p className="mt-2 text-slate-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BEFORE VS AFTER */}
      <section className="mx-auto max-w-6xl px-6 pb-12">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 md:p-10 shadow-sm">
          <h2 className="text-3xl font-black text-slate-900">Before vs After AI Setup</h2>
          <p className="mt-2 text-slate-600 max-w-2xl">
            This is what happens when your website has an actual system behind it.
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-7">
              <p className="text-sm font-semibold text-slate-500">BEFORE</p>
              <h3 className="mt-2 text-xl font-black text-slate-900">
                Visitors leave confused
              </h3>
              <ul className="mt-4 space-y-2 text-slate-600 list-disc pl-5">
                <li>“How much does it cost?”</li>
                <li>“Do you do websites?”</li>
                <li>No clear info to send you</li>
                <li>Leads disappear before contacting you</li>
              </ul>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-[var(--navy)] p-7 text-white">
              <p className="text-sm font-semibold text-white/70">AFTER</p>
              <h3 className="mt-2 text-xl font-black">
                Your website collects leads for you
              </h3>
              <ul className="mt-4 space-y-2 text-white/90 list-disc pl-5">
                <li>AI answers questions instantly</li>
                <li>Visitors get guided to the right service</li>
                <li>Contact form gets pre-filled</li>
                <li>You get higher-quality inquiries</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT YOU GET */}
      <section className="mx-auto max-w-6xl px-6 pb-12">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 md:p-10 shadow-sm">
          <h2 className="text-3xl font-black text-slate-900">What you’ll get</h2>
          <p className="mt-2 text-slate-600 max-w-2xl">
            Everything is customized for your business — not generic AI prompts copied from the internet.
          </p>

          <div className="mt-7 grid gap-4 md:grid-cols-2">
            {[
              "A clear AI plan based on your business goal",
              "Custom chatbot flow (questions + responses)",
              "Lead capture + recommended follow-up system",
              "AI templates for posts, captions, and emails",
              "FAQ / auto-reply scripts to save time",
              "A simple handoff guide so you can run it yourself",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="font-semibold text-slate-900">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="rounded-3xl bg-[var(--navy)] text-white p-10 md:p-12 text-center shadow-sm">
          <h2 className="text-3xl md:text-4xl font-black">
            Want AI working inside your business?
          </h2>
          <p className="mt-3 text-white/80 max-w-2xl mx-auto">
            Tell me your industry and what you want the AI to help with. I’ll recommend the simplest setup
            that actually improves your customer flow.
          </p>

          <div className="mt-7 flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/contact?service=AI%20Setup&preferred=email"
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