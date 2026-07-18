import Link from "next/link";
import type { ReactNode } from "react";
import { requireAdmin } from "@/app/lib/admin/auth";

const nav = [{ href: "/admin", label: "Overview" }, { href: "/admin/users", label: "Users" }, { href: "/admin/projects", label: "Projects" }, { href: "/admin/purchases", label: "Purchases" }];

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return <div className="min-h-screen bg-[#020611]/90">
    <div className="mx-auto grid min-h-screen max-w-[100rem] lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-amber-300/15 bg-[#050a1b] p-5 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl border border-amber-300/30 bg-[#101936] font-black text-amber-300">JG</span><div><p className="text-sm font-black text-white">AI Builder</p><p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Private admin</p></div></div>
        <nav className="mt-7 flex gap-2 overflow-x-auto lg:flex-col">{nav.map((item) => <Link key={item.href} href={item.href} className="whitespace-nowrap rounded-xl border border-transparent px-4 py-3 text-sm font-bold text-slate-400 transition hover:border-amber-300/15 hover:bg-white/[.03] hover:text-white">{item.label}</Link>)}</nav>
      </aside>
      <main className="min-w-0 p-5 sm:p-8 lg:p-10">{children}</main>
    </div>
  </div>;
}
