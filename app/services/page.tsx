import Link from "next/link";

export const metadata = {
  title: "Services",
};

const PAY = {
  flyer_paid_full: "https://buy.stripe.com/dRmaEQ2im02kgw9eFZ24001",
  social_paid_full: "https://buy.stripe.com/5kQ7sE6yC8yQ6Vz9lF24002",
  updates_paid_full: "https://buy.stripe.com/4gM14g9KOcP6a7L8hB24000",

  ai_deposit_basic: "https://buy.stripe.com/28E14g6yC2asgw9btN24003",
  ai_deposit_pro: "https://buy.stripe.com/fZu8wIaOS3ew3Jn69t24007",

  admin_deposit: "https://buy.stripe.com/aFa8wIcX04iA6Vz69t24004",
  simple_site_deposit: "https://buy.stripe.com/14AbIUaOSdTa3Jn8hB24005",
  business_site_deposit: "https://buy.stripe.com/dRmfZa3mq7uM93H9lF24006",
};

export default function ServicesPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-5xl px-6 py-16 space-y-10">
        {/* Header */}
        <header className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-500">SERVICES</p>
              <h1 className="text-4xl font-black">What I can help with</h1>
              <p className="text-slate-600 text-lg max-w-3xl">
                Choose one service or mix and match. I’ll confirm scope + timeline
                before we start — and I’ll always recommend the simplest option
                that gets results.
              </p>

              <div className="flex flex-wrap gap-2 pt-1 text-sm text-slate-600">
                <Pill>✅ Clean + modern</Pill>
                <Pill>✅ Mobile-first</Pill>
                <Pill>✅ Clear communication</Pill>
                <Pill>✅ No tech overwhelm</Pill>
              </div>
            </div>

            {/* Top CTA */}
            <Link
              href="/contact"
              className="inline-flex h-fit rounded-xl bg-[var(--navy)] px-6 py-3 font-semibold text-white hover:opacity-90"
            >
              Get a recommendation →
            </Link>
          </div>
        </header>

        {/* Service Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Websites */}
          <ServiceCard
            eyebrow="WEBSITES"
            title="Website Creation"
            subtitle="A clean, fast website that makes your business look legit and turns visitors into calls, texts, and bookings."
            bestFor="Best if you want a modern online presence that actually converts."
            bullets={[
              "Built for phones first (where most customers will see you).",
              "Clear calls-to-action (call, text, book, quote).",
              "Key pages included (Home, Services, Contact + Thank You).",
              "Easy to update later as you grow.",
            ]}
            outcome="You get a professional site that helps customers trust you and take action."
            actions={[
              {
                variant: "primary",
                label: "Request a website quote →",
                href: "/contact?service=website&preferred=email",
                internal: true,
              },
              {
                variant: "soft",
                label: "Pay deposit (Simple Website) — $60",
                href: PAY.simple_site_deposit,
              },
              {
                variant: "soft",
                label: "Pay deposit (Business Website) — $120",
                href: PAY.business_site_deposit,
              },
            ]}
            badge="Most popular for businesses"
          />

          {/* AI */}
          <ServiceCard
            eyebrow="AI + AUTOMATIONS"
            title="AI Business Solutions"
            subtitle="Practical AI tools that help you respond faster, capture better leads, and save time every week."
            bestFor="Best if you’re missing leads, replying slowly, or repeating the same messages all day."
            bullets={[
              "Customer reply templates (quotes, FAQs, scheduling, follow-ups).",
              "Simple intake questions so you collect the right info every time.",
              "Reusable prompts + weekly workflows (no techy nonsense).",
              "Optional: chatbot + lead capture flow for your website.",
            ]}
            outcome="You work faster, stay consistent, and turn more messages into paying customers."
            actions={[
              {
                variant: "primary",
                label: "Learn about AI tools →",
                href: "/ai-tools",
                internal: true,
              },
              {
                variant: "soft",
                label: "Pay deposit (AI Setup — Basic) — $25",
                href: PAY.ai_deposit_basic,
              },
              {
                variant: "soft",
                label: "Pay deposit (AI Setup — Pro) — $75",
                href: PAY.ai_deposit_pro,
              },
              {
                variant: "link",
                label: "Ask a quick AI question →",
                href: "/contact?service=ai&preferred=email",
                internal: true,
              },
            ]}
            badge="Best for saving time"
          />

          {/* Updates */}
          <ServiceCard
            eyebrow="MAINTENANCE"
            title="Website Updates & Maintenance"
            subtitle="Keep your site updated without stressing about it."
            bestFor="Best if you want someone to handle edits, fixes, and updates as you grow."
            bullets={[
              "Text + image updates (hours, pricing, new services, promos).",
              "Fix broken links, spacing, layout issues, small bugs.",
              "Basic cleanup so your site stays fast and reliable.",
              "Optional monthly maintenance available.",
            ]}
            outcome="You stay current and credible — customers trust businesses that look active."
            actions={[
              {
                variant: "primary",
                label: "Request an update →",
                href: "/contact?service=maintenance&preferred=email",
                internal: true,
              },
              {
                variant: "soft",
                label: "Pay in full — $79",
                href: PAY.updates_paid_full,
              },
            ]}
          />

          {/* Flyers + Social */}
          <ServiceCard
            eyebrow="DESIGN"
            title="Flyers + Social Media Content"
            subtitle="Clean promos that are easy to read and ready to post."
            bestFor="Best if you need promotions, specials, events, menus, or weekly content."
            bullets={[
              "Flyers + social posts sized correctly for Facebook/Instagram.",
              "Simple, clean hierarchy (people understand it fast).",
              "Consistent style that looks professional (not homemade).",
              "Fast turnaround available.",
            ]}
            outcome="You promote offers with confidence — and your brand looks legit."
            actions={[
              {
                variant: "primary",
                label: "Request a design →",
                href: "/contact?service=flyers&preferred=email",
                internal: true,
              },
              {
                variant: "soft",
                label: "Pay in full (Flyer) — $20",
                href: PAY.flyer_paid_full,
              },
              {
                variant: "soft",
                label: "Pay in full (Social Pack) — $35",
                href: PAY.social_paid_full,
              },
            ]}
          />

          {/* Admin */}
          <ServiceCard
            eyebrow="ADMIN"
            title="Admin & Virtual Assistance"
            subtitle="Get time back and stay organized."
            bestFor="Best if you’re overwhelmed with messages, scheduling, or keeping up with tasks."
            bullets={[
              "Scheduling, organizing, spreadsheets, simple systems.",
              "Inbox drafts + response templates so you reply faster.",
              "Planning help for weekly tasks, promos, and workflows.",
              "Hourly support with a simple deposit to start.",
            ]}
            outcome="You stop juggling everything and run your business with less chaos."
            actions={[
              {
                variant: "primary",
                label: "Ask about admin help →",
                href: "/contact?service=admin&preferred=email",
                internal: true,
              },
              {
                variant: "soft",
                label: "Pay deposit — $50 (hourly billed after)",
                href: PAY.admin_deposit,
              },
            ]}
          />

          {/* First Project Special */}
          <ServiceCard
            eyebrow="NEW CLIENTS"
            title="First Project Special"
            subtitle="A low-risk quick win to get started."
            bestFor="Best if you want to test working together before committing to anything big."
            bullets={[
              "One small project delivered fast (flyer, post pack, refresh, etc.).",
              "Clear deliverables and quick turnaround.",
              "Perfect way to get momentum and see real results.",
            ]}
            outcome="You get a visible improvement quickly — then decide what to do next."
            actions={[
              {
                variant: "primary",
                label: "Ask about the First Project Special →",
                href: "/contact?service=not_sure&preferred=email",
                internal: true,
              },
            ]}
          />
        </div>

        {/* CTA */}
        <section className="rounded-3xl bg-[var(--navy)] text-white p-10 md:p-12">
          <h2 className="text-3xl font-black">Not sure what you need?</h2>
          <p className="mt-3 text-white/80 max-w-3xl">
            Send a quick message with your business type + goal. I’ll recommend
            the simplest plan to get you more calls, bookings, or leads.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="/contact"
              className="inline-flex items-center justify-center rounded-xl bg-[var(--gold)] px-6 py-3 font-semibold text-[var(--navy)] hover:opacity-90"
            >
              Contact Me →
            </a>

            <a
              href="/pricing"
              className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-6 py-3 font-semibold text-white hover:bg-white/10"
            >
              View pricing →
            </a>

            <a
              href="/payments"
              className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-6 py-3 font-semibold text-white hover:bg-white/10"
            >
              View all payments →
            </a>
          </div>
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

function ServiceCard({
  eyebrow,
  title,
  subtitle,
  bestFor,
  bullets,
  outcome,
  actions,
  badge,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  bestFor: string;
  bullets: string[];
  outcome: string;
  actions?: {
    label: string;
    href: string;
    internal?: boolean;
    variant?: "primary" | "soft" | "link";
  }[];
  badge?: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm hover:shadow-md transition">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-500">{eyebrow}</p>
        {badge ? (
          <span className="rounded-full bg-[var(--gold)] px-3 py-1 text-xs font-black text-[var(--navy)]">
            {badge}
          </span>
        ) : null}
      </div>

      <h3 className="mt-2 text-xl font-black text-slate-900">{title}</h3>
      <p className="mt-2 text-slate-600">{subtitle}</p>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-900">Good fit if:</p>
        <p className="mt-1 text-sm text-slate-600">{bestFor}</p>
      </div>

      <ul className="mt-5 space-y-2 text-sm text-slate-700">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span className="mt-[6px] h-2 w-2 rounded-full bg-[var(--gold)] flex-shrink-0" />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <p className="mt-5 text-sm font-semibold text-slate-900">
        Outcome: <span className="font-normal text-slate-600">{outcome}</span>
      </p>

      {/* Actions */}
      {actions && actions.length > 0 ? (
        <div className="mt-6 flex flex-col gap-2">
          {actions.map((a) => {
            const isInternal = !!a.internal;

            const base =
              "inline-flex items-center justify-between rounded-xl px-4 py-2 text-sm font-semibold";
            const styles =
              a.variant === "primary"
                ? "bg-[var(--navy)] text-white hover:opacity-90"
                : a.variant === "link"
                ? "text-[var(--navy)] hover:underline bg-transparent px-1"
                : "border border-slate-200 bg-slate-50 text-[var(--navy)] hover:bg-slate-100";

            const className = `${base} ${styles}`;

            return isInternal ? (
              <Link key={a.label} href={a.href} className={className}>
                <span>{a.label}</span>
                <span aria-hidden className={a.variant === "primary" ? "text-white/80" : "text-slate-500"}>
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
                <span aria-hidden className={a.variant === "primary" ? "text-white/80" : "text-slate-500"}>
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