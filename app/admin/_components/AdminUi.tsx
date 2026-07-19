import Link from "next/link";
import type { ReactNode } from "react";

export const card = "rounded-[24px] border border-amber-300/10 bg-[linear-gradient(145deg,rgba(5,11,24,.94),rgba(3,7,19,.88))] shadow-[0_20px_60px_rgba(0,0,0,.28),0_0_36px_rgba(245,158,11,.025),inset_0_1px_0_rgba(212,175,55,.05)]";
export const inset = "rounded-2xl bg-[#050b18]/80 ring-1 ring-inset ring-amber-300/10";
export const input = "rounded-xl border border-amber-300/10 bg-[#020611]/90 text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-amber-300/45 focus:ring-4 focus:ring-amber-300/[.05]";
export const th = "whitespace-nowrap px-5 py-3.5 text-left text-[10px] font-black uppercase tracking-[.16em] text-amber-200/55";
export const td = "px-5 py-4 text-sm text-slate-300";

export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <header className="relative overflow-hidden rounded-[28px] border border-amber-300/10 bg-[#030713]/90 px-6 py-7 text-center shadow-[0_22px_70px_rgba(0,0,0,.3),0_0_40px_rgba(245,158,11,.04)] sm:px-8 sm:py-9">
    <div className="pointer-events-none absolute -left-24 -top-32 h-72 w-72 rounded-full bg-amber-400/[.08] blur-[90px]" />
    <div className="relative flex flex-col items-center gap-5">
      <div className="flex flex-col items-center"><p className="text-xs font-semibold uppercase tracking-[.28em] text-amber-300">{eyebrow}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-.04em] text-white sm:text-5xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">{description}</p></div>{action}</div>
  </header>;
}

export function KpiCard({ label, value, detail, accent = "gold" }: { label: string; value: ReactNode; detail?: string; accent?: "gold" | "blue" | "green" }) {
  const glow = accent === "green" ? "bg-emerald-400" : accent === "blue" ? "bg-blue-400" : "bg-amber-300";
  return <article className={`${card} group relative min-h-36 overflow-hidden p-5 transition duration-300 hover:-translate-y-0.5 hover:border-amber-300/35`}>
    <span className={`absolute -right-8 -top-8 h-24 w-24 rounded-full ${glow} opacity-[.07] blur-2xl transition group-hover:opacity-[.12]`} />
    <div className="relative flex h-full flex-col justify-between gap-4"><p className="text-[10px] font-black uppercase tracking-[.17em] text-amber-200/55">{label}</p><div><p className="text-3xl font-semibold tracking-[-.04em] text-white">{value}</p>{detail && <p className="mt-1.5 text-xs text-slate-500">{detail}</p>}</div></div>
  </article>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "gold" }) {
  const styles = tone === "good" ? "border-emerald-400/25 bg-emerald-400/[.08] text-emerald-300" : tone === "gold" ? "border-amber-300/25 bg-amber-300/[.08] text-amber-200" : "border-slate-500/20 bg-slate-500/[.08] text-slate-300";
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold capitalize tracking-wide ${styles}`}><span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />{children}</span>;
}

export function SearchBar({ placeholder, defaultValue, extras }: { placeholder: string; defaultValue?: string; extras?: ReactNode }) {
  return <form className={`${card} mx-auto flex w-full max-w-4xl flex-col gap-3 p-3 md:flex-row`}>
    <div className="relative min-w-0 md:min-w-72 md:flex-1"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-300/60"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input name="q" defaultValue={defaultValue} placeholder={placeholder} className={`${input} w-full py-3 pl-11 pr-4 text-sm`} /></div>
    {extras}<button className="cta-raised rounded-xl border border-amber-300/20 bg-[#081226] px-5 py-3 text-sm font-black text-white hover:border-amber-300/40 hover:bg-[#0b1830]">Search</button>
  </form>;
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className={`${card} px-6 py-16 text-center`}><span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl border border-amber-300/20 bg-amber-300/[.06] text-amber-300">◇</span><p className="mt-4 font-bold text-white">{title}</p><p className="mx-auto mt-2 max-w-lg text-sm text-slate-400">{detail}</p></div>;
}

export function Pagination({ page, pages, params }: { page: number; pages: number; params: Record<string, string | undefined> }) {
  if (pages <= 1) return null;
  const href = (next: number) => { const q = new URLSearchParams(); Object.entries(params).forEach(([k,v]) => v && q.set(k,v)); q.set("page", String(next)); return `?${q}`; };
  const linkClass = "rounded-xl border border-amber-300/15 bg-[#081226] px-4 py-2.5 font-bold text-slate-200 transition hover:border-amber-300/35 hover:text-white";
  return <div className="flex items-center justify-between text-sm text-slate-500"><span>Page <strong className="text-slate-300">{page}</strong> of {pages}</span><div className="flex gap-2">
    {page > 1 && <Link href={href(page - 1)} className={linkClass}>← Previous</Link>}
    {page < pages && <Link href={href(page + 1)} className={linkClass}>Next →</Link>}
  </div></div>;
}

export const formatDate = (value: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
export const formatDateTime = (value: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
