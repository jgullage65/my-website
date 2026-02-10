import Link from "next/link";

export const metadata = {
  title: "Pricing",
};

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-5xl px-6 py-16 space-y-10">
        {/* Header */}
        <header className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="space-y-3">
              <h1 className="text-4xl font-black">Pricing</h1>
              <p className="text-slate-600 text-lg max-w-3xl">
                Clear <span className="font-semibold">starting prices</span> for
                common projects — with a simple process and no confusion. I’ll
                confirm your exact quote before we begin.
              </p>

              <div className="flex flex-wrap gap-2 pt-1 text-sm text-slate-600">
                <Pill>✅ No long-term contracts</Pill>
                <Pill>✅ Pay only for what you need</Pill>
                <Pill>✅ I’ll recommend the simplest option</Pill>
              </div>
            </div>

            {/* ✅ Top CTA */}
            <Link
              href="/contact"
              className="inline-flex h-fit rounded-xl bg-[var(--navy)] px-6 py-3 font-semibold text-white hover:opacity-90"
            >
              Get a Quote →
            </Link>
          </div>
        </header>

        {/* Websites */}
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">Websites</h2>
              <p className="mt-2 text-slate-600">
                Clean, mobile-friendly websites that make your business look
                legit and turn visitors into calls, texts, and bookings.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                💡 Most people choose the <span className="font-semibold">Business Website</span>{" "}
                because it covers everything a real business needs.
              </p>
            </div>

            {/* ✅ Section CTA */}
            <Link
              href="/contact?service=website&preferred=email"
              className="inline-flex rounded-xl bg-[var(--gold)] px-6 py-3 font-semibold text-[var(--navy)] hover:opacity-90"
            >
              Website Quote →
            </Link>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-3">
            <PriceCard
              title="Starter Website"
              price="$129+"
              desc="Best if you need a clean online presence fast."
              items={[
                "One-page modern site",
                "Call-to-action buttons",
                "Contact section or form",
              ]}
            />

            <PriceCard
              title="Business Website"
              price="$249+"
              desc="Best for most businesses — built to convert."
              items={[
                "3–5 pages (Home, Services, Contact)",
                "Mobile-first layout",
                "Lead form + thank-you page",
              ]}
              featured
              badge="Most Popular"
            />

            <PriceCard
              title="Website Refresh"
              price="$79+"
              desc="Best if your site exists but needs cleanup."
              items={[
                "Text + image updates",
                "Layout improvements",
                "Basic fixes (links, spacing)",
              ]}
            />
          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 p-5 border border-slate-200">
            <p className="font-semibold text-slate-900">
              Monthly Maintenance:{" "}
              <span className="text-[var(--navy)]">$79/month</span>
            </p>
            <p className="text-slate-600 text-sm mt-1">
              Great if you want someone to handle updates, small fixes, and
              keeping your site current — without hiring anyone.
            </p>
            <p className="text-xs text-slate-500 mt-2">
              🔒 No long-term commitment — cancel anytime.
            </p>
          </div>
        </div>

        {/* Flyers + Social */}
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">Design + Social Media</h2>
              <p className="mt-2 text-slate-600">
                Clean promo designs and simple social content that looks
                professional and is ready to post.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                🎯 Best if you want quick promos, specials, events, or weekly
                content without spending hours in Canva.
              </p>
            </div>

            {/* ✅ Section CTA */}
            <Link
              href="/contact?service=flyers&preferred=email"
              className="inline-flex rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-900 hover:bg-slate-100"
            >
              Request Designs →
            </Link>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-3">
            <PriceCard
              title="Single Flyer / Promo"
              price="$20+"
              desc="Best for one quick promo."
              items={[
                "Flyer or social graphic",
                "1 revision included",
                "Export ready to post",
              ]}
            />

            <PriceCard
              title="Flyer Pack (3)"
              price="$49+"
              desc="Best for events or rotating specials."
              items={["3 promo designs", "Consistent style", "Fast delivery"]}
              featured
              badge="Best Value"
            />

            <PriceCard
              title="Social Media Pack"
              price="$20+"
              desc="Best for keeping your page active."
              items={["5 basic posts", "Correct sizing", "Quick + affordable"]}
            />
          </div>

          <div className="mt-5 text-sm text-slate-600">
            Larger pack available:{" "}
            <span className="font-semibold">10 posts starts at $35+</span>.
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 p-5 border border-slate-200 text-sm text-slate-600">
            ✅ You can send rough ideas — I’ll clean them up and make them look
            professional.
          </div>
        </div>

        {/* Admin + AI */}
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">Admin + AI Support</h2>
              <p className="mt-2 text-slate-600">
                Practical support and simple systems that save time every week.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                🤖 AI isn’t about “fancy tech” — it’s about faster replies,
                better follow-up, and fewer missed leads.
              </p>
            </div>

            {/* ✅ Section CTA */}
            <Link
              href="/contact?service=ai&preferred=email"
              className="inline-flex rounded-xl bg-[var(--navy)] px-6 py-3 font-semibold text-white hover:opacity-90"
            >
              Ask About Support →
            </Link>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <PriceCard
              title="Admin Support"
              price="$20/hr"
              desc="Best if you want help staying organized."
              items={[
                "Scheduling + spreadsheets",
                "Inbox templates + drafts",
                "Planning help",
              ]}
            />

            <PriceCard
              title="AI Starter Setup (Simple)"
              price="$39+"
              desc="Best for time-saving templates you can use weekly."
              items={[
                "Customer reply templates (quotes/FAQs/scheduling)",
                "1 intake form/checklist setup",
                "Reusable prompts you can keep using",
              ]}
              featured
              badge="Quick Win"
            />

            <PriceCard
              title="AI Pro Automation (Advanced)"
              price="$149+"
              desc="Best if you want a full workflow (quote required)."
              items={[
                "Multi-step workflow (lead → intake → follow-up)",
                "Custom templates per service",
                "Setup + testing + revisions",
              ]}
            />

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8">
              <p className="text-sm font-semibold text-slate-600">
                Not sure which AI option fits?
              </p>
              <p className="mt-2 text-slate-700">
                Tell me your business type + what you want AI to handle (quotes,
                scheduling, FAQs, follow-ups), and I’ll recommend the simplest
                option first.
              </p>
              <p className="mt-2 text-sm text-slate-600">
                ✅ No pressure. No upsell. Just the best fit.
              </p>
              <Link
                href="/contact?service=ai&preferred=email"
                className="mt-5 inline-flex rounded-xl bg-[var(--navy)] px-6 py-3 font-semibold text-white hover:opacity-90"
              >
                Ask About AI →
              </Link>
            </div>
          </div>
        </div>

        {/* First Project Special */}
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-black">First Project Special</h2>
          <p className="mt-2 text-slate-600">
            Want to start small? My First Project Special is customized based
            on what you need — flyer, website help, posting, admin support, or
            AI setup.
          </p>

          <p className="mt-4 font-semibold text-slate-900">
            Pricing is discussed after a quick message so it fits the exact
            project.
          </p>

          <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-200 p-5 text-sm text-slate-600">
            ✅ Best for new clients who want to try one small project first.
          </div>

          {/* ✅ CTA */}
          <Link
            href="/contact"
            className="mt-6 inline-flex rounded-xl bg-[var(--gold)] px-7 py-3 font-semibold text-[var(--navy)] hover:opacity-90"
          >
            Ask About the Special →
          </Link>
        </div>

        {/* CTA */}
        <section className="rounded-3xl bg-[var(--navy)] text-white p-10 text-center">
          <h3 className="text-3xl font-black">Want an exact quote?</h3>
          <p className="mt-3 text-white/80 max-w-2xl mx-auto">
            Message me what you need and I’ll respond with a clear price range
            and timeline.
          </p>

          <a
            href="/contact"
            className="mt-6 inline-block rounded-xl bg-[var(--gold)] px-8 py-3 font-semibold text-[var(--navy)] hover:opacity-90"
          >
            Contact Me →
          </a>
        </section>
      </section>
    </main>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
      {children}
    </span>
  );
}

function PriceCard({
  title,
  price,
  desc,
  items,
  featured,
  badge,
}: {
  title: string;
  price: string;
  desc: string;
  items: string[];
  featured?: boolean;
  badge?: string;
}) {
  return (
    <div
      className={`relative rounded-3xl border p-8 shadow-sm transition ${
        featured
          ? "border-[var(--gold)] bg-white shadow-md"
          : "border-slate-200 bg-white"
      }`}
    >
      {badge ? (
        <div className="absolute -top-3 left-6 rounded-full bg-[var(--gold)] px-3 py-1 text-xs font-black text-[var(--navy)] shadow-sm">
          {badge}
        </div>
      ) : null}

      <h3 className="text-xl font-black">{title}</h3>
      <p className="mt-2 text-4xl font-black">{price}</p>
      <p className="mt-3 text-slate-600 text-sm">{desc}</p>

      <ul className="mt-6 space-y-2 text-sm text-slate-700">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-[6px] h-2 w-2 rounded-full bg-[var(--gold)]" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}