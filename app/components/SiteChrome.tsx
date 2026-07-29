"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import JGChatWidget from "./JGChatWidget";
import SiteNavLinks from "./SiteNavLinks";

const footerNavItems = [
  { href: "/services", label: "Websites" },
  { href: "/ai-tools", label: "AI Systems" },
  { href: "/services", label: "Services" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function SiteChrome({ children, year }: { children: ReactNode; year: number }) {
  const pathname = usePathname();
  const isAiBuilder = pathname === "/ai-builder" || pathname.startsWith("/ai-builder/");

  return (
    <div className={`relative z-10 overflow-x-hidden ${isAiBuilder ? "xl:h-dvh xl:min-h-0 xl:overflow-hidden" : "min-h-screen"}`}>
      {!isAiBuilder ? <header className="sticky top-0 z-50 border-b border-[rgba(212,175,55,0.16)] bg-[rgba(3,7,19,0.78)] backdrop-blur-xl">
        <div className="relative mx-auto flex min-h-14 w-[calc(100%-1.5rem)] max-w-[90rem] items-center justify-between gap-5 px-4 py-2 min-[1200px]:w-[calc(100%-3rem)] min-[1200px]:px-6">
          <Link href="/" className="group flex min-w-0 items-center gap-3">
            <Image
              src="/apple-touch-icon.png"
              alt="JG Creative Studio"
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded-lg shadow-[0_10px_26px_rgba(0,0,0,0.34)] transition-transform duration-200 group-hover:-translate-y-0.5"
            />
            <span className="absolute left-1/2 top-1/2 min-w-0 -translate-x-1/2 -translate-y-1/2 text-center min-[1200px]:static min-[1200px]:translate-x-0 min-[1200px]:translate-y-0 min-[1200px]:text-left">
              <span className="block truncate text-xs font-black uppercase tracking-[0.16em] text-white min-[1200px]:text-sm">
                JG Creative Studio
              </span>
              <span className="hidden text-[0.68rem] font-medium tracking-wide text-[var(--muted)] min-[1200px]:block">
                Websites · AI Systems · Growth Technology
              </span>
            </span>
          </Link>

          <nav className="hidden -translate-x-14 items-center gap-7 text-xs font-bold text-slate-300 min-[1200px]:flex">
            <SiteNavLinks />
          </nav>

          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/contact"
              className="hidden rounded-lg border border-amber-300/15 bg-[#081226] px-4 py-2 text-xs font-black text-white shadow-[0_10px_24px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-[#0b1830] min-[1200px]:inline-flex"
            >
              Start a Project
            </Link>
            <Link
              href="/contact"
              aria-label="Contact JG Creative Studio"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-amber-300/15 bg-[#081226] text-lg font-black text-white shadow-[0_12px_26px_rgba(212,175,55,0.2),inset_0_1px_0_rgba(255,255,255,0.38)] transition hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-[#0b1830] min-[1200px]:hidden"
            >
              ↗
            </Link>
          </div>
        </div>

        <nav className="border-t border-white/[0.05] px-3 py-2 min-[1200px]:hidden">
          <div className="mx-auto flex w-full items-center justify-between overflow-hidden text-[0.6rem] font-semibold text-slate-300 min-[390px]:text-[0.66rem] sm:w-auto sm:justify-center sm:gap-6">
            <SiteNavLinks mobile />
          </div>
        </nav>
      </header> : null}

      <main className={isAiBuilder ? "site-page-shell min-h-dvh xl:h-dvh xl:min-h-0 xl:overflow-hidden" : "site-page-shell min-h-[70vh]"}>
        {children}
      </main>

      {!isAiBuilder ? (
        <footer className="mt-24 border-t border-[var(--border)] bg-[rgba(4,8,24,0.82)]">
          <div className="mx-auto grid w-full max-w-[90rem] gap-10 px-6 py-14 sm:px-8 md:grid-cols-[1.35fr_0.8fr_1fr] lg:px-10">
            <div className="text-center md:text-left">
              <p className="text-lg font-black uppercase tracking-[0.14em] text-[var(--gold)]">JG Creative Studio</p>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[var(--muted)] md:mx-0">
                We build premium websites, practical AI business systems, and custom growth technology designed to help businesses operate better and win more customers.
              </p>
            </div>

            <div className="text-center md:text-left">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--gold)]">Explore</p>
              <div className="mt-5 grid grid-cols-3 gap-x-4 gap-y-4 text-sm font-semibold text-slate-300 md:grid-cols-1 md:gap-3">
                {footerNavItems.map((item) => (
                  <Link key={`${item.label}-${item.href}`} href={item.href} className="hover:text-white">
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-[rgba(212,175,55,0.24)] bg-[#030713] p-7 text-center shadow-[0_24px_60px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.05)]">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--gold)]">Build something useful</p>
              <p className="mt-3 text-xl font-black leading-snug text-white">Turn your next website or AI idea into a real business asset.</p>
              <Link
                href="/contact"
                className="mt-6 inline-flex rounded-xl border border-amber-300/15 bg-[#081226] px-5 py-3 text-sm font-black text-white shadow-[0_12px_26px_rgba(212,175,55,0.18),inset_0_1px_0_rgba(255,255,255,0.36)] transition hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-[#0b1830]"
              >
                Start your project →
              </Link>
            </div>
          </div>

          <div className="border-t border-white/[0.06]">
            <div className="mx-auto flex w-full max-w-[90rem] flex-col items-center gap-2 px-6 py-5 text-center text-xs text-slate-500 sm:px-8 md:flex-row md:justify-between md:text-left lg:px-10">
              <p>© {year} JG Creative Studio. All rights reserved.</p>
              <div className="flex items-center gap-2">
                <a href="mailto:hello@jgcreativestudios.com" className="transition-colors hover:text-[var(--gold)]">
                  hello@jgcreativestudios.com
                </a>
                <span aria-hidden="true">•</span>
                <Link href="/faq" className="transition-colors hover:text-[var(--gold)]">FAQ</Link>
              </div>
            </div>
          </div>
        </footer>
      ) : null}

      <JGChatWidget />
    </div>
  );
}
