import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import JGChatWidget from "./components/JGChatWidget";

const siteName = "JG Creative Studio";
const siteDescription =
  "Premium websites, custom AI business systems, and growth technology built for modern businesses.";

const ogImage =
  "https://i.postimg.cc/xTh3s9Jx/EE89ABF2-BE6B-41F3-BBE9-2F2074F81C03.png";

export const metadata: Metadata = {
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  metadataBase: new URL("https://jgcreativestudios.com"),
  openGraph: {
    title: siteName,
    description: siteDescription,
    url: "https://jgcreativestudios.com",
    siteName,
    images: [
      {
        url: ogImage,
        width: 1200,
        height: 630,
        alt: "JG Creative Studio",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: siteDescription,
    images: [ogImage],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/favicon.png",
  },
};

const navItems = [
  { href: "/", label: "Home" },
  { href: "/ai-tools", label: "AI Systems" },
  { href: "/services", label: "Services" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  const year = new Date().getFullYear();

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen overflow-x-hidden">
          <header className="sticky top-0 z-50 border-b border-[rgba(212,175,55,0.16)] bg-[rgba(3,7,19,0.78)] backdrop-blur-xl">
            <div className="mx-auto my-2 flex min-h-14 w-[calc(100%-1.5rem)] max-w-[90rem] items-center justify-between gap-5 rounded-2xl border border-[rgba(212,175,55,0.22)] bg-[rgba(5,12,27,0.88)] px-4 py-2 shadow-[0_18px_60px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.05)] sm:w-[calc(100%-3rem)] sm:px-5 lg:px-6">
              <Link href="/" className="group flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[rgba(212,175,55,0.42)] bg-[linear-gradient(145deg,#101a43,#050b1d)] text-sm font-black tracking-[0.08em] text-[var(--gold)] shadow-[0_10px_26px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.06)] transition-transform duration-200 group-hover:-translate-y-0.5">
                  JG
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-black uppercase tracking-[0.16em] text-white sm:text-sm">
                    JG Creative Studio
                  </span>
                  <span className="hidden text-[0.68rem] font-medium tracking-wide text-[var(--muted)] sm:block">
                    Websites · AI Systems · Growth Technology
                  </span>
                </span>
              </Link>

              <nav className="hidden items-center gap-7 text-xs font-bold text-slate-300 lg:flex">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="transition-colors hover:text-[var(--gold)]"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              <div className="flex shrink-0 items-center gap-3">
                <Link
                  href="/contact"
                  className="hidden rounded-lg border border-[rgba(212,175,55,0.42)] bg-[rgba(14,22,62,0.72)] px-4 py-2 text-xs font-black text-white shadow-[0_10px_24px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:-translate-y-0.5 hover:border-[rgba(245,158,11,0.55)] sm:inline-flex"
                >
                  Start a Project
                </Link>
                <Link
                  href="/contact"
                  aria-label="Contact JG Creative Studio"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[linear-gradient(180deg,#e1bd45,#b88c1f)] text-lg font-black text-[#07101f] shadow-[0_12px_26px_rgba(212,175,55,0.2),inset_0_1px_0_rgba(255,255,255,0.38)] transition hover:-translate-y-0.5 sm:hidden"
                >
                  ↗
                </Link>
              </div>
            </div>

            <nav className="border-t border-white/[0.05] px-4 py-2 lg:hidden">
              <div className="mx-auto flex max-w-full items-center gap-5 overflow-x-auto text-sm font-semibold text-slate-300 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="shrink-0 transition-colors hover:text-[var(--gold)]"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </nav>
          </header>

          <main className="min-h-[70vh]">{children}</main>

          <footer className="mt-24 border-t border-[var(--border)] bg-[rgba(4,8,24,0.82)]">
            <div className="mx-auto grid w-full max-w-[90rem] gap-10 px-6 py-14 sm:px-8 md:grid-cols-[1.35fr_0.8fr_1fr] lg:px-10">
              <div>
                <p className="text-lg font-black uppercase tracking-[0.14em] text-white">
                  JG Creative Studio
                </p>
                <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--muted)]">
                  We build premium websites, practical AI business systems, and
                  custom growth technology designed to help businesses operate
                  better and win more customers.
                </p>
                <p className="mt-5 text-sm text-slate-400">
                  Built by the creator of <span className="font-bold text-[var(--gold)]">LEADFORGE</span>.
                </p>
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--gold)]">
                  Explore
                </p>
                <div className="mt-5 grid gap-3 text-sm font-semibold text-slate-300">
                  <Link href="/services" className="hover:text-white">Websites</Link>
                  <Link href="/ai-tools" className="hover:text-white">AI Systems</Link>
                  <Link href="/examples" className="hover:text-white">Portfolio</Link>
                  <Link href="/about" className="hover:text-white">About</Link>
                  <Link href="/contact" className="hover:text-white">Contact</Link>
                </div>
              </div>

              <div className="rounded-3xl border border-[rgba(212,175,55,0.24)] bg-[#030713] p-7 shadow-[0_24px_60px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.05)]">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--gold)]">
                  Build something useful
                </p>
                <p className="mt-3 text-xl font-black leading-snug text-white">
                  Turn your next website or AI idea into a real business asset.
                </p>
                <Link
                  href="/contact"
                  className="mt-6 inline-flex rounded-xl bg-[linear-gradient(180deg,#e1bd45,#b88c1f)] px-5 py-3 text-sm font-black text-[#07101f] shadow-[0_12px_26px_rgba(212,175,55,0.18),inset_0_1px_0_rgba(255,255,255,0.36)] transition hover:-translate-y-0.5"
                >
                  Start your project →
                </Link>
              </div>
            </div>

            <div className="border-t border-white/[0.06]">
              <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-2 px-6 py-5 text-xs text-slate-500 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
                <p>© {year} JG Creative Studio. All rights reserved.</p>
                <a
                  href="mailto:hello@jgcreativestudios.com"
                  className="transition-colors hover:text-[var(--gold)]"
                >
                  hello@jgcreativestudios.com
                </a>
              </div>
            </div>
          </footer>

          <JGChatWidget />
        </div>
      </body>
    </html>
  );
}
