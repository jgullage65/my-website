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
  <ServiceCard
  title="Website Creation (Modern & Mobile-Friendly)"
  subtitle="A clean website that makes your business look legit."
  bullets={[
  "Built for phones first (most customers visit on mobile).",
  "Fast, modern design with clear calls-to-action (call, text, book, quote).",
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
  
  <ServiceCard
  title="Website Maintenance & Updates"
  subtitle="Keep your site updated without stressing about it."
  bullets={[
  "Text/image updates (hours, pricing, new services, promotions).",
  "Fixes for broken links, layout issues, and small bugs.",
  "Basic performance and cleanup so it stays fast and reliable.",
  ]}
  outcomes="You stay current and credible—customers trust businesses that look active."
  actions={[
  {
  label: "Pay in full — $79",
  href: PAY.updates_paid_full,
  },
  ]}
  />
  
  <ServiceCard
  title="Flyers + Social Media Content"
  subtitle="Promos that look clean and readable."
  bullets={[
  "Flyers and social posts designed for Facebook/Instagram.",
  "Captions + quick variations (so you’re not stuck with one post).",
  "Exported in the correct sizes so they don’t look stretched/blurry.",
  ]}
  outcomes="You post with confidence and promote offers without it looking homemade."
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
  
  <ServiceCard
  title="AI Templates & Workflows"
  subtitle="Practical AI tools that actually save time."
  bullets={[
  "Reply scripts for customers (quotes, FAQs, scheduling).",
  "Intake forms / checklists so you collect the right info.",
  "Simple prompts you can reuse every week (no techy nonsense).",
  ]}
  outcomes="You work faster, respond quicker, and stay consistent with customers."
  actions={[
  {
  label: "Pay deposit — $25",
  href: PAY.ai_deposit,
  },
  ]}
  />
  
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
  {actions.map((a) => (
  <a
  key={a.label}
  href={a.href}
  target={a.internal ? undefined : "_blank"}
  rel={a.internal ? undefined : "noreferrer"}
  className="inline-flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-[var(--navy)] hover:bg-slate-100"
  >
  <span>{a.label}</span>
  <span aria-hidden className="text-slate-500">
  →
  </span>
  </a>
  ))}
  </div>
  ) : null}
  </div>
  );
  }
  