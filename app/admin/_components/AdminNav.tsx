"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/admin", label: "Overview", icon: "⌁" },
  { href: "/admin/users", label: "Users", icon: "◎" },
  { href: "/admin/projects", label: "Projects", icon: "◇" },
  { href: "/admin/purchases", label: "Purchases", icon: "↗" },
];

export default function AdminNav() {
  const pathname = usePathname();
  return <nav aria-label="Admin navigation" className="flex flex-wrap gap-2 lg:flex-col lg:flex-nowrap">
    {nav.map((item) => {
      const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
      return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`group flex min-w-max items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${active ? "border border-amber-300/25 bg-amber-300/[.08] text-white shadow-[0_10px_30px_rgba(0,0,0,.2)]" : "border border-transparent text-slate-400 hover:border-amber-300/15 hover:bg-[#081226] hover:text-white"}`}>
        <span className={`grid h-8 w-8 place-items-center rounded-xl text-base ${active ? "bg-amber-300/10 text-amber-300" : "bg-slate-500/[.06] text-slate-500 group-hover:text-amber-300"}`}>{item.icon}</span>{item.label}
      </Link>;
    })}
  </nav>;
}
