import Link from "next/link";

export const metadata = {
  title: "Portfolio",
};

const websiteConcepts = [
  {
    title: "Local Restaurant",
    desc: "Menu + hours + online ordering / reservations layout concept.",
    href: "/contact?service=website&preferred=email",
  },
  {
    title: "Home Services",
    desc: "Lead-generating homepage with clear services + quote request CTA.",
    href: "/contact?service=website&preferred=email",
  },
  {
    title: "Fitness Coach",
    desc: "Bold hero, program highlights, and simple booking flow concept.",
    href: "/contact?service=website&preferred=email",
  },
];

const aiTemplates = [
  {
    title: "Review Reply Templates",
    desc: "Polished responses for Google reviews — positive, neutral, or negative.",
  },
  {
    title: "Social Post Captions",
    desc: "Ready-to-use captions with hooks, CTAs, and hashtag sets by industry.",
  },
  {
    title: "Customer Follow-up Messages",
    desc: "Text/email templates to convert leads and bring customers back.",
  },
];

export default function ExamplesPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-6xl px-6 py-16 space-y-12">
        {/* Header */}
        <header className="text-center space-y-3">
          <p className="text-sm font-semibold text-slate-500">PORTFOLIO</p>
          <h1 className="text-4xl md:text-5xl font-black">Real examples</h1>
          <p className="text-slate-600 text-lg max-w-3xl mx-auto">
            Not generic “template” work — this is the type of clean, modern setup I build to help
            businesses get more calls, bookings, and leads.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-xl bg-[var(--navy)] px-7 py-3 font-semibold text-white hover:opacity-90"
            >
              Start a project →
            </Link>
            <Link
              href="/services"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-7 py-3 font-semibold text-slate-900 hover:bg-slate-100"
            >
              View services
            </Link>
          </div>
        </header>

        {/* FEATURED / CASE STUDY STYLE */}
        <section className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div>
              <h2 className="text-3xl font-black">Featured examples</h2>
              <p className="text-slate-600 mt-1">
                These are the highest-impact setups — the kind that makes people feel like your
                business is instantly “legit.”
              </p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* AI Chatbot Example */}
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <p className="text-sm font-semibold text-slate-500">AI SYSTEM</p>
              <h3 className="mt-2 text-2xl font-black">Website chatbot + lead capture</h3>
              <p className="mt-2 text-slate-600">
                A simple site assistant that answers questions, routes people to the right service,
                and captures lead details so you can follow up fast.
              </p>

              <div className="mt-5 grid gap-3">
                {[
                  "Guides visitors to the right service",
                  "Captures phone/email + project details",
                  "Routes people into your contact form",
                  "Works 24/7 (even when you’re busy)",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3"
                  >
                    <p className="font-semibold text-slate-900">{item}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Link
                  href="/contact?service=ai&preferred=email"
                  className="inline-flex items-center justify-center rounded-xl bg-[var(--gold)] px-6 py-3 font-semibold text-[var(--navy)] hover:opacity-90"
                >
                  Get something like this →
                </Link>
                <Link
                  href="/ai-tools"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-900 hover:bg-slate-100"
                >
                  See AI tools
                </Link>
              </div>

              <p className="mt-4 text-sm text-slate-500">
                Built as a live demo on this site — same style setup available for your business.
              </p>
            </div>

            {/* Website Example */}
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <p className="text-sm font-semibold text-slate-500">WEBSITE</p>
              <h3 className="mt-2 text-2xl font-black">Modern business website + funnel</h3>
              <p className="mt-2 text-slate-600">
                A clean, fast site that looks professional on mobile and makes it easy for customers
                to contact you.
              </p>

              <div className="mt-5 grid gap-3">
                {[
                  "Mobile-first layout (looks great on phones)",
                  "Clear CTAs that push people to contact",
                  "Simple sections (no clutter)",
                  "Easy to update later if you grow",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3"
                  >
                    <p className="font-semibold text-slate-900">{item}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Link
                  href="/contact?service=website&preferred=email"
                  className="inline-flex items-center justify-center rounded-xl bg-[var(--navy)] px-6 py-3 font-semibold text-white hover:opacity-90"
                >
                  Request a website →
                </Link>
                <Link
                  href="/services"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-900 hover:bg-slate-100"
                >
                  Website options
                </Link>
              </div>

              <p className="mt-4 text-sm text-slate-500">
                Want a similar style? Tell me your business + goal and I’ll recommend the best layout.
              </p>
            </div>
          </div>
        </section>

        {/* Flyers */}
        <section className="space-y-5">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div>
              <h2 className="text-3xl font-black">Flyer & promo designs</h2>
              <p className="text-slate-600 mt-1">
                Designed to be readable fast — clean hierarchy, strong offer, and clear “what to do next.”
              </p>
            </div>
            <Link
              href="/contact?service=flyers&preferred=email"
              className="inline-flex rounded-xl bg-[var(--navy)] px-6 py-3 font-semibold text-white hover:opacity-90"
            >
              Request a flyer →
            </Link>
          </div>

          {/* Featured Flyer Examples (single-card, non-AI “real world” style) */}
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                title: "Barbershop Special Promo",
                industry: "Barber / Grooming",
                goal: "Promote a limited-time haircut + beard deal",
                details:
                  "Bold offer layout, pricing emphasis, clean service icons, strong call-to-action.",
              },
              {
                title: "Cleaning Service Flyer",
                industry: "Home Services",
                goal: "Generate leads for weekly/monthly cleanings",
                details:
                  "Trust-focused design, checklist-style benefits, clear phone + booking CTA.",
              },
              {
                title: "Restaurant Weekend Special",
                industry: "Restaurant",
                goal: "Drive more traffic for a weekend promotion",
                details:
                  "Menu highlight layout, clean photo section, hours/location focus, easy-to-read pricing.",
              },
              {
                title: "Fitness Trainer Promo",
                industry: "Fitness / Coaching",
                goal: "Sell a 4-week training program",
                details:
                  "High-energy hero, transformation messaging, simple pricing block, booking CTA.",
              },
              {
                title: "Real Estate Listing Sheet",
                industry: "Real Estate",
                goal: "Present a clean property overview",
                details:
                  "Modern layout, key feature grid, QR/contact section, luxury-style spacing.",
              },
              {
                title: "Auto Detail Package Flyer",
                industry: "Automotive",
                goal: "Promote detailing packages and upsells",
                details:
                  "Package tier layout, clear service list, before/after style design, strong offer CTA.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm"
              >
                <p className="text-sm font-semibold text-slate-500">FLYER EXAMPLE</p>
                <h3 className="mt-2 text-xl font-black text-slate-900">{f.title}</h3>

                <p className="mt-2 text-sm font-semibold text-[var(--navy)]">{f.industry}</p>

                <p className="mt-3 text-slate-600">
                  <span className="font-semibold text-slate-900">Goal:</span> {f.goal}
                </p>

                <p className="mt-2 text-slate-600">
                  <span className="font-semibold text-slate-900">Design focus:</span> {f.details}
                </p>

                <Link
                  href="/contact?service=flyers&preferred=email"
                  className="mt-5 inline-block font-semibold text-[var(--navy)] hover:underline"
                >
                  Request something like this →
                </Link>
              </div>
            ))}
          </div>

          <p className="text-sm text-slate-500">
            Want a specific style? Send a reference and I’ll match the vibe.
          </p>
        </section>

        {/* Website Concepts */}
        <section className="space-y-5">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div>
              <h2 className="text-3xl font-black">Website concepts</h2>
              <p className="text-slate-600 mt-1">
                Clean, modern layouts built for clarity, speed, and conversions.
              </p>
            </div>
            <Link
              href="/services"
              className="inline-flex rounded-xl bg-[var(--gold)] px-6 py-3 font-semibold text-[var(--navy)] hover:opacity-90"
            >
              View website services →
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {websiteConcepts.map((w) => (
              <div
                key={w.title}
                className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm"
              >
                <p className="text-sm font-semibold text-slate-500">CONCEPT</p>
                <h3 className="mt-2 text-xl font-black">{w.title}</h3>
                <p className="mt-2 text-slate-600">{w.desc}</p>
                <Link
                  href={w.href}
                  className="mt-5 inline-block font-semibold text-[var(--navy)] hover:underline"
                >
                  Ask about this style →
                </Link>
              </div>
            ))}
          </div>

          <div className="rounded-3xl bg-white border border-slate-200 p-8">
            <h3 className="text-xl font-black">Want your own layout recommendation?</h3>
            <p className="mt-2 text-slate-600">
              Tell me your business type and what you want your site to do (calls, bookings, quotes,
              etc.) and I’ll recommend the simplest high-converting layout.
            </p>
            <Link
              href="/contact?service=website&preferred=email"
              className="mt-5 inline-flex rounded-xl bg-[var(--navy)] px-6 py-3 font-semibold text-white hover:opacity-90"
            >
              Get a website recommendation →
            </Link>
          </div>
        </section>

        {/* AI Templates */}
        <section className="space-y-5">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-black">AI templates & systems</h2>
            <p className="text-slate-600 max-w-3xl mx-auto">
              Plug-and-play templates + simple automations that save time and keep your communication consistent.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {aiTemplates.map((t) => (
              <div
                key={t.title}
                className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm"
              >
                <p className="text-sm font-semibold text-slate-500">TEMPLATE</p>
                <h3 className="mt-2 text-xl font-black">{t.title}</h3>
                <p className="mt-2 text-slate-600">{t.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link
              href="/contact?service=ai&preferred=email"
              className="inline-flex rounded-xl bg-[var(--gold)] px-7 py-3 font-semibold text-[var(--navy)] hover:opacity-90"
            >
              Ask about templates →
            </Link>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="pt-2">
          <div className="rounded-3xl bg-[var(--navy)] text-white p-10 md:p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-black">Want a setup like this?</h2>
            <p className="mt-3 text-white/80 max-w-2xl mx-auto">
              Tell me what business you run and what you want more of — calls, bookings, orders, or leads.
              I’ll recommend the simplest plan that gets results.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row justify-center gap-4">
              <Link
                href="/contact"
                className="rounded-xl bg-[var(--gold)] px-8 py-3 font-semibold text-[var(--navy)] hover:opacity-90"
              >
                Start now →
              </Link>
              <Link
                href="/pricing"
                className="rounded-xl border border-white/30 bg-transparent px-8 py-3 font-semibold hover:bg-white/10"
              >
                View pricing
              </Link>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}