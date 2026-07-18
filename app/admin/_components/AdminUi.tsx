import Link from "next/link";
import type { ReactNode } from "react";

export const card = "rounded-2xl border border-amber-300/15 bg-[#070d21]/95 shadow-[0_18px_55px_rgba(0,0,0,.28),inset_0_1px_0_rgba(255,255,255,.04)]";
export const th = "whitespace-nowrap px-4 py-3 text-left text-[11px] font-black uppercase tracking-[.13em] text-slate-400";
export const td = "px-4 py-3.5 text-sm text-slate-300";

export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
    <div><p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">{eyebrow}</p>
      <h1 className="mt-2 text-3xl font-black tracking-[-.035em] text-white sm:text-4xl">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{description}</p></div>{action}</div>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "gold" }) {
  const styles = tone === "good" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : tone === "gold" ? "border-amber-300/20 bg-amber-300/10 text-amber-200" : "border-white/10 bg-white/[.04] text-slate-300";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold capitalize ${styles}`}>{children}</span>;
}

export function SearchBar({ placeholder, defaultValue, extras }: { placeholder: string; defaultValue?: string; extras?: ReactNode }) {
  return <form className={`${card} flex flex-col gap-3 p-3 sm:flex-row`}>
    <input name="q" defaultValue={defaultValue} placeholder={placeholder} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#020611] px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-300/40" />
    {extras}<button className="cta-raised rounded-xl border border-amber-300/20 bg-[#101936] px-5 py-2.5 text-sm font-black text-white hover:border-amber-300/35">Search</button>
  </form>;
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className={`${card} px-6 py-16 text-center`}><p className="font-bold text-white">{title}</p><p className="mt-2 text-sm text-slate-400">{detail}</p></div>;
}

export function Pagination({ page, pages, params }: { page: number; pages: number; params: Record<string, string | undefined> }) {
  if (pages <= 1) return null;
  const href = (next: number) => { const q = new URLSearchParams(); Object.entries(params).forEach(([k,v]) => v && q.set(k,v)); q.set("page", String(next)); return `?${q}`; };
  return <div className="mt-5 flex items-center justify-between text-sm text-slate-400"><span>Page {page} of {pages}</span><div className="flex gap-2">
    {page > 1 && <Link href={href(page - 1)} className="rounded-lg border border-white/10 px-3 py-2 hover:border-amber-300/30 hover:text-white">Previous</Link>}
    {page < pages && <Link href={href(page + 1)} className="rounded-lg border border-white/10 px-3 py-2 hover:border-amber-300/30 hover:text-white">Next</Link>}
  </div></div>;
}

export const formatDate = (value: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
export const formatDateTime = (value: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
