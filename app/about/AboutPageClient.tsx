"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { Variants } from "framer-motion";
import type { ReactNode } from "react";

const portraitUrl = "https://i.postimg.cc/X7yd2PHq/9596D79E-9880-4FC7-9AD1-F44BDCDF2544-(1).jpg";

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

const principles = [
  {
    title: "Practical strategy first",
    body: "Every project starts with the business goal, the customer journey, and the operational friction the build needs to solve.",
  },
  {
    title: "Premium execution",
    body: "The work should feel polished, modern, and credible while staying easy for the client and their customers to use.",
  },
  {
    title: "Systems that last",
    body: "Websites, AI workflows, dashboards, and automations are built to support real day-to-day business needs after launch.",
  },
] as const;

const storyPoints = [
  ["Design clarity", "Clean hierarchy, strong messaging, and interfaces that make the next step obvious."],
  ["Technical depth", "Modern web development, AI workflows, integrations, and custom systems under one studio."],
  ["Human support", "Clear communication, practical recommendations, and help understanding the technology behind the work."],
] as const;

function Section({ children, className = "" }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();

  return (
    <motion.section
      initial={reduce ? false : "hidden"}
      whileInView="show"
      viewport={{ once: true, margin: "-120px" }}
      variants={stagger}
      className={className}
    >
      {children}
    </motion.section>
  );
}

function GoldButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-lg border border-amber-300/15 bg-[#081226] px-5 py-3 text-sm font-black text-white shadow-[0_18px_48px_rgba(212,175,55,.24),inset_0_1px_0_rgba(255,255,255,.55)] transition duration-300 hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-[#0b1830]"
    >
      {children}
    </Link>
  );
}

function OutlineButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-lg border border-amber-300/15 bg-[#081226] px-5 py-3 text-sm font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,.05)] transition duration-300 hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-[#0b1830]"
    >
      {children}
    </Link>
  );
}

function PortraitCard() {
  return (
    <motion.div variants={mediaIn} className="relative mx-auto max-w-sm lg:mx-0">
      <div className="absolute -inset-6 rounded-[2.5rem] bg-[radial-gradient(circle_at_50%_80%,rgba(212,175,55,.18),transparent_55%)] blur-2xl" />
      <div className="relative overflow-hidden rounded-[1.55rem] border border-[rgba(212,175,55,.18)] bg-[#030711] p-3 shadow-[0_30px_90px_rgba(0,0,0,.48),0_0_0_1px_rgba(255,255,255,.035)_inset]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(245,158,11,.22),transparent_12rem),linear-gradient(145deg,rgba(5,10,22,.99),rgba(2,5,14,.995))]" />
        <div className="relative overflow-hidden rounded-[1.15rem] border border-[rgba(212,175,55,.14)] bg-black/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={portraitUrl}
            alt="James Gullage, founder of JG Creative Studio"
            className="h-[30rem] w-full object-cover object-center saturate-[.92]"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#030713] via-[#030713]/70 to-transparent p-6 pt-24 text-center">
            <p className="text-xs font-black uppercase tracking-[.28em] text-[var(--gold)]">
              Founder
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-.04em] text-white">
              James Gullage
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              JG Creative Studio, LLC
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function AboutPageClient() {
  return (
    <div className="overflow-hidden bg-[#030713] text-white">
      <Section className="relative mx-auto grid max-w-[94rem] gap-12 px-5 pb-16 pt-16 sm:px-8 lg:grid-cols-[.82fr_1.18fr] lg:px-10 lg:pb-24 lg:pt-24">
        <div className="absolute inset-x-0 top-0 h-[52rem] bg-[radial-gradient(circle_at_12%_18%,rgba(212,175,55,.16),transparent_28rem),radial-gradient(circle_at_82%_12%,rgba(14,22,62,.72),transparent_38rem)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,.025)_1px,transparent_1px)] bg-[size:72px_72px] opacity-20" />

        <PortraitCard />

        <motion.div variants={fadeUp} className="relative z-10 self-center text-center">
          <p className="text-xs font-black uppercase tracking-[.34em] text-[var(--gold)]">
            About JG Creative Studio
          </p>
          <h1 className="mx-auto mt-5 max-w-4xl text-5xl font-black leading-[.94] tracking-[-.065em] sm:text-6xl xl:text-[5.25rem]">
            A creative technology studio for{" "}
            <span className="text-[var(--gold)]">modern business.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-[var(--muted)] sm:text-lg">
            JG Creative Studio helps businesses look sharper, communicate clearly,
            and operate smarter through premium websites, AI systems, automation,
            and custom business technology.
          </p>
          <p className="mx-auto mt-5 max-w-2xl leading-8 text-slate-300">
            I’m James Gullage, a founder, developer, stay-at-home dad, and lifelong
            technology learner. I care about making advanced tools feel practical,
            understandable, and genuinely useful for the people running the
            business.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <GoldButton href="/contact">Start a Project</GoldButton>
            <OutlineButton href="/services">View Services</OutlineButton>
          </div>
        </motion.div>
      </Section>

      <Section className="mx-auto max-w-[94rem] border-y border-[rgba(212,175,55,.10)] px-5 py-20 text-center sm:px-8 lg:px-10">
        <motion.p
          variants={fadeUp}
          className="text-xs font-black uppercase tracking-[.32em] text-[var(--gold)]"
        >
          How the studio works
        </motion.p>
        <motion.h2
          variants={fadeUp}
          className="mx-auto mt-4 max-w-4xl text-4xl font-black tracking-[-.055em] sm:text-6xl"
        >
          Clear thinking, <span className="text-[var(--gold)]">polished design</span>,
          and systems that support the real workflow.
        </motion.h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {principles.map((item) => (
            <motion.article
              variants={fadeUp}
              key={item.title}
              className="rounded-[1.35rem] border border-[rgba(212,175,55,.13)] bg-[linear-gradient(145deg,rgba(9,16,32,.94),rgba(2,5,14,.98))] p-6 text-center shadow-[0_28px_80px_rgba(0,0,0,.34)]"
            >
              <h3 className="text-2xl font-black tracking-[-.04em]">
                {item.title}
              </h3>
              <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                {item.body}
              </p>
            </motion.article>
          ))}
        </div>
      </Section>

      <Section className="mx-auto grid max-w-[94rem] gap-10 border-b border-[rgba(212,175,55,.10)] px-5 py-20 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:px-10">
        <motion.div variants={fadeUp} className="self-center text-center">
          <p className="text-xs font-black uppercase tracking-[.32em] text-[var(--gold)]">
            Why it started
          </p>
          <h2 className="mx-auto mt-4 max-w-3xl text-4xl font-black leading-[.96] tracking-[-.055em] sm:text-6xl">
            <span className="text-[var(--gold)]">Better businesses</span> deserve
            better digital systems.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl leading-8 text-[var(--muted)]">
            A lot of businesses do excellent work, but their website, marketing,
            software, or internal process does not reflect that quality. JG
            Creative Studio exists to close that gap with technology that feels
            premium on the outside and practical behind the scenes.
          </p>
        </motion.div>

        <motion.div
          variants={mediaIn}
          className="rounded-[1.55rem] border border-[rgba(212,175,55,.16)] bg-[#030711] p-5 shadow-[0_30px_90px_rgba(0,0,0,.42)]"
        >
          <div className="grid gap-4">
            {storyPoints.map(([title, desc]) => (
              <div
                key={title}
                className="rounded-[1.1rem] border border-[rgba(212,175,55,.12)] bg-white/[.035] p-5"
              >
                <p className="text-center text-xs font-black uppercase tracking-[.24em] text-[var(--gold)] lg:text-left">
                  {title}
                </p>
                <p className="mt-3 leading-7 text-slate-300">{desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </Section>
    </div>
  );
}