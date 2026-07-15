"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { Variants } from "framer-motion";
import type { ReactNode } from "react";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.72, ease: [0.16, 1, 0.3, 1] } },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.08 } },
};

const mediaIn: Variants = {
  hidden: { opacity: 0, y: 34, rotateX: 7, scale: 0.96 },
  show: { opacity: 1, y: 0, rotateX: 0, scale: 1, transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] } },
};

const capabilities = [
  "AI Copilots",
  "Customer Support AI",
  "Internal Knowledge Assistants",
  "Sales Assistants",
  "Workflow Automation",
  "Client Portals",
  "Internal Business Systems",
  "Executive Dashboards",
  "Custom SaaS",
  "AI Integrations",
  "AI Document Systems",
  "CRM Automation",
  "Scheduling Systems",
  "Reporting Systems",
  "Multi-step AI Workflows",
] as const;

const buildPhases = [
  ["Strategy", "Map the workflow, users, tools, risks, data sources, and business outcome before anything is built."],
  ["System Design", "Define the assistant logic, dashboards, integrations, permissions, and handoff paths."],
  ["Build", "Create the interface, automation, AI behavior, and connected backend flow with clean implementation."],
  ["Launch", "Test edge cases, document the system, train your team, and improve based on real usage."],
] as const;

function Section({ children, className = "" }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.section initial={reduce ? false : "hidden"} whileInView="show" viewport={{ once: true, margin: "-120px" }} variants={stagger} className={className}>
      {children}
    </motion.section>
  );
}

function GoldButton({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="inline-flex items-center justify-center rounded-lg bg-[linear-gradient(180deg,#ffd56a,#c89426)] px-5 py-3 text-sm font-black text-[#06101f] shadow-[0_18px_48px_rgba(212,175,55,.24),inset_0_1px_0_rgba(255,255,255,.55)] transition duration-300 hover:-translate-y-0.5">{children}</Link>;
}

function OutlineButton({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="inline-flex items-center justify-center rounded-lg border border-[rgba(212,175,55,.42)] bg-[#081226]/80 px-5 py-3 text-sm font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,.05)] transition duration-300 hover:-translate-y-0.5 hover:bg-white/[.06]">{children}</Link>;
}

function MediaPlaceholder({ label, ratio = "aspect-[16/10]" }: { label: string; ratio?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-[1.45rem] border border-[rgba(212,175,55,.16)] bg-[#030711] shadow-[0_30px_90px_rgba(0,0,0,.42),0_0_0_1px_rgba(255,255,255,.035)_inset] ${ratio}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(245,158,11,.24),transparent_12rem),radial-gradient(circle_at_15%_88%,rgba(8,18,34,.74),transparent_18rem),linear-gradient(145deg,rgba(5,10,22,.99),rgba(2,5,14,.995))]" />
      <div className="absolute inset-4 rounded-[1rem] border border-[rgba(212,175,55,.10)] bg-[linear-gradient(135deg,rgba(255,255,255,.07),rgba(255,255,255,.014))]" />
      <div className="absolute left-7 top-7 flex gap-1.5"><span className="h-2 w-2 rounded-full bg-[#d4af37]" /><span className="h-2 w-2 rounded-full bg-white/20" /><span className="h-2 w-2 rounded-full bg-white/14" /></div>
      <p className="absolute left-7 top-14 text-[.58rem] font-black uppercase tracking-[.24em] text-[var(--gold)]">Replaceable media placeholder</p>
      <p className="absolute bottom-7 left-7 right-7 text-2xl font-black tracking-[-.045em] text-white sm:text-3xl">{label}</p>
      <div className="absolute bottom-0 right-0 h-40 w-56 bg-[conic-gradient(from_210deg,transparent,rgba(245,158,11,.4),transparent_35%)] blur-xl" />
    </div>
  );
}

export default function AISystemsPageClient() {
  return (
    <div className="overflow-hidden bg-[#030713] text-white">
      <Section className="relative mx-auto grid max-w-[94rem] gap-10 px-5 pb-16 pt-16 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:px-10 lg:pb-24 lg:pt-24">
        <div className="absolute inset-x-0 top-0 h-[52rem] bg-[radial-gradient(circle_at_12%_18%,rgba(212,175,55,.16),transparent_28rem),radial-gradient(circle_at_82%_12%,rgba(14,22,62,.72),transparent_38rem)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,.025)_1px,transparent_1px)] bg-[size:72px_72px] opacity-20" />
        <motion.div variants={fadeUp} className="relative z-10 self-center text-center lg:text-left">
          <p className="text-xs font-black uppercase tracking-[.34em] text-[var(--gold)]">AI Systems by JG Creative Studio</p>
          <h1 className="mx-auto mt-5 max-w-3xl text-5xl font-black leading-[.94] tracking-[-.065em] sm:text-6xl lg:mx-0 xl:text-[5.35rem]">AI systems built for <span className="text-[var(--gold)]">real operations.</span></h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-[var(--muted)] sm:text-lg lg:mx-0">JG Creative Studio designs and builds AI copilots, business automation, portals, dashboards, integrations, and custom software that help teams sell, support, operate, and scale with confidence.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row"><GoldButton href="/contact?service=AI%20Setup&preferred=email">Start an AI Systems Project</GoldButton><OutlineButton href="/services">View All Services</OutlineButton></div>
        </motion.div>
        <motion.div variants={mediaIn} className="relative z-10">
          <div className="absolute -inset-6 rounded-[2.5rem] bg-[radial-gradient(circle_at_50%_80%,rgba(212,175,55,.18),transparent_55%)] blur-2xl" />
          <MediaPlaceholder label="AI operating system interface" ratio="aspect-[16/12]" />
        </motion.div>
      </Section>

      <Section className="mx-auto max-w-[94rem] border-y border-[rgba(212,175,55,.10)] px-5 py-20 text-center sm:px-8 lg:px-10 lg:py-20">
        <motion.p variants={fadeUp} className="text-xs font-black uppercase tracking-[.32em] text-[var(--gold)]">What we build</motion.p>
        <motion.h2 variants={fadeUp} className="mx-auto mt-4 max-w-4xl text-4xl font-black tracking-[-.055em] sm:text-6xl">A full AI systems partner, not a chatbot shop.</motion.h2>
        <motion.div variants={fadeUp} className="mt-10 flex flex-wrap justify-center gap-3">
          {capabilities.map((item) => <span key={item} className="rounded-full border border-[rgba(212,175,55,.42)] bg-[linear-gradient(180deg,#ffd56a,#c89426)] px-4 py-2 text-sm font-black text-[#06101f] shadow-[0_12px_30px_rgba(212,175,55,.20),inset_0_1px_0_rgba(255,255,255,.55)]">{item}</span>)}
        </motion.div>
      </Section>

      <Section className="mx-auto max-w-[94rem] px-5 py-20 text-center sm:px-8 lg:px-10">
        <motion.p variants={fadeUp} className="text-xs font-black uppercase tracking-[.32em] text-[var(--gold)]">Delivery process</motion.p>
        <motion.h2 variants={fadeUp} className="mx-auto mt-4 max-w-4xl text-4xl font-black tracking-[-.055em] sm:text-6xl">Built cleanly enough to run inside the business.</motion.h2>
        <div className="mt-10 grid gap-5 lg:grid-cols-4">{buildPhases.map(([phase, copy], index) => <motion.article variants={fadeUp} key={phase} className="rounded-[1.35rem] border border-[rgba(212,175,55,.13)] bg-[linear-gradient(145deg,rgba(9,16,32,.94),rgba(2,5,14,.98))] p-6 shadow-[0_28px_80px_rgba(0,0,0,.34)]"><p className="text-sm font-black text-[var(--gold)]">0{index + 1}</p><h3 className="mt-5 text-2xl font-black tracking-[-.04em]">{phase}</h3><p className="mt-4 text-sm leading-7 text-[var(--muted)]">{copy}</p></motion.article>)}</div>
      </Section>

      <Section className="mx-auto max-w-[94rem] px-5 py-10 sm:px-8 lg:px-10">
        <motion.div variants={fadeUp} className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-5 rounded-2xl border border-[rgba(212,175,55,.18)] bg-[#050b18] p-5 text-center shadow-[0_18px_50px_rgba(0,0,0,.28)] sm:p-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[.28em] text-[var(--gold)]">Ready to modernize the workflow?</p>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]"><span className="font-black text-white">Tell me what needs to improve.</span> I’ll map the right AI system before anything gets built.</p>
          </div>
          <div className="flex shrink-0 flex-col justify-center gap-3 sm:flex-row"><GoldButton href="/contact?service=AI%20Setup&preferred=email">Request Quote</GoldButton><OutlineButton href="/pricing">Pricing</OutlineButton></div>
        </motion.div>
      </Section>
    </div>
  );
}
