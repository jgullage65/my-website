"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { Variants } from "framer-motion";
import type { ReactNode } from "react";

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

const fadeUp: Variants = { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: { duration: 0.72, ease: [0.16, 1, 0.3, 1] } } };
const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.1, delayChildren: 0.08 } } };

type ServiceAction = { label: string; href: string; internal?: boolean; variant: "primary" | "soft" | "link" };
type ServiceGroup = { eyebrow: string; title: string; subtitle: string; bestFor: string; bullets: readonly string[]; outcome: string; badge?: string; actions: readonly ServiceAction[] };

const serviceGroups: readonly ServiceGroup[] = [
  {
    eyebrow: "Websites",
    title: "Premium Website Creation",
    subtitle: "Fast, polished, mobile-first websites that make your business look credible and turn visitors into calls, bookings, and quote requests.",
    bestFor: "Businesses that need a high-trust web presence with clear calls to action.",
    bullets: ["Homepage, service, contact, and thank-you flow planning", "Premium dark visual direction available", "Conversion-focused structure", "Built to expand as your business grows"],
    outcome: "A professional website that supports customer trust and action.",
    badge: "Most requested",
    actions: [
      { variant: "primary", label: "Request a website quote", href: "/contact?service=website&preferred=email", internal: true },
      { variant: "soft", label: "Simple Website deposit — $60", href: PAY.simple_site_deposit },
      { variant: "soft", label: "Business Website deposit — $120", href: PAY.business_site_deposit },
    ],
  },
  {
    eyebrow: "AI Systems",
    title: "AI, Automation, and Business Systems",
    subtitle: "Custom AI copilots, customer support AI, internal knowledge assistants, CRM automation, scheduling systems, dashboards, and multi-step workflows.",
    bestFor: "Teams that want to reduce manual work, respond faster, organize knowledge, or connect disconnected tools.",
    bullets: ["AI workflow and system planning", "Customer or internal assistant logic", "CRM, scheduling, and reporting automation", "Human handoff and approval paths"],
    outcome: "A practical AI system that supports the way your business operates.",
    badge: "Systems focus",
    actions: [
      { variant: "primary", label: "Explore AI Systems", href: "/ai-tools", internal: true },
      { variant: "soft", label: "AI Setup Basic deposit — $25", href: PAY.ai_deposit_basic },
      { variant: "soft", label: "AI Setup Pro deposit — $75", href: PAY.ai_deposit_pro },
      { variant: "link", label: "Ask an AI question", href: "/contact?service=ai&preferred=email", internal: true },
    ],
  },
  {
    eyebrow: "Software",
    title: "Custom Tools and Client Portals",
    subtitle: "Purpose-built portals, dashboards, internal tools, and lightweight SaaS foundations for workflows generic software cannot handle well.",
    bestFor: "Businesses that need a custom system instead of another spreadsheet or disconnected app.",
    bullets: ["Workflow and role mapping", "Dashboard and portal interfaces", "Reporting views and admin tools", "Launch-ready product foundations"],
    outcome: "A focused business tool designed around your real process.",
    actions: [{ variant: "primary", label: "Plan a custom system", href: "/contact?service=not_sure&preferred=email", internal: true }],
  },
  {
    eyebrow: "Maintenance",
    title: "Website Updates and Maintenance",
    subtitle: "Keep your website current, reliable, and aligned with your latest offers without managing every detail yourself.",
    bestFor: "Businesses that want edits, fixes, cleanup, and improvements handled clearly.",
    bullets: ["Text, image, service, and pricing updates", "Small bug fixes and layout cleanup", "Basic performance and reliability checks", "Optional ongoing maintenance"],
    outcome: "Your website stays accurate, active, and trustworthy.",
    actions: [
      { variant: "primary", label: "Request an update", href: "/contact?service=maintenance&preferred=email", internal: true },
      { variant: "soft", label: "Pay in full — $79", href: PAY.updates_paid_full },
    ],
  },
  {
    eyebrow: "Creative Support",
    title: "Flyers and Social Media Content",
    subtitle: "Clean promotional assets for offers, events, menus, announcements, and social content that need to look professional quickly.",
    bestFor: "Businesses that need clear campaign visuals without a heavy design process.",
    bullets: ["Flyers and post graphics sized for common platforms", "Clear hierarchy and offer messaging", "Consistent visual direction", "Fast turnaround available"],
    outcome: "You can promote offers with a stronger, more credible brand presence.",
    actions: [
      { variant: "primary", label: "Request design support", href: "/contact?service=flyers&preferred=email", internal: true },
      { variant: "soft", label: "Flyer — $20", href: PAY.flyer_paid_full },
      { variant: "soft", label: "Social Pack — $35", href: PAY.social_paid_full },
    ],
  },
  {
    eyebrow: "Operations",
    title: "Admin and Virtual Assistance",
    subtitle: "Organized support for scheduling, simple systems, inbox drafts, spreadsheets, and weekly workflow cleanup.",
    bestFor: "Owners who are losing time to repeat tasks and scattered admin work.",
    bullets: ["Scheduling and organization support", "Inbox drafts and response templates", "Simple spreadsheets and process cleanup", "Hourly support with a simple deposit"],
    outcome: "Less operational clutter and more time for the work that matters.",
    actions: [
      { variant: "primary", label: "Ask about admin help", href: "/contact?service=admin&preferred=email", internal: true },
      { variant: "soft", label: "Admin deposit — $50", href: PAY.admin_deposit },
    ],
  },
];

function Section({ children, className = "" }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return <motion.section initial={reduce ? false : "hidden"} whileInView="show" viewport={{ once: true, margin: "-120px" }} variants={stagger} className={className}>{children}</motion.section>;
}

function GoldButton({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="inline-flex items-center justify-center rounded-lg bg-[linear-gradient(180deg,#ffd56a,#c89426)] px-5 py-3 text-sm font-black text-[#06101f] shadow-[0_18px_48px_rgba(212,175,55,.24),inset_0_1px_0_rgba(255,255,255,.55)] transition duration-300 hover:-translate-y-0.5">{children}</Link>;
}

function OutlineButton({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="inline-flex items-center justify-center rounded-lg border border-[rgba(212,175,55,.42)] bg-[#081226]/80 px-5 py-3 text-sm font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,.05)] transition duration-300 hover:-translate-y-0.5 hover:bg-white/[.06]">{children}</Link>;
}

function ServiceCard({ service }: { service: (typeof serviceGroups)[number] }) {
  return <motion.article variants={fadeUp} className="rounded-[1.35rem] border border-[rgba(212,175,55,.13)] bg-[linear-gradient(145deg,rgba(9,16,32,.94),rgba(2,5,14,.98))] p-6 shadow-[0_28px_80px_rgba(0,0,0,.34)]"><div className="flex items-start justify-between gap-4"><p className="text-xs font-black uppercase tracking-[.26em] text-[var(--gold)]">{service.eyebrow}</p>{service.badge ? <span className="rounded-full border border-[rgba(212,175,55,.24)] bg-[var(--gold)] px-3 py-1 text-xs font-black text-[#06101f]">{service.badge}</span> : null}</div><h3 className="mt-4 text-2xl font-black tracking-[-.04em]">{service.title}</h3><p className="mt-3 leading-7 text-[var(--muted)]">{service.subtitle}</p><div className="mt-5 rounded-[1rem] border border-[rgba(212,175,55,.12)] bg-white/[.035] p-4"><p className="text-sm font-black text-white">Best fit</p><p className="mt-1 text-sm leading-6 text-slate-300">{service.bestFor}</p></div><ul className="mt-5 grid gap-2 text-sm text-slate-200">{service.bullets.map((bullet) => <li key={bullet} className="flex gap-3"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--gold)] shadow-[0_0_18px_rgba(212,175,55,.6)]" />{bullet}</li>)}</ul><p className="mt-5 text-sm font-bold text-white">Outcome: <span className="font-normal text-[var(--muted)]">{service.outcome}</span></p><div className="mt-6 flex flex-col gap-2">{service.actions.map((action) => { const classes = action.variant === "primary" ? "bg-[var(--gold)] text-[#06101f]" : action.variant === "link" ? "text-[var(--gold)] px-1" : "border border-[rgba(212,175,55,.18)] bg-white/[.035] text-slate-100 hover:bg-white/[.06]"; const content = <><span>{action.label}</span><span aria-hidden>→</span></>; return action.internal ? <Link key={action.label} href={action.href} className={`inline-flex items-center justify-between rounded-lg px-4 py-2 text-sm font-black transition ${classes}`}>{content}</Link> : <a key={action.label} href={action.href} target="_blank" rel="noreferrer" className={`inline-flex items-center justify-between rounded-lg px-4 py-2 text-sm font-black transition ${classes}`}>{content}</a>; })}</div></motion.article>;
}

export default function ServicesPageClient() {
  return <div className="overflow-hidden bg-[#030713] text-white"><Section className="relative mx-auto max-w-[94rem] px-5 pb-16 pt-16 sm:px-8 lg:px-10 lg:pb-24 lg:pt-24"><div className="absolute inset-x-0 top-0 h-[52rem] bg-[radial-gradient(circle_at_12%_18%,rgba(212,175,55,.16),transparent_28rem),radial-gradient(circle_at_82%_12%,rgba(14,22,62,.72),transparent_38rem)]" /><div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,.025)_1px,transparent_1px)] bg-[size:72px_72px] opacity-20" /><motion.div variants={fadeUp} className="relative z-10 max-w-5xl"><p className="text-xs font-black uppercase tracking-[.34em] text-[var(--gold)]">Services</p><h1 className="mt-5 max-w-5xl text-5xl font-black leading-[.94] tracking-[-.065em] sm:text-6xl xl:text-[5.25rem]">Premium websites, AI systems, and business technology built around your goals.</h1><p className="mt-6 max-w-3xl text-base leading-8 text-[var(--muted)] sm:text-lg">Choose a focused service or combine strategy, design, automation, and custom development into one clear build plan. Every recommendation is scoped for practical business results.</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><GoldButton href="/contact">Get a Recommendation</GoldButton><OutlineButton href="/pricing">View Pricing</OutlineButton></div></motion.div></Section><Section className="mx-auto max-w-[94rem] border-y border-[rgba(212,175,55,.10)] px-5 py-20 sm:px-8 lg:px-10"><motion.p variants={fadeUp} className="text-xs font-black uppercase tracking-[.32em] text-[var(--gold)]">Service menu</motion.p><motion.h2 variants={fadeUp} className="mt-4 max-w-4xl text-4xl font-black tracking-[-.055em] sm:text-6xl">Clear offers. Flexible combinations. No tech overwhelm.</motion.h2><div className="mt-10 grid gap-5 lg:grid-cols-2">{serviceGroups.map((service) => <ServiceCard key={service.title} service={service} />)}</div></Section><Section className="mx-auto max-w-[94rem] px-5 py-20 sm:px-8 lg:px-10"><motion.div variants={fadeUp} className="relative overflow-hidden rounded-[1.7rem] border border-[rgba(212,175,55,.22)] bg-[radial-gradient(circle_at_84%_72%,rgba(245,158,11,.34),transparent_16rem),radial-gradient(circle_at_95%_28%,rgba(255,255,255,.10),transparent_9rem),linear-gradient(145deg,rgba(6,12,28,.92),rgba(2,5,14,.98))] p-8 shadow-[0_34px_110px_rgba(0,0,0,.42)] md:p-12"><div className="absolute bottom-0 right-0 h-56 w-64 bg-[conic-gradient(from_210deg,transparent,rgba(245,158,11,.42),transparent_35%)] blur-xl" /><div className="relative max-w-3xl"><p className="text-xs font-black uppercase tracking-[.28em] text-[var(--gold)]">Not sure what you need?</p><h2 className="mt-3 text-3xl font-black leading-tight tracking-[-.045em] sm:text-5xl">Send the goal. I’ll recommend the cleanest path.</h2><p className="mt-4 leading-7 text-[var(--muted)]">Tell me what you want to improve, launch, automate, or clean up. I’ll help choose the right service mix before you spend money.</p><div className="mt-7 flex flex-col gap-3 sm:flex-row"><GoldButton href="/contact">Contact Me</GoldButton><OutlineButton href="/payments">View All Payments</OutlineButton></div></div></motion.div></Section></div>;
}
