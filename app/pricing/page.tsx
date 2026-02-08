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
                Simple <span className="font-semibold">starting prices</span>{" "}
                for common projects. I’ll confirm your exact quote before we
                begin.
              </p>
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
                Clean, mobile-friendly websites designed to help you look
                professional and get more customers.
              </p>
            </div>

            {/* ✅ Section CTA */}
            <Link
              href="/contact"
              className="inline-flex rounded-xl bg-[var(--gold)] px-6 py-3 font-semibold text-[var(--navy)] hover:opacity-90"
            >
              Website Quote →
            </Link>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-3">
            <PriceCard
              title="Starter Website"
              price="$129+"
              desc="Perfect for a simple online presence."
              items={[
                "One-page modern site",
                "Call-to-action buttons",
                "Contact section or form",
              ]}
            />

            <PriceCard
              title="Business Website"
              price="$249+"
              desc="Best for most small businesses."
              items={[
                "3–5 pages (Home, Services, Contact)",
                "Mobile-friendly layout",
                "Lead form + thank-you page",
              ]}
              featured
            />

            <PriceCard
              title="Website Refresh"
              price="$79+"
              desc="Update or clean up an existing site."
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
              Includes updates, edits, small fixes, and keeping your site
              current.
            </p>
          </div>
        </div>

        {/* Flyers + Social */}
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">Design + Social Media</h2>
              <p className="mt-2 text-slate-600">
                Simple, clean promo designs that are ready to post.
              </p>
            </div>

            {/* ✅ Section CTA */}
            <Link
              href="/contact"
              className="inline-flex rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-900 hover:bg-slate-100"
            >
              Request Designs →
            </Link>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-3">
            <PriceCard
              title="Single Flyer / Promo"
              price="$20+"
              desc="One clean design."
              items={[
                "Flyer or social graphic",
                "1 revision included",
                "Export ready to post",
              ]}
            />

            <PriceCard
              title="Flyer Pack (3)"
              price="$49+"
              desc="Good for specials or events."
              items={["3 promo designs", "Consistent style", "Fast delivery"]}
              featured
            />

            <PriceCard
              title="Social Media Pack"
              price="$20+"
              desc="Simple weekly posting."
              items={["5 basic posts", "Correct sizing", "Quick + affordable"]}
            />
          </div>

          <div className="mt-5 text-sm text-slate-600">
            Larger pack available:{" "}
            <span className="font-semibold">10 posts starts at $35+</span>.
          </div>
        </div>

        {/* Admin + AI */}
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">Admin + AI Support</h2>
              <p className="mt-2 text-slate-600">
                Practical systems and help that save time every week.
              </p>
            </div>

            {/* ✅ Section CTA */}
            <Link
              href="/contact"
              className="inline-flex rounded-xl bg-[var(--navy)] px-6 py-3 font-semibold text-white hover:opacity-90"
            >
              Ask About Support →
            </Link>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <PriceCard
              title="Admin Support"
              price="$20/hr"
              desc="Virtual assistance & organization."
              items={[
                "Scheduling + spreadsheets",
                "Inbox templates + drafts",
                "Planning help",
              ]}
            />

            {/* ✅ AI (split into Simple vs Advanced) */}
            <PriceCard
              title="AI Starter Setup (Simple)"
              price="$39+"
              desc="Reusable templates that save time immediately."
              items={[
                "Customer reply templates (quotes/FAQs/scheduling)",
                "1 intake form/checklist setup",
                "Reusable prompts you can use weekly",
              ]}
              featured
            />

            <PriceCard
              title="AI Pro Automation (Advanced)"
              price="$149+"
              desc="Custom workflows + deeper setup (quote required)."
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
                path.
              </p>
              <Link
                href="/contact"
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
            Want to start small? My First Project Special is customized depending
            on what you need — flyer, website help, posting, or admin support.
          </p>

          <p className="mt-4 font-semibold text-slate-900">
            Pricing is discussed after a quick message so it fits the exact
            project.
          </p>

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
            Message me what you need and I’ll respond with a clear price and
            timeline.
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

function PriceCard({
  title,
  price,
  desc,
  items,
  featured,
}: {
  title: string;
  price: string;
  desc: string;
  items: string[];
  featured?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border p-8 shadow-sm transition ${
        featured
          ? "border-[var(--gold)] bg-white shadow-md"
          : "border-slate-200 bg-white"
      }`}
    >
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