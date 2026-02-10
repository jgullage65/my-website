import Link from "next/link";

export const metadata = {
  title: "Home",
};

export default function HomePage() {
  return (
    <main className="bg-slate-50">
      {/* HERO */}
      <section className="mx-auto max-w-6xl px-6 pt-14 pb-10">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 md:p-12 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <p className="text-sm font-semibold tracking-wide text-slate-500">
              JG CREATIVE STUDIO
            </p>

            <h1 className="mt-3 text-4xl md:text-6xl font-black tracking-tight text-slate-900">
              Modern websites & content
              <span className="block text-[var(--navy)]">for your business.</span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-lg md:text-xl text-slate-600">
              Clean websites, eye-catching flyers, simple social content, and
              practical AI tools that save you time — without the stress.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/services"
                className="rounded-xl bg-[var(--navy)] px-7 py-3 font-semibold text-white hover:opacity-90"
              >
                View Services
              </Link>
              <Link
                href="/contact"
                className="rounded-xl border border-slate-300 bg-white px-7 py-3 font-semibold text-slate-900 hover:bg-slate-100"
              >
                Get a Quote
              </Link>
            </div>

            <p className="mt-4 text-sm text-slate-500">
              Not sure what you need?{" "}
              <Link href="/contact" className="font-semibold underline">
                Message me
              </Link>{" "}
              and I’ll recommend the simplest path.
            </p>
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="mx-auto max-w-6xl px-6 pb-10">
        <div className="grid gap-4 md:grid-cols-4">
          {[
            {
              title: "Fast turnaround",
              desc: "Clean work delivered quickly.",
              icon: "⚡",
            },
            {
              title: "Affordable options",
              desc: "Pricing that makes sense starting out.",
              icon: "💰",
            },
            {
              title: "One-person studio",
              desc: "Direct communication with me.",
              icon: "🤝",
            },
            {
              title: "Simple + modern",
              desc: "No clutter. Easy navigation.",
              icon: "✨",
            },
          ].map((t) => (
            <div
              key={t.title}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <p className="text-2xl">{t.icon}</p>
              <p className="mt-2 font-black text-slate-900">{t.title}</p>
              <p className="mt-1 text-sm text-slate-600">{t.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* WHAT I CAN HELP WITH */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-slate-900">
              What I can help with
            </h2>
            <p className="mt-2 text-slate-600">
              Pick one service or mix and match. I’ll keep it simple.
            </p>
          </div>

          <Link
            href="/services"
            className="hidden sm:inline-flex rounded-xl bg-[var(--gold)] px-5 py-2 font-semibold text-[var(--navy)] hover:opacity-90"
          >
            All Services →
          </Link>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                🧱
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500">WEBSITES</p>
                <h3 className="text-xl font-black text-slate-900">
                  Modern sites
                </h3>
              </div>
            </div>
            <p className="mt-4 text-slate-600">
              A clean site that loads fast and helps people contact you.
            </p>
            <Link
              href="/services"
              className="mt-5 inline-block font-semibold text-[var(--navy)] hover:underline"
            >
              Learn more →
            </Link>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                🧾
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500">FLYERS</p>
                <h3 className="text-xl font-black text-slate-900">
                  Promo design
                </h3>
              </div>
            </div>
            <p className="mt-4 text-slate-600">
              Promotions, menus, events — designed clean and easy to read.
            </p>
            <Link
              href="/examples"
              className="mt-5 inline-block font-semibold text-[var(--navy)] hover:underline"
            >
              See examples →
            </Link>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                📱
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500">SOCIAL</p>
                <h3 className="text-xl font-black text-slate-900">
                  Post packs
                </h3>
              </div>
            </div>
            <p className="mt-4 text-slate-600">
              Simple posts that match your brand and keep you consistent.
            </p>
            <Link
              href="/pricing"
              className="mt-5 inline-block font-semibold text-[var(--navy)] hover:underline"
            >
              View pricing →
            </Link>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                🤖
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500">AI TOOLS</p>
                <h3 className="text-xl font-black text-slate-900">
                  Automations
                </h3>
              </div>
            </div>
            <p className="mt-4 text-slate-600">
              Website AI assistants + templates to help you reply faster.
            </p>
            <Link
              href="/ai-tools"
              className="mt-5 inline-block font-semibold text-[var(--navy)] hover:underline"
            >
              See AI tools →
            </Link>
          </div>
        </div>

        <div className="mt-8 sm:hidden">
          <Link
            href="/services"
            className="inline-flex rounded-xl bg-[var(--gold)] px-5 py-2 font-semibold text-[var(--navy)] hover:opacity-90"
          >
            All Services →
          </Link>
        </div>
      </section>

      {/* LIVE AI DEMO TEASER */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-100 p-8 md:p-10 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--navy)] px-4 py-2 text-sm font-semibold text-white">
                <span className="text-[var(--gold)]">●</span> LIVE AI DEMO
              </div>
              <h2 className="text-3xl font-black text-slate-900">
                Try the assistant on this site
              </h2>
              <p className="text-slate-600 max-w-2xl">
                Click the chat bubble in the bottom corner — it collects details and helps
                visitors take the next step.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/ai-tools"
                className="inline-flex items-center justify-center rounded-xl bg-[var(--gold)] px-7 py-3 font-semibold text-[var(--navy)] hover:opacity-90"
              >
                See AI Tools →
              </Link>
              <Link
                href="/contact?service=AI%20Setup&preferred=email"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-7 py-3 font-semibold text-slate-900 hover:bg-slate-100"
              >
                Ask About AI →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* EXAMPLES PREVIEW */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-3xl bg-white border border-slate-200 p-8 md:p-10 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h2 className="text-3xl font-black text-slate-900">
                Want to see the style?
              </h2>
              <p className="mt-2 text-slate-600 max-w-2xl">
                Check out flyer examples and sample site concepts so you can
                picture what we can build for your business.
              </p>
            </div>
            <Link
              href="/examples"
              className="inline-flex rounded-xl bg-[var(--navy)] px-7 py-3 font-semibold text-white hover:opacity-90"
            >
              View Examples →
            </Link>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 md:p-10 shadow-sm">
          <div className="text-center">
            <h2 className="text-3xl font-black text-slate-900">How it works</h2>
            <p className="mt-2 text-slate-600 max-w-2xl mx-auto">
              Simple process, clear communication, no surprises.
            </p>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {[
              { step: "Step 1: Contact", text: "Tell me what you need and your goal." },
              { step: "Step 2: Quote + Plan", text: "I confirm scope, timeline, and the best option." },
              { step: "Step 3: Pay Deposit", text: "Secure your spot and we begin." },
              { step: "Step 4: Build + Review", text: "I build it, you review, and we polish it." },
              { step: "Step 5: Launch + Support", text: "We publish and I’m here for updates if needed." },
            ].map((s) => (
              <div
                key={s.step}
                className={`rounded-2xl border border-slate-200 bg-slate-50 p-6 ${
                  s.step.includes("Step 5") ? "md:col-span-2" : ""
                }`}
              >
                <p className="text-sm font-semibold text-[var(--navy)]">{s.step}</p>
                <p className="mt-2 text-slate-700">{s.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-center">
            <Link
              href="/contact"
              className="inline-flex rounded-xl bg-[var(--navy)] px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
            >
              Start Your Project →
            </Link>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="rounded-3xl bg-[var(--navy)] text-white p-10 md:p-12 text-center shadow-sm">
          <h2 className="text-3xl md:text-4xl font-black">
            Ready to upgrade your business?
          </h2>
          <p className="mt-3 text-white/80 max-w-2xl mx-auto">
            Message me and I’ll help you pick the best service and pricing for what you’re trying to accomplish.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/contact"
              className="rounded-xl bg-[var(--gold)] px-8 py-3 font-semibold text-[var(--navy)] hover:opacity-90"
            >
              Contact Me →
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