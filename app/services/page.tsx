import Link from "next/link";

export const metadata = {
  title: "Services",
};

const PAY = {
  flyer_paid_full: "https://buy.stripe.com/dRmaEQ2im02kgw9eFZ24001",
  social_paid_full: "https://buy.stripe.com/5kQ7sE6yC8yQ6Vz9lF24002",
  updates_paid_full: "https://buy.stripe.com/4gM14g9KOcP6a7L8hB24000",
  ai_deposit: "https://buy.stripe.com/28E14g6yC2asgw9btN24003",
  admin_deposit: "https://buy.stripe.com/aFa8wIcX04iA6Vz69t24004",
  simple_site_deposit: "https://buy.stripe.com/14AbIUaOSdTa3Jn8hB24005",
  business_site_deposit: "https://buy.stripe.com/dRmfZa3mq7uM93H9lF24006",
};

export default function ServicesPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-[var(--navy)]">
      <section className="mx-auto max-w-5xl px-6 py-16 space-y-10">
        {/* Header */}
        <header className="space-y-3">
          <h1 className="text-4xl font-black">Services</h1>
          <p className="text-slate-600 text-lg max-w-3xl">
            Pick what you need and I’ll confirm scope + timeline before we start.
            Everything is built to be clean, modern, and easy for your customers to understand.
          </p>
        </header>

        {/* Service Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Websites */}
          <ServiceCard
            title="Website Creation (Modern & Mobile-Friendly)"
            subtitle="A clean website that helps customers trust you and take action."
            bullets={[
              "Built for phones first (most customers visit on mobile).",
              "Fast, modern layout with clear calls-to-action (call, text, book, quote).",
              "Includes key pages like Home, Services, Contact, and a Thank You page.",
            ]}
            outcomes="You get a professional online home that helps turn visitors into leads."
            actions={[
              {
                label: "Pay deposit (Simple Website) — $60",
                href: PAY.simple_site_deposit,
              },
              {
                label: "Pay deposit (Business Website) — $120",
                href: PAY.business_site_deposit,
              },
            ]}
          />

          {/* ✅ AI moved up + retooled */}
          <ServiceCard
            title="AI Business Solutions (Templates + Automation)"
            subtitle="Practical AI tools that save time and help you respond faster."
            bullets={[
              "Customer reply templates for quotes, FAQs, scheduling, and follow-ups.",
              "Simple intake forms + checklists so you collect the right info every time.",
              "Reusable prompts and workflows you can run weekly (no techy nonsense).",
            ]}
            outcomes="You work faster, stay consistent, and turn more messages into paying customers."
            actions={[
              {
                label: "Pay deposit — $25",
                href: PAY.ai_deposit,
              },
              {
                label: "Learn more about AI options",
                href: "/ai-tools",
                internal: true,
              },
            ]}
          />

          {/* Updates */}
          <ServiceCard
            title="Website Maintenance & Updates"
            subtitle="Keep your site updated without stressing about it."
            bullets={[
              "Text/image updates (hours, pricing, new services, promotions).",
              "Fixes for broken links, layout issues, and small bugs.",
              "Basic cleanup so your site stays fast and reliable.",
            ]}
            outcomes="You stay current and credible—customers trust businesses that look active."
            actions={[
              {
                label: "Pay in full — $79",
                href: PAY.updates_paid_full,
              },
            ]}
          />

          {/* Flyers + Social */}
          <ServiceCard
            title="Flyers + Social Media Content"
            subtitle="Clean promos that are easy to read and ready to post."
            bullets={[
              "Flyers and social posts designed for Facebook/Instagram.",
              "Correct sizes so they don’t look stretched or blurry.",
              "Simple and consistent style that looks professional.",
            ]}
            outcomes="You promote offers with confidence—without it looking homemade."
            actions={[
              {
                label: "Pay in full (Flyer) — $20",
                href: PAY.flyer_paid_full,
              },
              {
                label: "Pay in full (Social Pack) — $35",
                href: PAY.social_paid_full,
              },
            ]}
          />

          {/* Admin */}
          <ServiceCard
            title="Admin & Virtual Assistance"
            subtitle="Get time back and stay organized."
            bullets={[
              "Scheduling, organizing, spreadsheets, and simple systems.",
              "Inbox drafts / message templates so you respond faster.",
              "Planning help for weekly tasks, promos, and simple workflows.",
            ]}
            outcomes="You stop juggling everything and run your business with less chaos."
            actions={[
              {
                label: "Pay deposit — $50 (hourly billed after)",
                href: PAY.admin_deposit,
              },
            ]}
          />

          {/* First Project Special */}
          <ServiceCard
            title="First Project Special"
            subtitle="A low-risk quick win to get started."
            bullets={[
              "Perfect if you want to test working together.",
              "One small project delivered fast (flyer, post pack, website refresh, etc.).",
              "Clear deliverables + quick turnaround.",
            ]}
            outcomes="You get a visible improvement quickly—then decide what to do next."
            actions={[
              {
                label: "Message me to discuss your First Project Special",
                href: "/contact",
                internal: true,
              },
            ]}
          />
        </div>

        {/* CTA */}
        <section className="rounded-3xl bg-[var(--navy)] text-white p-10 md:p-12">
          <h2 className="text-3xl font-black">Not sure what you need?</h2>
          <p className="mt-3 text-white/80 max-w-3xl">
            Send a quick message with your business type and what you’re trying to improve.
            I’ll recommend the simplest option that gets you results.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="/contact"
              className="inline-flex items-center justify-center rounded-xl bg-[var(--gold)] px-6 py-3 font-semibold text-[var(--navy)] hover:opacity-90"
            >
              Contact Me →
            </a>

            <a
              href="/payments"
              className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-6 py-3 font-semibold text-white hover:bg-white/10"
            >
              View all payments →
            </a>

            <a
              href="/"
              className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-6 py-3 font-semibold text-white hover:bg-white/10"
            >
              ← Back to Home
            </a>
          </div>
        </section>
      </section>
    </main>
  );
}

function ServiceCard({
  title,
  subtitle,
  bullets,
  outcomes,
  actions,
}: {
  title: string;
  subtitle: string;
  bullets: string[];
  outcomes: string;
  actions?: {
    label: string;
    href: string;
    internal?: boolean;
  }[];
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm hover:shadow-md transition">
      <h3 className="text-xl font-black">{title}</h3>
      <p className="mt-2 text-slate-600">{subtitle}</p>

      <ul className="mt-5 space-y-2 text-sm text-slate-700">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span className="mt-[6px] h-2 w-2 rounded-full bg-[var(--gold)] flex-shrink-0" />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <p className="mt-5 text-sm font-semibold text-slate-800">
        Outcome: <span className="font-normal text-slate-600">{outcomes}</span>
      </p>

      {/* Minimal CTAs */}
      {actions && actions.length > 0 ? (
        <div className="mt-6 flex flex-col gap-2">
          {actions.map((a) => {
            const isInternal = !!a.internal;
            const className =
              "inline-flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-[var(--navy)] hover:bg-slate-100";

            return isInternal ? (
              <Link key={a.label} href={a.href} className={className}>
                <span>{a.label}</span>
                <span aria-hidden className="text-slate-500">
                  →
                </span>
              </Link>
            ) : (
              <a
                key={a.label}
                href={a.href}
                target="_blank"
                rel="noreferrer"
                className={className}
              >
                <span>{a.label}</span>
                <span aria-hidden className="text-slate-500">
                  →
                </span>
              </a>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}