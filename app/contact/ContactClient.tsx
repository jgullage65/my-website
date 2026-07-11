"use client";

import { useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import type { Variants } from "framer-motion";
import type { ReactNode } from "react";

const inputClass = "mt-1 w-full rounded-xl border border-[rgba(212,175,55,.18)] bg-[#050b18] px-4 py-3 text-white placeholder:text-slate-500 outline-none transition focus:border-[var(--gold)] focus:ring-2 focus:ring-[rgba(212,175,55,.18)]";
const labelClass = "text-sm font-bold text-slate-200";
const fadeUp: Variants = { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: { duration: 0.72, ease: [0.16, 1, 0.3, 1] } } };
const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.1, delayChildren: 0.08 } } };

function normalizePreferred(raw: string) {
  const v = decodeURIComponent(raw || "").trim().toLowerCase();
  if (["text", "sms"].includes(v)) return "Text";
  if (["phone", "call"].includes(v)) return "Call";
  if (["email", "e-mail", "mail"].includes(v)) return "Email";
  return "Email";
}

function normalizeService(raw: string) {
  const v = (raw || "").trim().toLowerCase();

  if (["website", "web", "site"].includes(v)) return "Website Creation";
  if (["flyers", "flyer", "social", "flyers / social", "flyers and social", "design"].includes(v)) return "Flyer / Promo Design";
  if (["ai", "ai setup", "ai templates", "ai business solutions"].includes(v)) return "AI Setup";
  if (["maintenance", "updates", "website updates"].includes(v)) return "Website Updates / Maintenance";
  if (["admin", "virtual assistance"].includes(v)) return "Admin / Virtual Assistance";

  const exact = (raw || "").trim();
  const allowed = new Set(["Website Creation", "Website Updates / Maintenance", "Flyer / Promo Design", "Social Media Posts", "AI Setup", "Admin / Virtual Assistance", "Not sure yet"]);
  if (allowed.has(exact)) return exact;

  return "Not sure yet";
}

function Section({ children, className = "" }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return <motion.section initial={reduce ? false : "hidden"} whileInView="show" viewport={{ once: true, margin: "-120px" }} variants={stagger} className={className}>{children}</motion.section>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><label className={labelClass}>{label}</label>{children}</div>;
}

function SelectOptions() {
  return <><option value="Website Creation">Website Creation</option><option value="Website Updates / Maintenance">Website Updates / Maintenance</option><option value="Flyer / Promo Design">Flyer / Promo Design</option><option value="Social Media Posts">Social Media Posts</option><option value="AI Setup">AI Setup</option><option value="Admin / Virtual Assistance">Admin / Virtual Assistance</option><option value="Not sure yet">Not sure yet</option></>;
}

export default function ContactClient() {
  const params = useSearchParams();
  const preService = normalizeService(params.get("service") || "");
  const prePreferred = normalizePreferred(params.get("preferred_contact") || params.get("preferred") || params.get("contact") || "");
  const prePhone = params.get("phone") || "";
  const preBusinessType = params.get("business_type") || params.get("business") || "";
  const preEmail = params.get("email") || "";

  return <div className="overflow-hidden bg-[#030713] text-white"><Section className="relative mx-auto max-w-[94rem] px-5 pb-16 pt-16 sm:px-8 lg:px-10 lg:pb-20 lg:pt-24"><div className="absolute inset-x-0 top-0 h-[52rem] bg-[radial-gradient(circle_at_12%_18%,rgba(212,175,55,.16),transparent_28rem),radial-gradient(circle_at_82%_12%,rgba(14,22,62,.72),transparent_38rem)]" /><div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,.025)_1px,transparent_1px)] bg-[size:72px_72px] opacity-20" /><motion.div variants={fadeUp} className="relative z-10 max-w-4xl"><p className="text-xs font-black uppercase tracking-[.34em] text-[var(--gold)]">Contact JG Creative Studio</p><h1 className="mt-5 max-w-4xl text-5xl font-black leading-[.94] tracking-[-.065em] sm:text-6xl xl:text-[5.25rem]">Tell me what you want to build, improve, or automate.</h1><p className="mt-6 max-w-3xl text-base leading-8 text-[var(--muted)] sm:text-lg">Send the project details once and keep the existing contact flow intact. I’ll respond with the clearest next step, scope, and timeline.</p></motion.div></Section><Section className="mx-auto grid max-w-[94rem] gap-8 border-y border-[rgba(212,175,55,.10)] px-5 py-20 sm:px-8 lg:grid-cols-[1.35fr_.65fr] lg:px-10"><motion.div variants={fadeUp} className="rounded-[1.55rem] border border-[rgba(212,175,55,.16)] bg-[linear-gradient(145deg,rgba(9,16,32,.94),rgba(2,5,14,.98))] p-6 shadow-[0_30px_90px_rgba(0,0,0,.42)] md:p-8"><div><p className="text-xs font-black uppercase tracking-[.28em] text-[var(--gold)]">Project request</p><h2 className="mt-3 text-3xl font-black tracking-[-.045em]">Start with the details that shape the recommendation.</h2><p className="mt-3 max-w-2xl leading-7 text-[var(--muted)]">The fastest quote comes from knowing the goal, service type, assets, and deadline.</p></div><form action="https://formspree.io/f/mlgldrnk" method="POST" className="mt-8 grid gap-5"><input type="hidden" name="form_type" value="Project Request" /><div className="grid gap-5 md:grid-cols-2"><Field label="Your Name"><input type="text" name="name" required placeholder="John Smith" className={inputClass} /></Field><Field label="Email"><input type="email" name="email" defaultValue={preEmail} required placeholder="you@email.com" className={inputClass} /></Field></div><div className="grid gap-5 md:grid-cols-2"><Field label="Phone (optional)"><input type="tel" name="phone" defaultValue={prePhone} placeholder="(555) 123-4567" className={inputClass} /></Field><Field label="Best way to follow up?"><select name="preferred_contact" className={inputClass} defaultValue={prePreferred}><option value="Email">Email</option><option value="Text">Text</option><option value="Call">Call</option></select></Field></div><div className="grid gap-5 md:grid-cols-2"><Field label="Business Name (optional)"><input type="text" name="business" placeholder="Your business" className={inputClass} /></Field><Field label="What type of business do you run? (optional)"><input type="text" name="business_type" defaultValue={preBusinessType} placeholder="Example: Cleaning service, coffee shop, barber" className={inputClass} /></Field></div><div className="grid gap-5 md:grid-cols-2"><Field label="What do you need?"><select name="service" required className={inputClass} defaultValue={preService}><SelectOptions /></select></Field><Field label="Deadline (optional)"><input type="text" name="deadline" placeholder="Example: Next Friday" className={inputClass} /></Field></div><Field label="Goal / What should this help you do?"><textarea name="goal" required rows={4} placeholder="Example: I want more customers calling or booking online." className={inputClass} /></Field><div className="grid gap-5 md:grid-cols-2"><Field label="Do you have a logo/photos?"><select name="assets" className={inputClass} defaultValue="Not yet"><option value="Yes">Yes</option><option value="No">No</option><option value="Not yet">Not yet</option></select></Field><Field label="Extra details (optional)"><textarea name="notes" rows={3} placeholder="Anything else I should know?" className={inputClass} /></Field></div><div className="rounded-[1rem] border border-[rgba(212,175,55,.12)] bg-white/[.035] p-5 text-sm text-slate-300"><p className="font-black text-white">What happens next?</p><ul className="mt-2 grid gap-1"><li>I’ll reply with a clear quote and timeline.</li><li>If you’re ready, we’ll confirm details and start.</li><li>You’ll get updates as your project is built.</li></ul></div><button type="submit" className="w-full rounded-lg bg-[linear-gradient(180deg,#ffd56a,#c89426)] py-3 font-black text-[#06101f] shadow-[0_18px_48px_rgba(212,175,55,.24)] transition hover:-translate-y-0.5">Submit Project Request</button><p className="text-center text-xs text-slate-500">This goes directly to my inbox. Typical response time: within 24 hours.</p></form></motion.div><motion.aside variants={fadeUp} className="grid gap-5"><div className="rounded-[1.35rem] border border-[rgba(212,175,55,.13)] bg-[#030711] p-6 shadow-[0_28px_80px_rgba(0,0,0,.34)]"><p className="text-xs font-black uppercase tracking-[.24em] text-[var(--gold)]">Direct email</p><h2 className="mt-3 text-2xl font-black tracking-[-.04em]">Email Me Directly</h2><p className="mt-3 leading-7 text-[var(--muted)]">The fastest way to reach me is by email.</p><a href="mailto:hello@jgcreativestudios.com" className="mt-4 block break-words font-black text-[var(--gold)]">hello@jgcreativestudios.com</a></div><div className="rounded-[1.35rem] border border-[rgba(212,175,55,.13)] bg-[#030711] p-6 shadow-[0_28px_80px_rgba(0,0,0,.34)]"><p className="text-xs font-black uppercase tracking-[.24em] text-[var(--gold)]">Quick message</p><h2 className="mt-3 text-2xl font-black tracking-[-.04em]">Short version</h2><form action="https://formspree.io/f/mlgldrnk" method="POST" className="mt-5 grid gap-4"><input type="hidden" name="form_type" value="Quick Message" /><input type="text" name="name" placeholder="Your Name" required className={inputClass.replace("mt-1 ", "")} /><input type="email" name="email" placeholder="Your Email" required className={inputClass.replace("mt-1 ", "")} /><input type="tel" name="phone" defaultValue={prePhone} placeholder="Phone (optional)" className={inputClass.replace("mt-1 ", "")} /><select name="preferred_contact" className={inputClass.replace("mt-1 ", "")} defaultValue={prePreferred}><option value="Email">Email</option><option value="Text">Text</option><option value="Call">Call</option></select><select name="service" className={inputClass.replace("mt-1 ", "")} defaultValue={preService}><SelectOptions /></select><textarea name="message" placeholder="Tell me what you need help with..." required rows={5} className={inputClass.replace("mt-1 ", "")} /><button type="submit" className="w-full rounded-lg bg-[var(--gold)] py-3 font-black text-[#06101f] transition hover:-translate-y-0.5">Send Message</button></form><p className="pt-4 text-xs text-slate-500">Messages go directly to my inbox. I typically respond within 24 hours.</p></div></motion.aside></Section></div>;
}
