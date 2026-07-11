"use client";

import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import type { Variants } from "framer-motion";
import type { MouseEvent, ReactNode } from "react";
import { useState } from "react";

const leadforgeUrl = "https://leadforge.business/";

const reveal: Variants = {
  hidden: { opacity: 0, y: 34 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.82, ease: [0.22, 1, 0.36, 1] },
  },
};

const slowReveal: Variants = {
  hidden: { opacity: 0, y: 46, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 1, ease: [0.16, 1, 0.3, 1] },
  },
};

const products = [
  {
    name: "LeadForge",
    eyebrow: "A shipped product, not a promise",
    line: "Proof that the studio can design, engineer, and operate software with real workflow depth.",
    bullets: ["AI-assisted lead flow", "Business rules", "Billing foundation"],
    href: leadforgeUrl,
    cta: "Explore LEADFORGE",
    external: true,
    accent: "#d4af37",
    visual: "leadforge",
  },
  {
    name: "AI Copilot",
    eyebrow: "A business assistant layer",
    line: "A guided AI surface that captures context, answers with intent, and moves people to the right next step.",
    bullets: ["Knowledge mapping", "Visitor guidance", "Human handoff"],
    href: "/ai-tools",
    cta: "View AI systems",
    external: false,
    accent: "#7dd3fc",
    visual: "copilot",
  },
  {
    name: "Premium Websites",
    eyebrow: "A flagship web presence",
    line: "A polished site system where positioning, motion, layout, and conversion paths feel deliberately designed.",
    bullets: ["Art direction", "Offer clarity", "Launch polish"],
    href: "/services",
    cta: "View website work",
    external: false,
    accent: "#f59e0b",
    visual: "website",
  },
] as const;

const process = [
  {
    step: "01",
    title: "Find the leverage",
    text: "Clarify the business goal, the real user, and the work the system must remove.",
  },
  {
    step: "02",
    title: "Art direct the product",
    text: "Shape the first impression, flows, hierarchy, motion, and trust moments before engineering hardens them.",
  },
  {
    step: "03",
    title: "Build the logic",
    text: "Connect AI behavior, forms, state, data, billing paths, notifications, and business rules.",
  },
  {
    step: "04",
    title: "Ship with polish",
    text: "Refine the details, launch cleanly, and leave the business with something usable.",
  },
] as const;

function RevealSection({ children, className = "" }: { children: ReactNode; className?: string }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.section
      initial={prefersReducedMotion ? false : "hidden"}
      whileInView="show"
      viewport={{ once: true, margin: "-140px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.14 } } }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

function GlowOrb({ className = "", color = "rgba(212,175,55,0.24)" }: { className?: string; color?: string }) {
  return <div className={`pointer-events-none absolute rounded-full blur-3xl ${className}`} style={{ background: color }} />;
}

function ProductSurface({
  title,
  eyebrow,
  mode,
  compact = false,
}: {
  title: string;
  eyebrow: string;
  mode: "website" | "copilot" | "leadforge" | "portal" | "logic";
  compact?: boolean;
}) {
  const accent =
    mode === "copilot"
      ? "#7dd3fc"
      : mode === "portal"
        ? "#86efac"
        : mode === "logic"
          ? "#fb923c"
          : "#d4af37";

  return (
    <div className="group relative overflow-hidden rounded-[2rem] border border-white/12 bg-[linear-gradient(145deg,rgba(18,28,72,0.96),rgba(4,8,24,0.98))] shadow-[0_34px_100px_rgba(0,0,0,0.46),inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full opacity-30 blur-3xl" style={{ backgroundColor: accent }} />
      <div className="relative flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <p className="text-[0.6rem] font-black uppercase tracking-[0.24em] text-slate-400">{eyebrow}</p>
          <p className="mt-1 text-sm font-black uppercase tracking-[0.16em] text-white">{title}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-sm font-black" style={{ color: accent }}>
          ✦
        </div>
      </div>

      <div className={`relative grid gap-4 p-5 ${compact ? "min-h-44" : "min-h-64 md:grid-cols-[0.92fr_1.08fr]"}`}>
        <div className="relative overflow-hidden rounded-[1.45rem] bg-[linear-gradient(160deg,rgba(255,255,255,0.12),rgba(255,255,255,0.025))] p-5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(212,175,55,0.28),transparent_12rem)]" />
          <div className="relative">
            <div className="h-2 w-24 rounded-full bg-white/75" />
            <div className="mt-16 h-12 w-12 rounded-2xl" style={{ backgroundColor: accent }} />
            <div className="mt-5 h-2 w-4/5 rounded-full bg-white/50" />
            <div className="mt-3 h-2 w-3/5 rounded-full bg-white/20" />
            {!compact && <div className="mt-8 inline-flex rounded-full bg-white px-4 py-2 text-xs font-black text-[#061026]">Primary path</div>}
          </div>
        </div>

        <div className="grid gap-3">
          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.055] p-4">
            <div className="flex items-center gap-3">
              <span className="h-8 w-8 rounded-xl" style={{ backgroundColor: `${accent}dd` }} />
              <div className="flex-1">
                <div className="h-2 w-4/5 rounded-full bg-white/65" />
                <div className="mt-2 h-2 w-2/5 rounded-full bg-white/20" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="min-h-24 rounded-[1.35rem] border border-white/10 bg-white/[0.045] p-4">
              <div className="h-2 w-10 rounded-full" style={{ backgroundColor: accent }} />
              <div className="mt-9 h-2 w-4/5 rounded-full bg-white/25" />
              <div className="mt-2 h-2 w-3/5 rounded-full bg-white/15" />
            </div>
            <div className="min-h-24 rounded-[1.35rem] border border-white/10 bg-white/[0.045] p-4">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((item) => (
                  <span key={item} className="h-8 flex-1 rounded-lg bg-white/10" style={item === 1 ? { backgroundColor: `${accent}55` } : undefined} />
                ))}
              </div>
              <div className="mt-7 h-2 w-2/3 rounded-full bg-white/25" />
            </div>
          </div>
          {!compact && (
            <div className="relative h-14 overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.04]">
              <motion.div
                animate={{ x: ["-35%", "120%"] }}
                transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-1/2 h-px w-2/5 -translate-y-1/2"
                style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
              />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[length:22px_100%]" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HeroCollage() {
  const prefersReducedMotion = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const springX = useSpring(pointerX, { stiffness: 95, damping: 20 });
  const springY = useSpring(pointerY, { stiffness: 95, damping: 20 });
  const foregroundX = useTransform(springX, [-0.5, 0.5], [-24, 24]);
  const foregroundY = useTransform(springY, [-0.5, 0.5], [-18, 18]);
  const backgroundX = useTransform(foregroundX, (value) => value * -0.42);
  const backgroundY = useTransform(foregroundY, (value) => value * -0.35);

  function updatePointer(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - rect.left) / rect.width - 0.5);
    pointerY.set((event.clientY - rect.top) / rect.height - 0.5);
  }

  function resetPointer() {
    pointerX.set(0);
    pointerY.set(0);
  }

  return (
    <motion.div
      variants={slowReveal}
      onMouseMove={updatePointer}
      onMouseLeave={resetPointer}
      className="relative min-h-[40rem] lg:min-h-[48rem]"
    >
      <GlowOrb className="left-1/2 top-20 h-80 w-80 -translate-x-1/2" />
      <GlowOrb className="bottom-16 right-10 h-56 w-56" color="rgba(125,211,252,0.16)" />

      <motion.div
        style={prefersReducedMotion ? undefined : { x: backgroundX, y: backgroundY }}
        className="absolute left-0 top-8 w-[82%] -rotate-[4deg]"
      >
        <ProductSurface title="Premium website" eyebrow="Public face" mode="website" />
      </motion.div>

      <motion.div
        animate={prefersReducedMotion ? undefined : { y: [0, -16, 0] }}
        transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute right-0 top-36 w-[68%] rotate-[4deg]"
      >
        <ProductSurface title="AI copilot" eyebrow="Assistant layer" mode="copilot" compact />
      </motion.div>

      <motion.div
        style={prefersReducedMotion ? undefined : { x: foregroundX, y: foregroundY }}
        className="absolute left-8 top-72 w-[76%] -rotate-[1.5deg]"
      >
        <ProductSurface title="LEADFORGE" eyebrow="SaaS product" mode="leadforge" />
      </motion.div>

      <motion.div
        animate={prefersReducedMotion ? undefined : { y: [0, 12, 0] }}
        transition={{ duration: 8.6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-0 right-7 w-[56%] rotate-[6deg]"
      >
        <ProductSurface title="Internal portal" eyebrow="Operations" mode="portal" compact />
      </motion.div>

      <div className="absolute bottom-16 left-2 h-28 w-28 rounded-full border border-[rgba(212,175,55,0.25)] bg-[rgba(212,175,55,0.08)] shadow-[0_0_80px_rgba(212,175,55,0.18)]" />
    </motion.div>
  );
}

function ShowcaseStage({ activeIndex }: { activeIndex: number }) {
  const product = products[activeIndex];

  return (
    <div className="relative min-h-[38rem] overflow-hidden rounded-[3.4rem] border border-white/10 bg-[linear-gradient(145deg,#101842,#040817)] p-5 shadow-[0_44px_130px_rgba(0,0,0,0.52)]">
      <GlowOrb className="left-1/2 top-16 h-80 w-80 -translate-x-1/2" color={`${product.accent}33`} />
      <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent,rgba(255,255,255,0.055),transparent)]" />

      <AnimatePresence mode="wait">
        <motion.div
          key={product.name}
          initial={{ opacity: 0, scale: 0.965, rotate: -0.8 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          exit={{ opacity: 0, scale: 1.025, rotate: 0.8 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-5"
        >
          <div className="absolute left-0 top-10 w-[76%] -rotate-2">
            <ProductSurface
              title={product.name}
              eyebrow={product.eyebrow}
              mode={product.visual === "copilot" ? "copilot" : product.visual === "website" ? "website" : "leadforge"}
            />
          </div>

          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.12, duration: 0.55 }}
            className="absolute bottom-4 right-0 w-[66%] rotate-[2.5deg] rounded-[2.35rem] border border-white/12 bg-[rgba(3,7,22,0.76)] p-6 shadow-[0_34px_110px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          >
            <p className="text-xs font-black uppercase tracking-[0.24em]" style={{ color: product.accent }}>
              Product cutaway
            </p>
            <div className="mt-7 grid gap-3 md:grid-cols-3">
              {product.bullets.map((bullet, index) => (
                <motion.div
                  key={bullet}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + index * 0.08 }}
                  className="rounded-2xl border border-white/10 bg-white/[0.055] p-4"
                >
                  <span className="block h-1.5 w-10 rounded-full" style={{ backgroundColor: product.accent }} />
                  <span className="mt-6 block text-sm font-black text-white">{bullet}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function ProductLink({ product }: { product: (typeof products)[number] }) {
  if (product.external) {
    return (
      <a href={product.href} target="_blank" rel="noopener noreferrer" className="mt-8 inline-flex font-black text-[var(--gold)]">
        {product.cta} →
      </a>
    );
  }

  return (
    <Link href={product.href} className="mt-8 inline-flex font-black text-[var(--gold)]">
      {product.cta} →
    </Link>
  );
}

function LeadForgeProofWall() {
  const proofItems = ["AI", "Product design", "Complex workflows", "Billing", "Architecture", "Business logic"];

  return (
    <div className="relative min-h-[39rem] overflow-hidden rounded-[3.4rem] border border-white/10 bg-[linear-gradient(145deg,#0e173c,#040817)] p-6 shadow-[0_44px_130px_rgba(0,0,0,0.48)]">
      <GlowOrb className="right-10 top-8 h-72 w-72" />
      <div className="absolute left-8 top-10 w-[72%] -rotate-2">
        <ProductSurface title="LeadForge workspace" eyebrow="Live SaaS surface" mode="leadforge" />
      </div>
      <div className="absolute bottom-8 right-7 w-[64%] rotate-3 rounded-[2.5rem] border border-white/12 bg-[rgba(5,10,30,0.82)] p-6 shadow-[0_36px_110px_rgba(0,0,0,0.52)] backdrop-blur-xl">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--gold)]">What had to work</p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {proofItems.map((item, index) => (
            <motion.div
              key={item}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.06 }}
              className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-5 text-sm font-black text-white"
            >
              {item}
            </motion.div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-14 left-10 hidden h-28 w-28 rounded-[2rem] border border-[rgba(212,175,55,0.26)] bg-[rgba(212,175,55,0.09)] md:block" />
    </div>
  );
}

function ProcessConstellation() {
  return (
    <div className="relative min-h-[44rem] overflow-hidden rounded-[3.4rem] border border-white/10 bg-[radial-gradient(circle_at_50%_45%,rgba(212,175,55,0.14),transparent_24rem),linear-gradient(145deg,#0c1437,#040817)] p-6 shadow-[0_44px_130px_rgba(0,0,0,0.48)]">
      <motion.div
        initial={{ pathLength: 0, opacity: 0.5 }}
        whileInView={{ pathLength: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.4, ease: "easeInOut" }}
        className="absolute inset-0"
      >
        <svg className="h-full w-full" viewBox="0 0 1000 620" fill="none" preserveAspectRatio="none">
          <motion.path
            d="M110 145 C245 64 318 520 462 385 C608 247 640 92 774 169 C882 231 797 505 910 472"
            stroke="url(#processGradient)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray="14 18"
          />
          <defs>
            <linearGradient id="processGradient" x1="90" y1="150" x2="920" y2="470" gradientUnits="userSpaceOnUse">
              <stop stopColor="#d4af37" />
              <stop offset="0.48" stopColor="#7dd3fc" />
              <stop offset="1" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
        </svg>
      </motion.div>

      {process.map((item, index) => {
        const position =
          index === 0
            ? "left-[5%] top-[8%]"
            : index === 1
              ? "left-[25%] bottom-[11%]"
              : index === 2
                ? "right-[28%] top-[10%]"
                : "right-[5%] bottom-[13%]";

        return (
          <motion.article
            key={item.title}
            variants={reveal}
            whileHover={{ y: -10, scale: 1.025 }}
            className={`absolute w-[18rem] rounded-[2.15rem] border border-white/10 bg-[rgba(255,255,255,0.055)] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.4)] backdrop-blur-xl ${position}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-[var(--gold)]">{item.step}</span>
              <span className="h-3 w-3 rounded-full bg-[var(--gold)] shadow-[0_0_30px_rgba(212,175,55,0.7)]" />
            </div>
            <h3 className="mt-8 text-2xl font-black tracking-[-0.03em] text-white">{item.title}</h3>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{item.text}</p>
            <div className="mt-7 h-24 rounded-[1.5rem] bg-[radial-gradient(circle_at_35%_20%,rgba(212,175,55,0.2),transparent),rgba(255,255,255,0.04)]" />
          </motion.article>
        );
      })}
    </div>
  );
}

function FinalVisual() {
  return (
    <div className="mx-auto mb-11 grid max-w-4xl gap-4 md:grid-cols-[0.95fr_1.1fr_0.95fr]">
      <motion.div variants={reveal} className="hidden translate-y-8 rounded-[2rem] border border-white/10 bg-white/[0.045] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.32)] md:block">
        <ProductSurface title="Website" eyebrow="Launch" mode="website" compact />
      </motion.div>
      <motion.div variants={reveal} className="rounded-[2.4rem] border border-[rgba(212,175,55,0.24)] bg-[rgba(212,175,55,0.08)] p-4 shadow-[0_34px_110px_rgba(0,0,0,0.45)]">
        <ProductSurface title="System" eyebrow="Built around the business" mode="leadforge" compact />
      </motion.div>
      <motion.div variants={reveal} className="hidden translate-y-8 rounded-[2rem] border border-white/10 bg-white/[0.045] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.32)] md:block">
        <ProductSurface title="AI" eyebrow="Assistant" mode="copilot" compact />
      </motion.div>
    </div>
  );
}

export default function HomePage() {
  const [activeProduct, setActiveProduct] = useState(0);
  const active = products[activeProduct];
  return (
    <main className="overflow-x-hidden bg-[#040817] text-white">
      <RevealSection className="relative mx-auto grid max-w-[94rem] gap-12 px-6 pb-28 pt-20 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:px-10 lg:pt-28">
        <div className="absolute inset-x-0 top-0 h-[48rem] bg-[radial-gradient(circle_at_14%_18%,rgba(212,175,55,0.17),transparent_32rem),radial-gradient(circle_at_82%_28%,rgba(125,211,252,0.12),transparent_30rem)]" />
        <motion.div variants={reveal} className="relative z-10 self-center">
          <p className="text-xs font-black uppercase tracking-[0.34em] text-[var(--gold)]">JG Creative Studio</p>
          <h1 className="mt-6 text-5xl font-black leading-[0.92] tracking-[-0.07em] sm:text-6xl lg:text-7xl xl:text-8xl">
            Premium websites.
            <span className="block bg-[linear-gradient(180deg,#fff_18%,#d4af37_92%)] bg-clip-text text-transparent">
              AI systems built for real business.
            </span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-[var(--muted)]">
            We build the public face, the AI layer, and the internal systems that make a business feel sharper from the first click to the back office.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link href="/contact" className="rounded-2xl bg-[linear-gradient(180deg,#e2be48,#b78b1f)] px-7 py-4 text-center text-sm font-black text-[#07101f] shadow-[0_22px_60px_rgba(212,175,55,0.26)] transition hover:-translate-y-1">
              Start Project
            </Link>
            <a href={leadforgeUrl} target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-[rgba(212,175,55,0.38)] bg-white/[0.04] px-7 py-4 text-center text-sm font-black transition hover:-translate-y-1 hover:bg-white/[0.075]">
              Explore LEADFORGE
            </a>
          </div>
        </motion.div>
        <HeroCollage />
      </RevealSection>

      <RevealSection className="mx-auto grid max-w-[94rem] gap-12 px-6 py-24 sm:px-8 lg:grid-cols-[1.12fr_0.88fr] lg:px-10">
        <motion.div variants={slowReveal}>
          <ShowcaseStage activeIndex={activeProduct} />
        </motion.div>
        <div className="self-center">
          <motion.p variants={reveal} className="text-xs font-black uppercase tracking-[0.28em] text-[var(--gold)]">Three product reveals</motion.p>
          <AnimatePresence mode="wait">
            <motion.div
              key={active.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.38 }}
            >
              <h2 className="mt-5 text-4xl font-black tracking-[-0.05em] sm:text-6xl">{active.name}</h2>
              <p className="mt-5 text-lg leading-8 text-[var(--muted)]">{active.line}</p>
              <ul className="mt-7 space-y-3">
                {active.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-center gap-3 font-bold text-slate-100">
                    <span className="h-1.5 w-10 rounded-full" style={{ backgroundColor: active.accent }} />
                    {bullet}
                  </li>
                ))}
              </ul>
              <ProductLink product={active} />
            </motion.div>
          </AnimatePresence>

          <motion.div variants={reveal} className="mt-10 grid gap-3" role="tablist" aria-label="Product showcase">
            {products.map((product, index) => (
              <button
                key={product.name}
                type="button"
                role="tab"
                aria-selected={activeProduct === index}
                onClick={() => setActiveProduct(index)}
                className={`group relative overflow-hidden rounded-[1.35rem] border px-5 py-4 text-left transition ${
                  activeProduct === index
                    ? "border-[rgba(212,175,55,0.55)] bg-[rgba(212,175,55,0.10)]"
                    : "border-white/10 bg-white/[0.025] hover:bg-white/[0.06]"
                }`}
              >
                <span className="relative z-10 flex items-center justify-between gap-4">
                  <span>
                    <span className="block text-sm font-black uppercase tracking-[0.18em] text-white">{product.name}</span>
                    <span className="mt-1 block text-xs font-semibold text-[var(--muted)]">{product.eyebrow}</span>
                  </span>
                  <span className="text-[var(--gold)] transition group-hover:translate-x-1">↗</span>
                </span>
              </button>
            ))}
          </motion.div>
        </div>
      </RevealSection>

      <RevealSection className="mx-auto grid max-w-[94rem] gap-12 px-6 py-24 sm:px-8 lg:grid-cols-[0.86fr_1.14fr] lg:px-10">
        <div className="self-center lg:order-2">
          <motion.p variants={reveal} className="text-xs font-black uppercase tracking-[0.28em] text-[var(--gold)]">Why trust us</motion.p>
          <motion.h2 variants={reveal} className="mt-5 text-4xl font-black tracking-[-0.05em] sm:text-6xl">
            Built by the team behind LEADFORGE.
          </motion.h2>
          <motion.p variants={reveal} className="mt-6 text-lg leading-8 text-[var(--muted)]">
            LEADFORGE exists, and building it required AI, product design, complex workflows, billing, architecture, and business logic working together inside one usable product.
          </motion.p>
          <motion.a variants={reveal} href={leadforgeUrl} target="_blank" rel="noopener noreferrer" className="mt-8 inline-flex rounded-2xl bg-[var(--gold)] px-6 py-4 font-black text-[#07101f] shadow-[0_20px_55px_rgba(212,175,55,0.22)] transition hover:-translate-y-1">
            See the product
          </motion.a>
        </div>
        <motion.div variants={slowReveal} className="lg:order-1">
          <LeadForgeProofWall />
        </motion.div>
      </RevealSection>

      <RevealSection className="relative mx-auto max-w-[94rem] px-6 py-24 sm:px-8 lg:px-10">
        <motion.div variants={reveal} className="mb-14 grid gap-6 md:grid-cols-[1fr_0.52fr] md:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[var(--gold)]">Process</p>
            <h2 className="mt-4 max-w-4xl text-4xl font-black tracking-[-0.05em] sm:text-6xl">
              A connected journey, not a row of service cards.
            </h2>
          </div>
          <p className="text-lg leading-8 text-[var(--muted)]">
            The shape changes as the work moves from strategy to interface to logic to launch.
          </p>
        </motion.div>
        <motion.div variants={slowReveal}>
          <ProcessConstellation />
        </motion.div>
      </RevealSection>

      <RevealSection className="mx-auto max-w-[94rem] px-6 pb-28 pt-12 sm:px-8 lg:px-10">
        <motion.div variants={slowReveal} className="relative overflow-hidden rounded-[3.5rem] border border-[rgba(212,175,55,0.32)] bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,0.25),transparent_32rem),linear-gradient(145deg,#111b48,#040817)] p-8 text-center shadow-[0_50px_150px_rgba(0,0,0,0.54)] sm:p-14">
          <GlowOrb className="left-1/2 top-0 h-80 w-80 -translate-x-1/2" />
          <FinalVisual />
          <h2 className="mx-auto max-w-4xl text-4xl font-black tracking-[-0.055em] sm:text-6xl">
            Build the thing your business actually needs.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[var(--muted)]">
            A sharper website. A practical AI system. Software your team can run on.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/contact" className="rounded-2xl bg-[var(--gold)] px-7 py-4 font-black text-[#07101f] transition hover:-translate-y-1">
              Start Project
            </Link>
            <a href={leadforgeUrl} target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-white/10 px-7 py-4 font-black transition hover:-translate-y-1 hover:bg-white/[0.06]">
              Explore LEADFORGE
            </a>
          </div>
        </motion.div>
      </RevealSection>
    </main>
  );
}
