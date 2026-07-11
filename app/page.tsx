"use client";

import Link from "next/link";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import type { Variants } from "framer-motion";
import type { MouseEvent, ReactNode } from "react";
import { useId, useState } from "react";

const leadforgeUrl = "https://leadforge.business/";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.72, ease: [0.16, 1, 0.3, 1] } },
};

const sectionStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};

const aiTabs = [
  {
    id: "copilots",
    label: "AI Copilots",
    heading: "Business-aware assistants for real conversations.",
    description: "Custom copilots that answer questions, capture context, qualify opportunities, and guide people toward the next best action.",
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
    description: "Purpose-built internal tools, portals, and product foundations for workflows that generic software cannot handle well.",
    lines: ["Custom portals and dashboards", "Role-based workflow design", "Product architecture", "Launch-ready implementation"],
    mediaLabel: "Custom business software",
  },
] as const;

const processSteps = ["Discover", "Strategy", "Build", "Launch", "Scale"] as const;

function Section({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.section initial={reduce ? false : "hidden"} whileInView="show" viewport={{ once: true, margin: "-120px" }} variants={sectionStagger} className={className} id={id}>
      {children}
    </motion.section>
  );
}

function GoldButton({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="inline-flex items-center justify-center rounded-xl bg-[linear-gradient(180deg,#f3ca55,#bf8f20)] px-5 py-3 text-sm font-black text-[#06101f] shadow-[0_18px_48px_rgba(212,175,55,.24),inset_0_1px_0_rgba(255,255,255,.45)] transition hover:-translate-y-0.5">{children}</Link>;
}

function OutlineButton({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="inline-flex items-center justify-center rounded-xl border border-[rgba(212,175,55,.34)] bg-white/[.025] px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/[.06]">{children}</Link>;
}

function ProductMedia({ src, alt, label, className = "", ratio = "aspect-[16/10]" }: { src?: string; alt: string; label: string; className?: string; ratio?: string }) {
  return (
    <div className={`group relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#071126] shadow-[0_28px_80px_rgba(0,0,0,.42),inset_0_1px_0_rgba(255,255,255,.08)] ${ratio} ${className}`}>
      {src ? <img src={src} alt={alt} className="h-full w-full object-cover" /> : null}
      {!src ? (
        <div aria-label={alt} className="absolute inset-0 bg-[radial-gradient(circle_at_72%_20%,rgba(245,158,11,.24),transparent_13rem),radial-gradient(circle_at_18%_78%,rgba(45,87,132,.42),transparent_16rem),linear-gradient(145deg,rgba(17,27,72,.95),rgba(4,8,23,.98))]">
          <div className="absolute inset-5 rounded-[1.15rem] border border-white/[.07] bg-[linear-gradient(135deg,rgba(255,255,255,.075),rgba(255,255,255,.015))]" />
          <div className="absolute left-6 top-6 flex gap-1.5"><span className="h-2 w-2 rounded-full bg-[#d4af37]" /><span className="h-2 w-2 rounded-full bg-white/20" /><span className="h-2 w-2 rounded-full bg-white/15" /></div>
          <div className="absolute bottom-0 left-1/2 h-24 w-[72%] -translate-x-1/2 rounded-[50%] bg-[rgba(212,175,55,.2)] blur-2xl" />
          <div className="absolute inset-x-8 bottom-8 top-16 rounded-2xl border border-[rgba(212,175,55,.16)] bg-black/10" />
          <p className="absolute left-7 top-11 text-[.62rem] font-black uppercase tracking-[.22em] text-[var(--gold)]">{label}</p>
        </div>
      ) : null}
    </div>
  );
}

function HeroCollage() {
  const reduce = useReducedMotion();
  const x = useMotionValue(0); const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 80, damping: 20 }); const sy = useSpring(y, { stiffness: 80, damping: 20 });
  const px = useTransform(sx, [-0.5, 0.5], [-22, 22]); const py = useTransform(sy, [-0.5, 0.5], [-14, 14]);
  const backPx = useTransform(px, v => v * -0.35); const backPy = useTransform(py, v => v * -0.35);
  function move(e: MouseEvent<HTMLDivElement>) { const r = e.currentTarget.getBoundingClientRect(); x.set((e.clientX - r.left) / r.width - .5); y.set((e.clientY - r.top) / r.height - .5); }
  return (
    <motion.div variants={fadeUp} onMouseMove={move} onMouseLeave={() => { x.set(0); y.set(0); }} className="relative min-h-[34rem] lg:min-h-[43rem]">
      <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(212,175,55,.22)] blur-3xl" />
      <motion.div style={reduce ? undefined : { x: backPx, y: backPy }} className="absolute left-2 top-8 w-[76%] -rotate-3"><ProductMedia alt="Premium business website placeholder" label="Premium website" /></motion.div>
      <motion.div animate={reduce ? undefined : { y: [0, -12, 0] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }} className="absolute right-0 top-36 w-[58%] rotate-2"><ProductMedia alt="AI system placeholder" label="AI system" ratio="aspect-[4/3]" /></motion.div>
      <motion.div style={reduce ? undefined : { x: px, y: py }} className="absolute bottom-8 left-[9%] w-[62%] rotate-1"><ProductMedia alt="Custom software placeholder" label="Business software" ratio="aspect-[16/9]" /></motion.div>
      <motion.div animate={reduce ? undefined : { y: [0, 10, 0] }} transition={{ duration: 8.5, repeat: Infinity, ease: "easeInOut" }} className="absolute bottom-0 right-[7%] w-[42%] -rotate-2"><ProductMedia alt="Selected product placeholder" label="Selected product" ratio="aspect-[5/4]" /></motion.div>
    </motion.div>
  );
}

export default function HomePage() {
  const [active, setActive] = useState(0);
  const tabRoot = useId();
  const current = aiTabs[active];
  return (
    <main className="overflow-hidden bg-[#040817] text-white">
      <Section className="relative mx-auto grid max-w-[92rem] gap-10 px-6 pb-20 pt-16 sm:px-8 lg:grid-cols-[.82fr_1.18fr] lg:px-10 lg:pt-24">
        <div className="absolute inset-x-0 top-0 h-[48rem] bg-[radial-gradient(circle_at_14%_18%,rgba(212,175,55,.16),transparent_30rem),radial-gradient(circle_at_82%_25%,rgba(45,87,132,.24),transparent_34rem)]" />
        <motion.div variants={fadeUp} className="relative z-10 self-center">
          <p className="text-xs font-black uppercase tracking-[.34em] text-[var(--gold)]">JG Creative Studio</p>
          <h1 className="mt-5 text-5xl font-black leading-[.94] tracking-[-.065em] sm:text-6xl xl:text-7xl">Premium websites.<span className="block text-[var(--gold)]">AI systems built for real business.</span></h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-[var(--muted)] sm:text-lg">JG Creative Studio builds high-performance websites, custom AI systems, automation, and business software that help companies attract customers, operate smarter, and grow.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row"><GoldButton href="/contact">Start a Project →</GoldButton><OutlineButton href="/#work">Explore Our Work</OutlineButton></div>
        </motion.div>
        <HeroCollage />
      </Section>

      <Section id="work" className="mx-auto max-w-[92rem] border-t border-white/[.06] px-6 py-20 sm:px-8 lg:px-10">
        <motion.p variants={fadeUp} className="text-xs font-black uppercase tracking-[.32em] text-[var(--gold)]">Selected Work</motion.p>
        <motion.h2 variants={fadeUp} className="mt-4 text-4xl font-black tracking-[-.055em] sm:text-6xl">Real products. Real results.</motion.h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[
            ["Premium Websites", "Premium websites built to convert visitors into customers.", "View Website Work", "/services", "Premium website showcase"],
            ["AI Systems", "AI assistants that answer, automate, and help your team move faster.", "View AI Systems", "/ai-tools", "AI systems showcase"],
            ["Custom Software", "Purpose-built tools that simplify operations and drive growth.", "View Custom Software", "/contact", "Custom software showcase"],
          ].map(([title, desc, cta, href, label]) => <motion.article variants={fadeUp} whileHover={{ y: -8 }} key={title} className="rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,.06),rgba(255,255,255,.02))] p-4 shadow-[0_30px_90px_rgba(0,0,0,.35)]"><ProductMedia alt={`${title} placeholder`} label={label} /><div className="p-3 pt-5"><h3 className="text-2xl font-black tracking-[-.04em]">{title}</h3><p className="mt-3 min-h-14 text-sm leading-6 text-[var(--muted)]">{desc}</p><Link href={href} className="mt-6 inline-flex text-sm font-black text-[var(--gold)]">{cta} →</Link></div></motion.article>)}
        </div>
      </Section>

      <Section className="mx-auto grid max-w-[92rem] gap-10 border-t border-white/[.06] px-6 py-20 sm:px-8 lg:grid-cols-[.85fr_1.15fr] lg:px-10">
        <motion.div variants={fadeUp} className="self-center">
          <p className="text-xs font-black uppercase tracking-[.32em] text-[var(--gold)]">AI Systems</p>
          <h2 className="mt-4 text-4xl font-black leading-[.96] tracking-[-.055em] sm:text-6xl">Smarter systems.<br />Stronger businesses.</h2>
          <div role="tablist" aria-label="AI system capabilities" className="mt-8 flex flex-wrap gap-2">
            {aiTabs.map((tab, i) => <button key={tab.id} id={`${tabRoot}-${tab.id}-tab`} role="tab" aria-selected={active === i} aria-controls={`${tabRoot}-${tab.id}-panel`} tabIndex={active === i ? 0 : -1} onClick={() => setActive(i)} className={`rounded-lg border px-4 py-2 text-xs font-black transition ${active === i ? "border-[var(--gold)] bg-[var(--gold)] text-[#06101f]" : "border-white/10 bg-white/[.03] text-white hover:border-[rgba(212,175,55,.42)]"}`}>{tab.label}</button>)}
          </div>
          <AnimatePresence mode="wait"><motion.div key={current.id} id={`${tabRoot}-${current.id}-panel`} role="tabpanel" aria-labelledby={`${tabRoot}-${current.id}-tab`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: .3 }} className="mt-8"><h3 className="text-2xl font-black tracking-[-.035em]">{current.heading}</h3><p className="mt-4 leading-7 text-[var(--muted)]">{current.description}</p><ul className="mt-6 grid gap-3">{current.lines.map(line => <li key={line} className="flex gap-3 text-sm font-bold text-slate-200"><span className="mt-1.5 h-2 w-2 rounded-full bg-[var(--gold)]" />{line}</li>)}</ul></motion.div></AnimatePresence>
          <div className="mt-8"><GoldButton href="/ai-tools">Explore AI Systems →</GoldButton></div>
        </motion.div>
        <motion.div variants={fadeUp}><AnimatePresence mode="wait"><motion.div key={current.mediaLabel} initial={{ opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.01 }} transition={{ duration: .35 }}><ProductMedia alt={`${current.mediaLabel} placeholder`} label={current.mediaLabel} ratio="aspect-[16/11]" className="rounded-[2.4rem] lg:mt-12" /></motion.div></AnimatePresence></motion.div>
      </Section>

      <Section className="mx-auto max-w-[92rem] border-t border-white/[.06] px-6 py-20 sm:px-8 lg:px-10">
        <motion.p variants={fadeUp} className="text-xs font-black uppercase tracking-[.32em] text-[var(--gold)]">Our Process</motion.p>
        <motion.h2 variants={fadeUp} className="mt-4 text-4xl font-black tracking-[-.055em] sm:text-6xl">From idea to impact.</motion.h2>
        <motion.div variants={fadeUp} className="relative mt-12 rounded-[2.4rem] border border-white/10 bg-[#071126] p-8 shadow-[0_34px_110px_rgba(0,0,0,.42)]">
          <motion.div initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 1.2, ease: "easeInOut" }} className="absolute left-12 right-12 top-[5.2rem] hidden h-px origin-left bg-[linear-gradient(90deg,transparent,#d4af37,transparent)] lg:block" />
          <div className="grid gap-7 lg:grid-cols-5">{processSteps.map((step, i) => <div key={step} className="relative flex gap-5 lg:block lg:text-center"><div className="z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[rgba(212,175,55,.5)] bg-[#08122a] font-black text-[var(--gold)] shadow-[0_0_34px_rgba(212,175,55,.22)]">0{i + 1}</div><div><h3 className="font-black text-white">{step}</h3><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{["We learn your business.", "We map the right system.", "We design and develop.", "We launch and refine.", "We improve what works."][i]}</p></div></div>)}</div>
          <div className="mt-14 overflow-hidden rounded-[2rem] border border-[rgba(212,175,55,.22)] bg-[radial-gradient(circle_at_80%_75%,rgba(245,158,11,.30),transparent_18rem),linear-gradient(145deg,rgba(17,27,72,.86),rgba(4,8,23,.96))] p-8 md:p-12"><div className="max-w-2xl"><h2 className="text-3xl font-black leading-tight tracking-[-.045em] sm:text-5xl">Ready to build something your business can actually use?</h2><p className="mt-4 leading-7 text-[var(--muted)]">Let’s build something useful, polished, and designed around the way your business works.</p><div className="mt-7 flex flex-col gap-3 sm:flex-row"><GoldButton href="/contact">Start a Project →</GoldButton><OutlineButton href="/#work">View Our Work</OutlineButton></div></div></div>
        </motion.div>
      </Section>

      <Section className="mx-auto max-w-[92rem] px-6 pb-24 sm:px-8 lg:px-10"><motion.div variants={fadeUp} className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-6 md:flex-row md:items-center"><p className="text-sm leading-6 text-[var(--muted)]"><span className="font-black text-white">Built by the team behind LEADFORGE.</span> Experience building full SaaS products, AI workflows, dashboards, and business systems.</p><a href={leadforgeUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-sm font-black text-[var(--gold)]">Explore LEADFORGE →</a></motion.div></Section>
    </main>
  );
}
