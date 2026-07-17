"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/ai-tools", label: "AI Systems" },
  { href: "/services", label: "Services" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function SiteNavLinks({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  return navItems.map((item) => {
    const active =
      item.href === "/"
        ? pathname === "/"
        : pathname === item.href || pathname.startsWith(`${item.href}/`);

    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`${mobile ? "whitespace-nowrap " : ""}transition-colors hover:text-[var(--gold)] ${
          active ? "text-[var(--gold)]" : "text-slate-300"
        }`}
      >
        {item.label}
      </Link>
    );
  });
}
