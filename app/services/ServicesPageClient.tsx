"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { Variants } from "framer-motion";
import type { ReactNode } from "react";

const fadeUp: Variants = { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: { duration: 0.72, ease: [0.16, 1, 0.3, 1] } } };
const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.1, delayChildren: 0.08 } } };

type ServiceGroup = {
  eyebrow: string;
  title: string;
  subtitle: string;
  bestFor: string;
  bullets: readonly string[];
  outcome: string;
  actionLabel: string;
  actionHref: string;
};

const serviceGroups: readonly ServiceGroup[] = [
  {
    eyebrow: "Websites",
    title: "Premium Website Creation",
    subtitle: "Fast, polished, mobile-first websites that make your business look credible and turn visitors into calls, bookings, and quote requests.",
    bestFor: "Businesses that need a high-trust web presence with clear calls to action.",
    bullets: ["Homepage, service, contact, and thank-you flow planning", "Premium dark visual direction available", "Conversion-focused structure", "Built to expand as your business grows"],
    outcome: "A professional website that supports customer trust and action.",
    actionLabel: "Request a website quote",
    actionHref: "/contact?service=website&preferred=email",
  },
  {
    eyebrow: "AI Systems",
    title: "AI, Automation, and Business Systems",
    subtitle: "Custom AI copilots, customer support AI, internal knowledge assistants, CRM automation, scheduling systems, dashboards, and multi-step workflows.",
    bestFor: "Teams that want to reduce manual work, respond faster, organize knowledge, or connect disconnected tools.",
    bullets: ["AI workflow and system planning", "Customer or internal assistant logic", "CRM, scheduling, and reporting automation", "Human handoff and approval paths"],
    outcome: "A practical AI system that supports the way your business operates.",
    actionLabel: "Request an AI systems quote",
    actionHref: "/contact?service=ai&preferred=email",
  },
  {
    eyebrow: "Software",
    title: "Custom Tools and Client Portals",
    subtitle: "Purpose-built portals, dashboards, internal tools, and lightweight SaaS foundations for workflows generic software cannot handle well.",
    bestFor: "Businesses that need a custom system instead of another spreadsheet or disconnected app.",
    bullets: ["Workflow and role mapping", "Dashboard and portal interfaces", "Reporting views and admin tools", "Launch-ready product foundations"],
    outcome: "A focused business tool designed around your real process.",
    actionLabel: "Plan a custom system",
    actionHref: "/contact?service=not_sure&preferred=email",
  },
  {
    eyebrow: "Maintenance",
    title: "Website Updates and Maintenance",
    subtitle: "Keep your website current, reliable, and aligned with your latest offers without managing every detail yourself.",
    bestFor: "Businesses that want edits, fixes, cleanup, and improvements handled clearly.",
    bullets: ["Text, image, service, and pricing updates", "Small bug fixes and layout cleanup", "Basic performance and reliability checks", "Optional ongoing maintenance"],
    outcome: "Your website stays accurate, active, and trustworthy.",
    actionLabel: "Request an update",
    actionHref: "/contact?service=maintenance&preferred=email",
  },
  {
    eyebrow: "Creative Support",
    title: "Flyers and Social Media Content",
    subtitle: "Clean promotional assets for offers, events, menus, announcements, and social content that need to look professional quickly.",
    bestFor: "Businesses that need clear campaign visuals without a heavy design process.",
    bullets: ["Flyers and post graphics sized for common platforms", "Clear hierarchy and offer messaging", "Consistent visual direction", "Fast turnaround available"],
    outcome: "You can promote offers with a stronger, more credible brand presence.",
    actionLabel: "Request design support",
    actionHref: "/contact?service=flyers&preferred=email",
  },
  {
    eyebrow: "Operations",
    title: "Admin and Virtual Assistance",
    subtitle: "Organized support for scheduling, simple systems, inbox drafts, spreadsheets, and weekly workflow cleanup.",
    bestFor: "Owners who are losing time to repeat tasks and scattered admin work.",
    bullets: ["Scheduling and organization support", "Inbox drafts and response templates", "Simple spreadsheets and process cleanup", "Hourly support with a simple deposit"],
    outcome: "Less operational clutter and more time for the work that matters.",
    actionLabel: "Ask about admin help",
    actionHref: "/contact?service=admin&preferred=email",
  },
];

function Section({ children, className = "" }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return <motion.section initial={reduce ? false : "hidden"} whileInView="show" viewport={{ once: true, margin: "-120px" }} variants={stagger} className={className}>{children}</motion.section>;
}

function GoldButton({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="inline-flex w-fit items-center justify-center whitespace-nowrap rounded-lg bg-[linear-gradient(180deg,#ffd56a,#c89426)] px-5 py-3 text-sm font-black text-[#06101f] shadow-[0_18px_48px_rgba(212,175,55,.24),inset_0_1px_0_rgba(255,255,255,.55)] transition duration-300 hover:-translate-y-0.5">{children}</Link>;
}

function ServiceCard({ service }: { service: (typeof serviceGroups)[number] }) {
  return (
    <motion.article variants={fadeUp} className="rounded-[1.35rem] border border-[rgba(212,175,55,.13)] bg-[linear-gradient(145deg,rgba(9,16,32,.94),rgba(2,5,14,.98))] p-6 shadow-[0_28px_80px_rgba(0,0,0,.34)]">
      <p className="text-center text-xs font-black uppercase tracking-[.26em] text-[var(--gold)]">{service.eyebrow}</p>
      <h3 className="mt-4 text-center text-2xl font-black tracking-[-.04em]">{service.title}</h3>
      <p className="mt-3 text-center leading-7 text-[var(--muted)]">{service.subtitle}</p>
      <div className="mt-5 rounded-[1rem] border border-[rgba(212,175,55,.12)] bg-white/[.035] p-4 text-center">
        <p className="text-sm font-black text-white">Best fit</p>
        <p className="mt-1 text-sm leading-6 text-slate-300">{service.bestFor}</p>
      </div>
      <ul className="mx-auto mt-5 grid w-fit grid-cols-[.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-left text-sm text-slate-200">
        {service.bullets.map((bullet) => (
          <li key={bullet} className="contents">
            <span className="mt-1.5 h-2 w-2 rounded-full bg-[var(--gold)] shadow-[0_0_18px_rgba(212,175,55,.6)]" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-sm font-bold text-white">Outcome: <span className="font-normal text-[var(--muted)]">{service.outcome}</span></p>
      <div className="mt-6 flex justify-center">
        <GoldButton href={service.actionHref}>{service.actionLabel} →</GoldButton>
      </div>
    </motion.article>
  );
}

export default function ServicesPageClient() {
  return (
    <div className="overflow-hidden bg-[#030713] text-white">
      <Section className="relative mx-auto max-w-[94rem] px-5 py-10 sm:px-8 sm:py-12 lg:px-10 lg:py-14">
        <div className="absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(circle_at_12%_18%,rgba(212,175,55,.16),transparent_28rem),radial-gradient(circle_at_82%_12%,rgba(14,22,62,.72),transparent_38rem)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,.025)_1px,transparent_1px)] bg-[size:72px_72px] opacity-20" />
        <motion.div variants={fadeUp} className="relative z-10 mx-auto max-w-7xl text-center">
          <h1 className="text-4xl font-black leading-[1.02] tracking-[-.055em] sm:text-5xl lg:text-6xl xl:text-[4.75rem]">Premium websites, AI systems, and business technology <span className="text-[var(--gold)]">built around your goals.</span></h1>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-[var(--muted)] sm:text-lg sm:leading-8">Choose a focused service or combine strategy, design, automation, and custom development into one clear build plan. Every recommendation is scoped for practical business results.</p>
          <div className="mt-7 flex justify-center"><GoldButton href="/contact">Get a Recommendation</GoldButton></div>
        </motion.div>
      </Section>

      <Section className="mx-auto max-w-[94rem] border-y border-[rgba(212,175,55,.10)] px-5 pb-10 pt-16 text-center sm:px-8 lg:px-10 lg:pb-12">
        <motion.p variants={fadeUp} className="text-xs font-black uppercase tracking-[.32em] text-[var(--gold)]">Service menu</motion.p>
        <motion.h2 variants={fadeUp} className="mx-auto mt-4 max-w-4xl text-4xl font-black tracking-[-.055em] sm:text-6xl">Clear offers. Flexible combinations. <span className="text-[var(--gold)]">No tech overwhelm.</span></motion.h2>
        <div className="mt-10 grid gap-5 lg:grid-cols-2">{serviceGroups.map((service) => <ServiceCard key={service.title} service={service} />)}</div>
      </Section>
    </div>
  );
}
