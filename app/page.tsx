"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

const leadforgeUrl = "https://leadforge.business/";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0 },
};

const showcase = [
  {
    name: "LEADFORGE",
    purpose: "A full SaaS product proving the studio can ship serious business software, not just marketing pages.",
    built: ["Product interface design", "AI-assisted lead workflows", "Account systems", "SaaS-ready architecture"],
    cta: "Explore LEADFORGE",
    href: leadforgeUrl,
    external: true,
    tone: "from-[#d4af37]/20",
  },
  {
    name: "AI Copilot",
    purpose: "Business assistants that answer questions, guide visitors, and help teams respond with clearer context.",
    built: ["Conversation design", "Knowledge workflows", "Lead handoff paths", "Business-specific prompts"],
    cta: "View AI Systems",
    href: "/ai-tools",
    external: false,
    tone: "from-[#38bdf8]/14",
  },
  {
    name: "Premium Business Websites",
    purpose: "High-end websites designed around positioning, trust, conversion, and a cleaner customer journey.",
    built: ["Custom responsive design", "Offer architecture", "Service journeys", "Polished launch pages"],
    cta: "View Website Services",
    href: "/services",
    external: false,
    tone: "from-[#f59e0b]/16",
  },
];

const capabilities = [
  {
    label: "Websites",
    title: "A sharper path from first impression to inquiry.",
    description: "Premium pages with clear positioning, deliberate sections, strong calls to action, and visual systems that make the business feel established.",
    examples: ["Service page systems", "Conversion-focused landing pages", "Brand-led launch sites"],
    preview: "website",
  },
  {
    label: "AI Copilots",
    title: "Faster answers without losing the human handoff.",
    description: "Custom assistants can introduce services, collect context, answer common questions, and route people toward the right next step.",
    examples: ["Visitor assistants", "Internal knowledge copilots", "Intake and qualification flows"],
    preview: "copilot",
  },
  {
    label: "Automation",
    title: "Less repetitive work between customer action and team response.",
    description: "Automated workflows connect forms, notifications, records, follow-ups, and routine internal steps so the business moves faster.",
    examples: ["Lead routing", "Follow-up sequences", "Operations handoffs"],
    preview: "automation",
  },
  {
    label: "Custom Business Software",
    title: "Tools shaped around the way the company actually operates.",
    description: "Internal portals, workflow products, and bespoke interfaces that organize work instead of forcing teams into generic templates.",
    examples: ["Client portals", "Team workflow tools", "Operational dashboards"],
    preview: "software",
  },
];

const process = ["Understand the business", "Design the right system", "Build and refine", "Launch and support"];

function MotionSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <motion.section
      initial={reduced ? false : "hidden"}
      whileInView="show"
      viewport={{ once: true, margin: "-120px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12 } } }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

function BrowserFrame({ type = "website" }: { type?: string }) {
  const lines = type === "copilot" ? ["How can AI help my team?", "I can answer service questions, capture project context, and route qualified inquiries.", "Show me the next step"] : ["Premium offer", "Clear customer path", "Book a project call"];
  return (
    <div className="rounded-[1.6rem] border border-white/10 bg-[#071022]/95 p-3 shadow-[0_26px_80px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.07)]">
      <div className="mb-3 flex items-center gap-2 border-b border-white/10 pb-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" /><span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" /><span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
        <span className="ml-3 h-6 flex-1 rounded-full bg-white/[0.06]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.2),transparent_18rem),linear-gradient(135deg,#111b48,#07101f)] p-5">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--gold)]">{type === "software" ? "Workflow" : type === "automation" ? "Automation" : type === "copilot" ? "Assistant" : "Website"}</p>
          <div className="mt-16 h-3 w-4/5 rounded-full bg-white/85" />
          <div className="mt-3 h-3 w-2/3 rounded-full bg-white/35" />
          <div className="mt-7 inline-flex rounded-full bg-[var(--gold)] px-4 py-2 text-xs font-black text-[#07101f]">Primary action</div>
        </div>
        <div className="space-y-3">
          {lines.map((line, index) => <div key={line} className={`rounded-2xl border border-white/10 p-4 text-sm text-slate-200 ${index === 1 ? "bg-[rgba(212,175,55,0.11)]" : "bg-white/[0.045]"}`}>{line}</div>)}
        </div>
      </div>
    </div>
  );
}

function HeroComposition() {
  const reduced = useReducedMotion();
  return (
    <motion.div variants={fadeUp} className="relative min-h-[34rem] lg:min-h-[42rem]">
      <div className="absolute inset-0 rounded-[3rem] bg-[radial-gradient(circle_at_60%_30%,rgba(245,158,11,0.22),transparent_24rem)]" />
      {[
        ["Premium website", "left-0 top-8 w-[82%] rotate-[-3deg]"],
        ["AI copilot", "right-0 top-40 w-[70%] rotate-[4deg]"],
        ["LEADFORGE", "left-10 bottom-4 w-[76%] rotate-[-1deg]"],
      ].map(([title, pos], index) => (
        <motion.div key={title} animate={reduced ? undefined : { y: [0, index % 2 ? -8 : 8, 0] }} transition={{ duration: 6 + index, repeat: Infinity, ease: "easeInOut" }} whileHover={{ y: -10, rotate: 0, scale: 1.02 }} className={`absolute ${pos} rounded-[1.6rem] border border-[rgba(212,175,55,0.22)] bg-[linear-gradient(145deg,rgba(17,27,72,0.96),rgba(5,9,24,0.98))] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.46)]`}>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--gold)]">{title}</p>
          <BrowserFrame type={index === 1 ? "copilot" : index === 2 ? "software" : "website"} />
        </motion.div>
      ))}
    </motion.div>
  );
}

export default function HomePage() {
  const [active, setActive] = useState(0);
  return (
    <main className="overflow-x-hidden bg-[#050918]">
      <MotionSection className="relative mx-auto grid max-w-[92rem] gap-12 px-6 pb-24 pt-20 sm:px-8 lg:grid-cols-[0.88fr_1.12fr] lg:px-10 lg:pt-28">
        <div className="relative z-10 self-center">
          <motion.p variants={fadeUp} className="text-xs font-black uppercase tracking-[0.3em] text-[var(--gold)]">JG Creative Studio</motion.p>
          <motion.h1 variants={fadeUp} className="mt-6 text-5xl font-black leading-[0.96] tracking-[-0.06em] text-white sm:text-6xl lg:text-7xl">Premium websites.<span className="block bg-[linear-gradient(180deg,#fff,#d4af37)] bg-clip-text text-transparent">AI systems built for real business.</span></motion.h1>
          <motion.p variants={fadeUp} className="mt-7 max-w-2xl text-lg leading-8 text-[var(--muted)]">JG Creative Studio creates websites, custom AI, automation, and business software with the polish of a premium product studio and the practicality of tools your team can actually use.</motion.p>
          <motion.div variants={fadeUp} className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link className="rounded-2xl bg-[linear-gradient(180deg,#e2be48,#b78b1f)] px-7 py-4 text-center text-sm font-black text-[#07101f] shadow-[0_18px_44px_rgba(212,175,55,0.24)] focus:outline-none focus:ring-2 focus:ring-[#f5d76e]" href="/contact">Start a Project</Link>
            <a className="rounded-2xl border border-[rgba(212,175,55,0.35)] bg-white/[0.04] px-7 py-4 text-center text-sm font-black text-white focus:outline-none focus:ring-2 focus:ring-[#f5d76e]" href={leadforgeUrl} target="_blank" rel="noopener noreferrer">Explore LEADFORGE</a>
          </motion.div>
        </div>
        <HeroComposition />
      </MotionSection>

      <MotionSection className="mx-auto max-w-[92rem] space-y-16 px-6 py-20 sm:px-8 lg:px-10">
        <motion.div variants={fadeUp}><p className="text-xs font-black uppercase tracking-[0.26em] text-[var(--gold)]">Selected work</p><h2 className="mt-4 max-w-4xl text-4xl font-black tracking-[-0.04em] text-white sm:text-6xl">Built work should look and feel like the product itself.</h2></motion.div>
        {showcase.map((item, index) => <motion.article variants={fadeUp} whileHover={{ y: -6 }} key={item.name} className={`grid gap-8 rounded-[2.2rem] border border-[rgba(212,175,55,0.22)] bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.12),transparent_22rem),linear-gradient(145deg,#10183a,#060a1e)] p-5 shadow-[0_34px_100px_rgba(0,0,0,0.42)] lg:grid-cols-2 lg:p-10 ${index % 2 ? "lg:[&>div:first-child]:order-2" : ""}`}><div><BrowserFrame type={index === 1 ? "copilot" : index === 2 ? "website" : "software"} /></div><div className="self-center"><h3 className="text-3xl font-black text-white sm:text-5xl">{item.name}</h3><p className="mt-4 text-lg leading-8 text-[var(--muted)]">{item.purpose}</p><ul className="mt-7 grid gap-3 sm:grid-cols-2">{item.built.map((b) => <li key={b} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 font-bold text-slate-100">{b}</li>)}</ul>{item.external ? <a href={item.href} target="_blank" rel="noopener noreferrer" className="mt-8 inline-flex font-black text-[var(--gold)]">{item.cta}</a> : <Link href={item.href} className="mt-8 inline-flex font-black text-[var(--gold)]">{item.cta}</Link>}</div></motion.article>)}
      </MotionSection>

      <MotionSection className="border-y border-white/10 bg-white/[0.015] px-6 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-[92rem]"><motion.h2 variants={fadeUp} className="max-w-3xl text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl">Capabilities you can actually interact with.</motion.h2><motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-3" role="tablist" aria-label="Capabilities">{capabilities.map((cap, i) => <button key={cap.label} role="tab" aria-selected={active === i} onClick={() => setActive(i)} className={`rounded-full px-5 py-3 text-sm font-black focus:outline-none focus:ring-2 focus:ring-[#f5d76e] ${active === i ? "bg-[var(--gold)] text-[#07101f]" : "border border-white/10 bg-white/[0.04] text-white"}`}>{cap.label}</button>)}</motion.div><motion.div variants={fadeUp} className="mt-8 grid gap-8 rounded-[2rem] border border-[rgba(212,175,55,0.22)] bg-[#071022] p-5 lg:grid-cols-[0.9fr_1.1fr] lg:p-9"><AnimatePresence mode="wait"><motion.div key={active} initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 18 }}><h3 className="text-3xl font-black text-white">{capabilities[active].title}</h3><p className="mt-4 leading-8 text-[var(--muted)]">{capabilities[active].description}</p><ul className="mt-6 space-y-3">{capabilities[active].examples.map(e => <li key={e} className="font-bold text-slate-100">— {e}</li>)}</ul></motion.div></AnimatePresence><AnimatePresence mode="wait"><motion.div key={capabilities[active].preview} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}><BrowserFrame type={capabilities[active].preview} /></motion.div></AnimatePresence></motion.div></div>
      </MotionSection>

      <MotionSection className="mx-auto grid max-w-[92rem] gap-10 px-6 py-20 sm:px-8 lg:grid-cols-2 lg:px-10"><motion.div variants={fadeUp}><p className="text-xs font-black uppercase tracking-[0.26em] text-[var(--gold)]">Live AI demonstration</p><h2 className="mt-4 text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl">Try the assistant already on this site.</h2><p className="mt-5 text-lg leading-8 text-[var(--muted)]">The homepage does not need a second chatbot. Use the existing bubble to test how a business assistant can introduce services, collect context, and guide a visitor forward.</p><Link href="/ai-tools" className="mt-8 inline-flex font-black text-[var(--gold)]">View AI Systems</Link></motion.div><motion.div variants={fadeUp} className="rounded-[2rem] border border-[rgba(212,175,55,0.22)] bg-[#071022] p-5 shadow-[0_34px_90px_rgba(0,0,0,0.4)]"><div className="space-y-4">{["Can you help me decide what to build?", "Yes. Tell me whether you need a website, AI assistant, automation, or a custom internal tool.", "We need faster customer response.", "Then an AI copilot with a clear handoff path may be the right starting point."].map((m, i) => <motion.p key={m} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.18 }} viewport={{ once: true }} className={`max-w-[85%] rounded-2xl p-4 text-sm leading-6 ${i % 2 ? "bg-[rgba(212,175,55,0.12)] text-slate-100" : "ml-auto bg-white/[0.06] text-white"}`}>{m}</motion.p>)}</div><p className="mt-6 border-t border-white/10 pt-5 text-sm font-bold text-[var(--gold)]">Look for the site assistant bubble in the corner.</p></motion.div></MotionSection>

      <MotionSection className="mx-auto max-w-[92rem] px-6 py-20 sm:px-8 lg:px-10"><motion.div variants={fadeUp} className="rounded-[2.4rem] border border-[rgba(212,175,55,0.3)] bg-[radial-gradient(circle_at_78%_22%,rgba(245,158,11,0.2),transparent_24rem),linear-gradient(145deg,#111b48,#050918)] p-7 lg:p-12"><div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]"><div><h2 className="text-4xl font-black tracking-[-0.04em] text-white sm:text-6xl">Built by the team behind LEADFORGE.</h2><p className="mt-5 text-lg leading-8 text-[var(--muted)]">Building LEADFORGE required product design, AI copilots, complex business logic, lead and data systems, dashboards, billing, collaboration, and full SaaS architecture.</p><div className="mt-8 flex flex-col gap-4 sm:flex-row"><a href={leadforgeUrl} target="_blank" rel="noopener noreferrer" className="rounded-2xl bg-[var(--gold)] px-6 py-4 text-center font-black text-[#07101f]">Explore LEADFORGE</a><Link href="/contact" className="rounded-2xl border border-white/10 px-6 py-4 text-center font-black text-white">Build Something for My Business</Link></div></div><BrowserFrame type="software" /></div></motion.div></MotionSection>

      <MotionSection className="mx-auto max-w-[86rem] px-6 py-20 sm:px-8 lg:px-10"><motion.h2 variants={fadeUp} className="text-center text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl">A build process with momentum.</motion.h2><div className="relative mt-12 grid gap-6 lg:grid-cols-4"><div className="absolute left-0 top-10 hidden h-px w-full bg-[linear-gradient(90deg,transparent,#d4af37,transparent)] lg:block" />{process.map((p, i) => <motion.div variants={fadeUp} key={p} className="relative rounded-[1.6rem] border border-white/10 bg-[#071022] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.32)]"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--gold)] font-black text-[#07101f]">0{i + 1}</span><h3 className="mt-8 text-xl font-black text-white">{p}</h3><p className="mt-3 leading-7 text-[var(--muted)]">{["Map goals, users, blockers, and the real work behind the request.", "Shape the website, AI flow, automation, or software around the business.", "Prototype, polish, connect, and improve the product before launch.", "Deploy cleanly, support the rollout, and keep the system useful."][i]}</p></motion.div>)}</div></MotionSection>

      <MotionSection className="mx-auto max-w-[92rem] px-6 pb-24 sm:px-8 lg:px-10"><motion.div variants={fadeUp} className="rounded-[2.4rem] border border-[rgba(212,175,55,0.34)] bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.18),transparent_28rem),linear-gradient(145deg,#111b48,#050918)] p-8 text-center shadow-[0_40px_110px_rgba(0,0,0,0.46)] sm:p-12"><h2 className="mx-auto max-w-4xl text-4xl font-black tracking-[-0.04em] text-white sm:text-6xl">Let’s build something your business can actually use.</h2><div className="mt-9 flex flex-col justify-center gap-4 sm:flex-row"><Link href="/contact" className="rounded-2xl bg-[var(--gold)] px-7 py-4 font-black text-[#07101f]">Start a Project</Link><Link href="/ai-tools" className="rounded-2xl border border-white/10 px-7 py-4 font-black text-white">Explore AI Systems</Link></div></motion.div></MotionSection>
    </main>
  );
}
