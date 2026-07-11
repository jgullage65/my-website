"use client";

import Link from "next/link";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import type { Variants } from "framer-motion";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { useId, useState } from "react";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.72, ease: [0.16, 1, 0.3, 1] } },
};

const sectionStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.08 } },
};

const mediaIn: Variants = {
  hidden: { opacity: 0, y: 34, rotateX: 8, scale: 0.96 },
  show: { opacity: 1, y: 0, rotateX: 0, scale: 1, transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] } },
};

const aiTabs = [
  {
    id: "copilots",
    label: "AI Copilots",
    heading: "Business-aware assistants for practical support.",
    description: "Custom copilots that answer questions, capture context, qualify requests, and guide people toward the next best action.",
    lines: ["Knowledge and offer design", "Lead intake and routing", "Human handoff paths", "Website or internal deployment"],
    mediaLabel: "AI copilot workspace",
  },
  {
    id: "automation",
    label: "Automation",
    heading: "Less manual drag. Cleaner operations.",
    description: "Automation flows that remove repetitive work while keeping the important decisions visible to your team.",
    lines: ["Intake to follow-up workflows", "Notification and task logic", "Documented business rules", "Clean handoff states"],
    mediaLabel: "Automation command center",
  },
  {
    id: "integrations",
    label: "Integrations",
    heading: "Your tools should work together.",
    description: "Connect the systems your business already depends on so information moves without copy-paste bottlenecks.",
    lines: ["CRM and form connections", "Scheduling and email flows", "Payment and account paths", "Data sync planning"],
    mediaLabel: "Integration architecture preview",
  },
  {
    id: "systems",
    label: "Custom Systems",
    heading: "Software designed around the way you operate.",
    description: "Purpose-built portals, workflow tools, and product foundations for workflows generic software cannot handle well.",
    lines: ["Custom portals and dashboards", "Role-based workflow design", "Product architecture", "Launch-ready implementation"],
    mediaLabel: "Custom business software",
  },
] as const;

const workCards = [
  ["Premium Websites", "Premium websites built to convert visitors into customers.", "View Website Work", "/services", "Premium website"],
  ["AI Systems", "AI assistants that answer, automate, and help your team move faster.", "View AI Systems", "/ai-tools", "AI system"],
  ["Custom Software", "Purpose-built tools that simplify operations and support growth.", "View Custom Software", "/contact", "Custom software"],
] as const;

const processSteps = [
  ["Discover", "We learn your business, goals, and constraints."],
  ["Strategy", "We map the right system and plan."],
  ["Build", "We design, develop, and integrate."],
  ["Launch", "We launch and optimize for growth."],
  ["Scale", "We track, improve, and scale what works."],
] as const;

function Section({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.section id={id} initial={reduce ? false : "hidden"} whileInView="show" viewport={{ once: true, margin: "-120px" }} variants={sectionStagger} className={className}>
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

function ProductMedia({ src, alt, label, className = "", ratio = "aspect-[16/10]" }: { src?: string; alt: string; label: string; className?: string; ratio?: string }) {
  return (
    <div className={`group relative overflow-hidden rounded-[1.15rem] border border-[rgba(212,175,55,.18)] bg-[#030711] shadow-[0_28px_90px_rgba(0,0,0,.48),0_0_0_1px_rgba(255,255,255,.035)_inset] ${ratio} ${className}`}>
      {src ? <img src={src} alt={alt} className="h-full w-full object-cover" /> : null}
      {!src ? (
        <div aria-label={alt} className="absolute inset-0 bg-[radial-gradient(circle_at_72%_17%,rgba(245,158,11,.24),transparent_12rem),radial-gradient(circle_at_18%_84%,rgba(8,18,34,.68),transparent_17rem),linear-gradient(145deg,rgba(5,10,22,.99),rgba(2,5,14,.995))]">
          <div className="absolute inset-3 rounded-[.9rem] border border-[rgba(212,175,55,.10)] bg-[linear-gradient(135deg,rgba(255,255,255,.07),rgba(255,255,255,.014))]" />
          <div className="absolute left-5 top-5 flex gap-1.5"><span className="h-2 w-2 rounded-full bg-[#d4af37]" /><span className="h-2 w-2 rounded-full bg-white/20" /><span className="h-2 w-2 rounded-full bg-white/14" /></div>
          <p className="absolute left-5 top-10 text-[.56rem] font-black uppercase tracking-[.22em] text-[var(--gold)]">{label}</p>
          <div className="absolute left-[9%] right-[9%] top-[28%] h-px bg-gradient-to-r from-transparent via-[rgba(212,175,55,.20)] to-transparent" />
          <div className="absolute bottom-[14%] left-[12%] h-[36%] w-[76%] rounded-2xl border border-[rgba(212,175,55,.13)] bg-black/30 shadow-[0_0_70px_rgba(212,175,55,.08)]" />
          <div className="absolute -bottom-10 left-1/2 h-28 w-[72%] -translate-x-1/2 rounded-[50%] bg-[rgba(212,175,55,.24)] blur-2xl" />
        </div>
      ) : null}
    </div>
  );
}

function HeroCollage() {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 80, damping: 22 });
  const sy = useSpring(y, { stiffness: 80, damping: 22 });
  const px = useTransform(sx, [-0.5, 0.5], [-20, 20]);
  const py = useTransform(sy, [-0.5, 0.5], [-12, 12]);
  const backPx = useTransform(px, (v) => v * -0.35);
  const backPy = useTransform(py, (v) => v * -0.35);
  function move(e: MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - r.left) / r.width - 0.5);
    y.set((e.clientY - r.top) / r.height - 0.5);
  }
  return (
    <motion.div variants={mediaIn} onMouseMove={move} onMouseLeave={() => { x.set(0); y.set(0); }} className="relative min-h-[27rem] sm:min-h-[34rem] lg:min-h-[43rem] [perspective:1400px]">
      <div className="absolute bottom-12 left-1/2 h-24 w-[76%] -translate-x-1/2 rounded-[50%] border border-[rgba(212,175,55,.35)] bg-[radial-gradient(circle,rgba(245,158,11,.34),transparent_58%)] blur-[1px]" />
      <div className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(212,175,55,.18)] blur-3xl" />
      <motion.div style={reduce ? undefined : { x: backPx, y: backPy }} className="absolute left-[8%] top-[4%] w-[76%] -rotate-3"><ProductMedia alt="Premium business website placeholder" label="Premium website" /></motion.div>
      <motion.div animate={reduce ? undefined : { y: [0, -10, 0] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }} className="absolute right-[1%] top-[27%] z-20 w-[58%] rotate-2"><ProductMedia alt="Selected product placeholder" label="Selected product" ratio="aspect-[16/11]" /></motion.div>
      <motion.div style={reduce ? undefined : { x: px, y: py }} className="absolute bottom-[10%] left-[2%] z-30 w-[40%] -rotate-6"><ProductMedia alt="AI system placeholder" label="AI copilot" ratio="aspect-[4/5]" /></motion.div>
      <motion.div animate={reduce ? undefined : { y: [0, 9, 0] }} transition={{ duration: 8.5, repeat: Infinity, ease: "easeInOut" }} className="absolute bottom-[2%] right-[14%] z-40 w-[46%] rotate-1"><ProductMedia alt="Custom software placeholder" label="Business software" ratio="aspect-[16/9]" /></motion.div>
    </motion.div>
  );
}

export default function HomePage() {
  const [active, setActive] = useState(0);
  const tabRoot = useId();
  const current = aiTabs[active];

  function onTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const last = aiTabs.length - 1;
    const next = event.key === "Home" ? 0 : event.key === "End" ? last : event.key === "ArrowRight" ? (active + 1) % aiTabs.length : (active - 1 + aiTabs.length) % aiTabs.length;
    setActive(next);
    window.requestAnimationFrame(() => document.getElementById(`${tabRoot}-${aiTabs[next].id}-tab`)?.focus());
  }

  return (
    <div className="overflow-hidden bg-[#030713] text-white">
      <Section className="relative mx-auto grid max-w-[94rem] gap-8 px-5 pb-16 pt-14 sm:px-8 lg:grid-cols-[.76fr_1.24fr] lg:px-10 lg:pb-20 lg:pt-20">
        <div className="absolute inset-x-0 top-0 h-[48rem] bg-[radial-gradient(circle_at_10%_20%,rgba(212,175,55,.14),transparent_28rem),radial-gradient(circle_at_82%_18%,rgba(9,20,38,.34),transparent_36rem)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,.025)_1px,transparent_1px)] bg-[size:72px_72px] opacity-20" />
        <motion.div variants={fadeUp} className="relative z-10 self-center py-6">
          <p className="text-xs font-black uppercase tracking-[.34em] text-[var(--gold)]">JG Creative Studio</p>
          <h1 className="mt-5 max-w-2xl text-5xl font-black leading-[.95] tracking-[-.065em] sm:text-6xl xl:text-[5.2rem]">Premium websites.<span className="block">AI systems built for <span className="text-[var(--gold)]">real business.</span></span></h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-[var(--muted)] sm:text-lg">JG Creative Studio builds high-performance websites, custom AI systems, automation, and business software that help companies attract customers, operate smarter, and grow.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row"><GoldButton href="/contact">Start a Project →</GoldButton><OutlineButton href="/#work">Explore Our Work ↗</OutlineButton></div>
        </motion.div>
        <HeroCollage />
      </Section>

      <Section id="work" className="mx-auto max-w-[94rem] border-y border-[rgba(212,175,55,.10)] px-5 py-20 text-center sm:px-8 lg:px-10 lg:py-20">
        <motion.p variants={fadeUp} className="text-xs font-black uppercase tracking-[.32em] text-[var(--gold)]">Selected Work</motion.p>
        <motion.h2 variants={fadeUp} className="mt-4 text-4xl font-black tracking-[-.055em] sm:text-6xl">Real products. Real results.</motion.h2>
        <div className="mt-10 grid gap-5 text-left md:grid-cols-2 xl:grid-cols-3">
          {workCards.map(([title, desc, cta, href, label]) => (
            <motion.article variants={fadeUp} whileHover={{ y: -8, rotateX: 2 }} key={title} className="rounded-[1.45rem] border border-[rgba(212,175,55,.13)] bg-[linear-gradient(145deg,rgba(9,16,32,.94),rgba(2,5,14,.98))] p-4 shadow-[0_30px_90px_rgba(0,0,0,.36)]">
              <ProductMedia alt={`${title} placeholder`} label={label} ratio="aspect-[16/11]" />
              <div className="p-2 pt-5"><p className="text-[.62rem] font-black uppercase tracking-[.22em] text-[var(--gold)]">{title}</p><h3 className="mt-3 text-2xl font-black tracking-[-.04em]">{title === "Premium Websites" ? "High-converting websites built to perform." : title === "AI Systems" ? "Intelligent systems that automate and scale." : "Powerful software built for your workflow."}</h3><p className="mt-3 min-h-14 text-sm leading-6 text-[var(--muted)]">{desc}</p><Link href={href} className="mt-6 inline-flex text-sm font-black text-[var(--gold)]">{cta} →</Link></div>
            </motion.article>
          ))}
        </div>
      </Section>

      <Section className="mx-auto grid max-w-[94rem] gap-10 border-b border-[rgba(212,175,55,.10)] px-5 py-20 sm:px-8 lg:grid-cols-[.88fr_1.12fr] lg:px-10 lg:py-20">
        <motion.div variants={fadeUp} className="self-center">
          <p className="text-xs font-black uppercase tracking-[.32em] text-[var(--gold)]">AI Systems</p>
          <h2 className="mt-4 text-4xl font-black leading-[.96] tracking-[-.055em] sm:text-6xl">Smarter systems.<br />Stronger businesses.</h2>
          <div role="tablist" aria-label="AI system capabilities" onKeyDown={onTabKeyDown} className="mt-8 flex flex-wrap gap-2">
            {aiTabs.map((tab, i) => <button key={tab.id} id={`${tabRoot}-${tab.id}-tab`} role="tab" aria-selected={active === i} aria-controls={`${tabRoot}-${tab.id}-panel`} tabIndex={active === i ? 0 : -1} onClick={() => setActive(i)} className={`rounded-lg border px-4 py-2 text-xs font-black transition ${active === i ? "border-[var(--gold)] bg-[var(--gold)] text-[#06101f]" : "border-[rgba(212,175,55,.13)] bg-white/[.03] text-white hover:border-[rgba(212,175,55,.42)]"}`}>{tab.label}</button>)}
          </div>
          <AnimatePresence mode="wait"><motion.div key={current.id} id={`${tabRoot}-${current.id}-panel`} role="tabpanel" aria-labelledby={`${tabRoot}-${current.id}-tab`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: .3 }} className="mt-8"><h3 className="text-2xl font-black tracking-[-.035em]">{current.heading}</h3><p className="mt-4 max-w-xl leading-7 text-[var(--muted)]">{current.description}</p><ul className="mt-6 grid gap-3">{current.lines.map(line => <li key={line} className="flex gap-3 text-sm font-bold text-slate-200"><span className="mt-1.5 h-2 w-2 rounded-full bg-[var(--gold)] shadow-[0_0_18px_rgba(212,175,55,.6)]" />{line}</li>)}</ul></motion.div></AnimatePresence>
          <div className="mt-8"><GoldButton href="/ai-tools">Explore AI Systems →</GoldButton></div>
        </motion.div>
        <motion.div variants={mediaIn} className="relative"><div className="absolute -inset-5 rounded-[2.5rem] bg-[radial-gradient(circle_at_50%_80%,rgba(212,175,55,.18),transparent_55%)] blur-2xl" /><AnimatePresence mode="wait"><motion.div key={current.mediaLabel} initial={{ opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.01 }} transition={{ duration: .35 }}><ProductMedia alt={`${current.mediaLabel} placeholder`} label={current.mediaLabel} ratio="aspect-[16/11]" className="rounded-[1.6rem] lg:mt-16" /></motion.div></AnimatePresence></motion.div>
      </Section>

      <Section className="mx-auto max-w-[94rem] px-5 py-20 text-center sm:px-8 lg:px-10">
        <motion.p variants={fadeUp} className="text-xs font-black uppercase tracking-[.32em] text-[var(--gold)]">Our Process</motion.p>
        <motion.h2 variants={fadeUp} className="mt-4 text-4xl font-black tracking-[-.055em] sm:text-6xl">From idea to impact.</motion.h2>
        <motion.div variants={fadeUp} className="relative mt-12 overflow-hidden rounded-[1.7rem] border border-[rgba(212,175,55,.13)] bg-[#030815] p-7 shadow-[0_34px_110px_rgba(0,0,0,.42)] md:p-10">
          <motion.div initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 1.2, ease: "easeInOut" }} className="absolute left-14 right-14 top-[6.45rem] hidden h-px origin-left bg-[linear-gradient(90deg,transparent,#d4af37,transparent)] lg:block" />
          <div className="grid gap-7 text-left lg:grid-cols-5 lg:text-center">{processSteps.map(([step, copy], i) => <div key={step} className="relative flex gap-5 lg:block lg:text-center"><div className="z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[rgba(212,175,55,.58)] bg-[#08122a] font-black text-[var(--gold)] shadow-[0_0_34px_rgba(212,175,55,.25)] lg:mx-auto">0{i + 1}</div><div><h3 className="mt-0 font-black text-white lg:mt-5">{step}</h3><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{copy}</p></div></div>)}</div>
          <motion.div variants={fadeUp} className="relative mt-14 overflow-hidden rounded-[1.6rem] border border-[rgba(212,175,55,.22)] bg-[linear-gradient(145deg,rgba(6,12,28,.92),rgba(2,5,14,.98))] p-8 text-center md:p-12">
            <div className="relative mx-auto max-w-3xl"><p className="text-xs font-black uppercase tracking-[.28em] text-[var(--gold)]">Ready to build something great?</p><h2 className="mt-3 text-3xl font-black leading-tight tracking-[-.045em] sm:text-5xl">Ready to build something your business can actually use?</h2><p className="mt-4 leading-7 text-[var(--muted)]">Let’s build something useful, polished, and designed around the way your business works.</p><div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><GoldButton href="/contact">Start a Project →</GoldButton><OutlineButton href="/#work">View Our Work</OutlineButton></div></div>
          </motion.div>
        </motion.div>
      </Section>
    </div>
  );
}
