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
  hidden: { opacity: 0, y: 36 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.78, ease: [0.16, 1, 0.3, 1] },
  },
};

const heroReveal: Variants = {
  hidden: { opacity: 0, y: 52, scale: 0.985 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 1.05, ease: [0.16, 1, 0.3, 1] },
  },
};

const products = [
  {
    name: "LeadForge",
    kicker: "Proof that ships",
    statement: "A real product surface for lead capture, AI-assisted workflow, accounts, billing foundations, and business rules.",
    points: ["AI workflow", "Billing logic", "Product architecture"],
    href: leadforgeUrl,
    cta: "Explore LEADFORGE",
    external: true,
    accent: "#d4af37",
    gradient: "from-[#d4af37]/35 via-[#111b48] to-[#040817]",
  },
  {
    name: "AI Copilot",
    kicker: "Answers with intent",
    statement: "A custom assistant layer that understands the business, captures context, and hands off cleanly when a person should step in.",
    points: ["Knowledge design", "Context capture", "Human handoff"],
    href: "/ai-tools",
    cta: "View AI systems",
    external: false,
    accent: "#7dd3fc",
    gradient: "from-sky-300/30 via-[#101a44] to-[#040817]",
  },
  {
    name: "Premium Websites",
    kicker: "Positioning made visible",
    statement: "A flagship web presence with clear hierarchy, deliberate motion, strong conversion paths, and a visual system that feels owned.",
    points: ["Art direction", "Offer clarity", "Launch polish"],
    href: "/services",
    cta: "View website work",
    external: false,
    accent: "#f59e0b",
    gradient: "from-amber-500/30 via-[#12173d] to-[#040817]",
  },
] as const;

const processSteps = [
  ["01", "Read the business", "Customers, constraints, revenue paths, and the friction slowing the work down."],
  ["02", "Design the product moment", "The first impression, the key flow, the trust cues, and the interface language."],
  ["03", "Engineer the system", "AI behavior, forms, automations, data, billing paths, and business logic."],
  ["04", "Launch it clean", "Polish, QA, deployment, handoff, and the details that make it feel finished."],
] as const;

function Section({ children, className = "" }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();

  return (
    <motion.section
      initial={reduce ? false : "hidden"}
      whileInView="show"
      viewport={{ once: true, margin: "-120px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.14 } } }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

function Halo({ className, color = "rgba(212,175,55,0.2)" }: { className: string; color?: string }) {
  return <div className={`pointer-events-none absolute rounded-full blur-3xl ${className}`} style={{ backgroundColor: color }} />;
}

function ProductPoster({
  title,
  label,
  accent = "#d4af37",
  children,
  className = "",
}: {
  title: string;
  label: string;
  accent?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[2.4rem] border border-white/12 bg-[linear-gradient(145deg,rgba(255,255,255,0.10),rgba(255,255,255,0.025))] p-6 shadow-[0_32px_90px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur ${className}`}
    >
      <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full opacity-25 blur-3xl" style={{ backgroundColor: accent }} />
      <p className="relative text-[0.66rem] font-black uppercase tracking-[0.28em] text-slate-300">{label}</p>
      <h3 className="relative mt-2 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">{title}</h3>
      <div className="relative mt-8">{children}</div>
    </div>
  );
}

function WebsiteSlice({ accent = "#d4af37" }: { accent?: string }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-[1.05fr_0.95fr]">
        <div className="min-h-48 rounded-[2rem] bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.22),transparent_18rem),rgba(255,255,255,0.055)] p-5">
          <span className="block text-xs font-black uppercase tracking-[0.18em]" style={{ color: accent }}>Above the fold</span>
          <p className="mt-16 max-w-xs text-3xl font-black leading-[0.95] tracking-[-0.05em] text-white">Clear offer. Immediate trust.</p>
        </div>
        <div className="grid gap-4">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.05] p-5">
            <p className="text-sm font-bold text-slate-300">Positioning</p>
            <p className="mt-3 text-xl font-black text-white">Built to explain the business fast.</p>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.05] p-5">
            <p className="text-sm font-bold text-slate-300">Conversion path</p>
            <p className="mt-3 text-xl font-black text-white">Inquiry without friction.</p>
          </div>
        </div>
      </div>
      <div className="h-2 rounded-full bg-white/10">
        <div className="h-full w-2/3 rounded-full" style={{ backgroundColor: accent }} />
      </div>
    </div>
  );
}

function CopilotSlice({ accent = "#7dd3fc" }: { accent?: string }) {
  const messages = [
    ["Visitor", "Can you help me decide what to build?"],
    ["Copilot", "Yes. I’ll capture the goal, budget signal, timeline, and route the next step."],
    ["Visitor", "We need faster response from the website."],
  ];

  return (
    <div className="grid gap-5 md:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5">
        <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: accent }}>Conversation design</p>
        <div className="mt-7 space-y-4">
          {messages.map(([speaker, text], index) => (
            <div key={text} className={`${index === 1 ? "ml-8" : "mr-8"} rounded-2xl bg-white/[0.07] p-4`}>
              <p className="text-[0.65rem] font-black uppercase tracking-[0.18em]" style={{ color: index === 1 ? accent : "#d4af37" }}>{speaker}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-white">{text}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="grid content-center gap-4">
        {['Knowledge base', 'Project intake', 'Human handoff'].map((item) => (
          <div key={item} className="rounded-[1.5rem] border border-white/10 bg-white/[0.05] p-5">
            <span className="block h-1.5 w-14 rounded-full" style={{ backgroundColor: accent }} />
            <p className="mt-5 text-xl font-black text-white">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeadForgeSlice({ accent = "#d4af37" }: { accent?: string }) {
  return (
    <div className="relative min-h-72">
      <div className="absolute left-0 top-0 w-[62%] rounded-[2rem] border border-white/10 bg-white/[0.055] p-6">
        <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: accent }}>LeadForge</p>
        <p className="mt-16 text-4xl font-black tracking-[-0.06em] text-white">Lead flow → AI → Action</p>
      </div>
      <div className="absolute right-0 top-14 w-[52%] rounded-[2rem] border border-white/10 bg-[#060b1f]/90 p-6 shadow-[0_28px_80px_rgba(0,0,0,0.4)]">
        {['Capture', 'Qualify', 'Route', 'Follow up'].map((item) => (
          <div key={item} className="flex items-center gap-4 border-b border-white/10 py-4 last:border-0">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: accent }} />
            <span className="font-black text-white">{item}</span>
          </div>
        ))}
      </div>
      <div className="absolute bottom-0 left-[18%] rounded-full border border-[rgba(212,175,55,0.35)] bg-[rgba(212,175,55,0.12)] px-6 py-3 text-sm font-black text-[var(--gold)]">
        real product proof
      </div>
    </div>
  );
}

function HeroProductStack() {
  const reduce = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const springX = useSpring(pointerX, { stiffness: 80, damping: 18 });
  const springY = useSpring(pointerY, { stiffness: 80, damping: 18 });
  const frontX = useTransform(springX, [-0.5, 0.5], [-26, 26]);
  const frontY = useTransform(springY, [-0.5, 0.5], [-20, 20]);
  const backX = useTransform(frontX, (value) => value * -0.35);
  const backY = useTransform(frontY, (value) => value * -0.3);

  function onMove(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - rect.left) / rect.width - 0.5);
    pointerY.set((event.clientY - rect.top) / rect.height - 0.5);
  }

  return (
    <motion.div
      variants={heroReveal}
      onMouseMove={onMove}
      onMouseLeave={() => {
        pointerX.set(0);
        pointerY.set(0);
      }}
      className="relative min-h-[42rem] lg:min-h-[50rem]"
    >
      <Halo className="left-1/2 top-28 h-96 w-96 -translate-x-1/2" />
      <motion.div style={reduce ? undefined : { x: backX, y: backY }} className="absolute left-0 top-12 w-[84%] -rotate-6">
        <ProductPoster title="Premium Website" label="Public product surface" className="bg-[#10183d]/85">
          <WebsiteSlice />
        </ProductPoster>
      </motion.div>
      <motion.div
        animate={reduce ? undefined : { y: [0, -16, 0] }}
        transition={{ duration: 7.2, repeat: Infinity, ease: "easeInOut" }}
        className="absolute right-0 top-48 w-[66%] rotate-3"
      >
        <ProductPoster title="AI Copilot" label="Decision support" accent="#7dd3fc">
          <CopilotSlice accent="#7dd3fc" />
        </ProductPoster>
      </motion.div>
      <motion.div style={reduce ? undefined : { x: frontX, y: frontY }} className="absolute bottom-0 left-10 w-[76%] -rotate-1">
        <ProductPoster title="LEADFORGE" label="Shipped SaaS product">
          <LeadForgeSlice />
        </ProductPoster>
      </motion.div>
    </motion.div>
  );
}

function ProductStage({ active }: { active: number }) {
  const product = products[active];

  return (
    <div className={`relative min-h-[44rem] overflow-hidden rounded-[3.5rem] border border-white/10 bg-gradient-to-br ${product.gradient} p-6 shadow-[0_42px_130px_rgba(0,0,0,0.52)]`}>
      <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] [background-size:72px_72px]" />
      <div className="absolute bottom-[-5rem] left-1/2 text-[10rem] font-black uppercase leading-none tracking-[-0.09em] text-white/[0.035] sm:text-[14rem] lg:text-[17rem]">
        {product.name}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={product.name}
          initial={{ opacity: 0, y: 26, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -26, scale: 1.02 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 grid min-h-[40rem] content-center"
        >
          {active === 0 && <LeadForgeSlice accent={product.accent} />}
          {active === 1 && <CopilotSlice accent={product.accent} />}
          {active === 2 && <WebsiteSlice accent={product.accent} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function ProductCta({ product }: { product: (typeof products)[number] }) {
  const className = "inline-flex rounded-full border border-white/15 px-6 py-3 text-sm font-black text-white transition hover:-translate-y-1 hover:border-[var(--gold)]";

  return product.external ? (
    <a href={product.href} target="_blank" rel="noopener noreferrer" className={className}>{product.cta}</a>
  ) : (
    <Link href={product.href} className={className}>{product.cta}</Link>
  );
}

function LeadForgeProofComposition() {
  return (
    <div className="relative min-h-[44rem] overflow-hidden rounded-[3.5rem] border border-[rgba(212,175,55,0.22)] bg-[radial-gradient(circle_at_40%_25%,rgba(212,175,55,0.2),transparent_25rem),linear-gradient(145deg,#12183b,#040817)] p-8 shadow-[0_44px_130px_rgba(0,0,0,0.5)]">
      <div className="absolute left-1/2 top-16 h-72 w-72 -translate-x-1/2 rounded-full border border-[rgba(212,175,55,0.18)]" />
      <div className="absolute left-[18%] top-[18%] h-32 w-32 rounded-full bg-[rgba(212,175,55,0.12)] blur-xl" />
      <div className="absolute bottom-[20%] right-[12%] h-40 w-40 rounded-full bg-sky-300/10 blur-2xl" />
      <div className="relative z-10 mx-auto flex min-h-[38rem] max-w-3xl flex-col items-center justify-center text-center">
        <p className="text-xs font-black uppercase tracking-[0.34em] text-[var(--gold)]">Live proof</p>
        <p className="mt-8 text-6xl font-black uppercase leading-[0.82] tracking-[-0.08em] text-white sm:text-8xl lg:text-9xl">Lead<br />Forge</p>
        <div className="mt-10 grid w-full gap-3 sm:grid-cols-3">
          {['AI', 'Billing', 'Workflows', 'Architecture', 'Business logic', 'Product design'].map((item) => (
            <div key={item} className="rounded-full border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-black text-white backdrop-blur">
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProcessRibbon() {
  return (
    <div className="relative overflow-hidden rounded-[3.5rem] border border-white/10 bg-[#080e27] p-8 shadow-[0_44px_130px_rgba(0,0,0,0.46)] lg:p-12">
      <svg className="absolute inset-0 h-full w-full opacity-70" viewBox="0 0 1200 620" fill="none" preserveAspectRatio="none">
        <motion.path
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          d="M80 420 C220 160 390 520 540 295 C720 20 820 465 1110 180"
          stroke="url(#ribbon)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="ribbon" x1="80" y1="420" x2="1110" y2="180" gradientUnits="userSpaceOnUse">
            <stop stopColor="#d4af37" />
            <stop offset="0.5" stopColor="#7dd3fc" />
            <stop offset="1" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
      </svg>
      <div className="relative z-10 grid gap-6 lg:grid-cols-4">
        {processSteps.map(([number, title, text], index) => (
          <motion.div key={title} variants={reveal} className={`${index % 2 ? 'lg:mt-56' : 'lg:mb-56'} min-h-72 rounded-[2rem] border border-white/10 bg-[rgba(255,255,255,0.055)] p-6 backdrop-blur-xl`}>
            <p className="text-sm font-black text-[var(--gold)]">{number}</p>
            <h3 className="mt-8 text-3xl font-black leading-none tracking-[-0.05em] text-white">{title}</h3>
            <p className="mt-5 text-sm leading-7 text-[var(--muted)]">{text}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const [active, setActive] = useState(0);
  const product = products[active];

  return (
    <main className="overflow-hidden bg-[#040817] text-white">
      <Section className="relative mx-auto grid max-w-[94rem] gap-12 px-6 pb-28 pt-20 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:px-10 lg:pt-28">
        <div className="absolute inset-x-0 top-0 h-[48rem] bg-[radial-gradient(circle_at_18%_20%,rgba(212,175,55,0.18),transparent_32rem),radial-gradient(circle_at_82%_24%,rgba(125,211,252,0.12),transparent_31rem)]" />
        <motion.div variants={reveal} className="relative z-10 self-center">
          <p className="text-xs font-black uppercase tracking-[0.36em] text-[var(--gold)]">JG Creative Studio</p>
          <h1 className="mt-6 text-5xl font-black leading-[0.92] tracking-[-0.075em] sm:text-6xl lg:text-7xl xl:text-8xl">
            Premium websites.
            <span className="block bg-[linear-gradient(180deg,#fff_10%,#d4af37_92%)] bg-clip-text text-transparent">
              AI systems built for real business.
            </span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-[var(--muted)]">
            We build polished web products, practical AI assistants, and custom business systems that make companies easier to trust and easier to operate.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link href="/contact" className="rounded-full bg-[linear-gradient(180deg,#e4c04a,#b78b1f)] px-7 py-4 text-center text-sm font-black text-[#07101f] shadow-[0_22px_60px_rgba(212,175,55,0.26)] transition hover:-translate-y-1">Start Project</Link>
            <a href={leadforgeUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-[rgba(212,175,55,0.38)] bg-white/[0.04] px-7 py-4 text-center text-sm font-black transition hover:-translate-y-1 hover:bg-white/[0.075]">Explore LEADFORGE</a>
          </div>
        </motion.div>
        <HeroProductStack />
      </Section>

      <Section className="mx-auto max-w-[94rem] px-6 py-24 sm:px-8 lg:px-10">
        <motion.div variants={reveal} className="mb-10 grid gap-6 lg:grid-cols-[0.72fr_1fr] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.32em] text-[var(--gold)]">Showcase</p>
            <h2 className="mt-5 text-4xl font-black tracking-[-0.055em] sm:text-6xl">Three real things we build.</h2>
          </div>
          <p className="max-w-2xl text-lg leading-8 text-[var(--muted)]">Each reveal changes the product surface, the motion, and the proof points—without turning the homepage into a service-card grid.</p>
        </motion.div>
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div variants={heroReveal}><ProductStage active={active} /></motion.div>
          <motion.div variants={reveal} className="self-center">
            <AnimatePresence mode="wait">
              <motion.div key={product.name} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} transition={{ duration: 0.35 }}>
                <p className="text-xs font-black uppercase tracking-[0.28em]" style={{ color: product.accent }}>{product.kicker}</p>
                <h3 className="mt-5 text-5xl font-black tracking-[-0.06em] sm:text-7xl">{product.name}</h3>
                <p className="mt-6 text-lg leading-8 text-[var(--muted)]">{product.statement}</p>
                <div className="mt-8 flex flex-wrap gap-3">
                  {product.points.map((point) => <span key={point} className="rounded-full border border-white/10 bg-white/[0.055] px-4 py-2 text-sm font-black text-white">{point}</span>)}
                </div>
                <div className="mt-8"><ProductCta product={product} /></div>
              </motion.div>
            </AnimatePresence>
            <div className="mt-12 flex gap-3 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Product showcase">
              {products.map((item, index) => (
                <button
                  key={item.name}
                  type="button"
                  role="tab"
                  aria-selected={active === index}
                  onClick={() => setActive(index)}
                  className={`shrink-0 rounded-full border px-5 py-3 text-sm font-black transition ${active === index ? 'border-[rgba(212,175,55,0.55)] bg-[rgba(212,175,55,0.14)] text-white' : 'border-white/10 bg-white/[0.035] text-slate-300 hover:bg-white/[0.07]'}`}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </Section>

      <Section className="mx-auto grid max-w-[94rem] gap-12 px-6 py-24 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:px-10">
        <motion.div variants={heroReveal}>
          <LeadForgeProofComposition />
        </motion.div>
        <motion.div variants={reveal} className="self-center lg:pl-8">
          <p className="text-xs font-black uppercase tracking-[0.32em] text-[var(--gold)]">Why trust us</p>
          <h2 className="mt-5 text-4xl font-black leading-[0.95] tracking-[-0.06em] sm:text-6xl">LeadForge is the receipt.</h2>
          <p className="mt-6 text-lg leading-8 text-[var(--muted)]">Building it required AI, product design, complex workflows, billing, architecture, and business logic—not just a pretty marketing page.</p>
          <a href={leadforgeUrl} target="_blank" rel="noopener noreferrer" className="mt-9 inline-flex rounded-full bg-[var(--gold)] px-7 py-4 font-black text-[#07101f] transition hover:-translate-y-1">See LeadForge</a>
        </motion.div>
      </Section>

      <Section className="mx-auto max-w-[94rem] px-6 py-24 sm:px-8 lg:px-10">
        <motion.div variants={reveal} className="mb-12 max-w-4xl">
          <p className="text-xs font-black uppercase tracking-[0.32em] text-[var(--gold)]">Process</p>
          <h2 className="mt-5 text-4xl font-black leading-[0.95] tracking-[-0.06em] sm:text-6xl">From rough idea to useful system.</h2>
        </motion.div>
        <motion.div variants={heroReveal}><ProcessRibbon /></motion.div>
      </Section>

      <Section className="mx-auto max-w-[94rem] px-6 pb-28 pt-12 sm:px-8 lg:px-10">
        <motion.div variants={heroReveal} className="relative overflow-hidden rounded-[3.5rem] border border-[rgba(212,175,55,0.28)] bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,0.22),transparent_34rem),linear-gradient(145deg,#111b48,#040817)] px-7 py-16 text-center shadow-[0_50px_150px_rgba(0,0,0,0.54)] sm:px-12 sm:py-20">
          <Halo className="left-1/2 top-0 h-96 w-96 -translate-x-1/2" />
          <p className="relative text-xs font-black uppercase tracking-[0.34em] text-[var(--gold)]">Ready when you are</p>
          <h2 className="relative mx-auto mt-7 max-w-5xl text-5xl font-black leading-[0.92] tracking-[-0.075em] sm:text-7xl lg:text-8xl">Build something your business can run on.</h2>
          <p className="relative mx-auto mt-7 max-w-2xl text-lg leading-8 text-[var(--muted)]">No buzzwords. No template theater. Just the right product, built cleanly.</p>
          <div className="relative mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/contact" className="rounded-full bg-[var(--gold)] px-7 py-4 font-black text-[#07101f] transition hover:-translate-y-1">Start Project</Link>
            <a href={leadforgeUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/10 px-7 py-4 font-black transition hover:-translate-y-1 hover:bg-white/[0.06]">Explore LEADFORGE</a>
          </div>
        </motion.div>
      </Section>
    </main>
  );
}
