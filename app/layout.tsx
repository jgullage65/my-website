import "./globals.css";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import JGChatWidget from "./components/JGChatWidget";
import SiteNavLinks from "./components/SiteNavLinks";
import { ClerkProvider } from "@clerk/nextjs";

const siteName = "JG Creative Studio";
const siteDescription =
  "Premium websites, custom AI business systems, and growth technology built for modern businesses.";

const ogImage =
  "/image/ChatGPT%20Image%20Jul%2017,%202026,%2001_50_33%20AM.png";

const clerkAppearance = {
  layout: {
    logoImageUrl: "/apple-touch-icon.png",
    logoLinkUrl: "/",
    socialButtonsVariant: "blockButton" as const,
  },
  variables: {
    colorPrimary: "#d4af37",
    colorPrimaryForeground: "#030713",
    colorBackground: "#030713",
    colorForeground: "#ebf0ff",
    colorMuted: "#081226",
    colorMutedForeground: "#a0aac8",
    colorInput: "#020611",
    colorInputForeground: "#ebf0ff",
    colorBorder: "rgba(212, 175, 55, 0.22)",
    colorRing: "#f59e0b",
    colorModalBackdrop: "rgba(2, 6, 17, 0.86)",
    colorShadow: "#000000",
    borderRadius: "0.75rem",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontFamilyButtons:
      'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  elements: {
    modalBackdrop: {
      backdropFilter: "blur(10px)",
    },
    modalContent: {
      borderRadius: "24px",
    },
    card: {
      background: "#030713",
      border: "1px solid rgba(245, 158, 11, 0.22)",
      borderRadius: "24px",
      boxShadow:
        "0 26px 70px rgba(0, 0, 0, 0.48), 0 0 50px rgba(245, 158, 11, 0.07)",
    },
    logoImage: {
      height: "42px",
      width: "42px",
    },
    headerTitle: {
      color: "#ffffff",
      fontWeight: "800",
      letterSpacing: "-0.025em",
    },
    headerSubtitle: {
      color: "#a0aac8",
    },
    socialButtonsBlockButton: {
      background: "#081226",
      border: "1px solid rgba(245, 158, 11, 0.18)",
      color: "#ffffff",
      boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05)",
      fontWeight: "700",
    },
    socialButtonsBlockButtonText: {
      color: "#ffffff",
    },
    dividerLine: {
      background: "rgba(212, 175, 55, 0.18)",
    },
    dividerText: {
      color: "#a0aac8",
    },
    formFieldLabel: {
      color: "#ebf0ff",
      fontWeight: "700",
    },
    formFieldInput: {
      background: "#020611",
      border: "1px solid rgba(212, 175, 55, 0.22)",
      color: "#ebf0ff",
      boxShadow: "none",
    },
    formButtonPrimary: {
      background: "#081226",
      border: "1px solid rgba(245, 158, 11, 0.28)",
      color: "#ffffff",
      boxShadow:
        "0 14px 34px rgba(245, 158, 11, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
      fontWeight: "800",
    },
    footerActionLink: {
      color: "#d4af37",
      fontWeight: "700",
    },
    identityPreview: {
      background: "#081226",
      border: "1px solid rgba(212, 175, 55, 0.18)",
    },
    identityPreviewText: {
      color: "#ebf0ff",
    },
    modalCloseButton: {
      color: "#d4af37",
      border: "1px solid rgba(245, 158, 11, 0.22)",
      background: "#030713",
    },
  },
};

export const metadata: Metadata = {
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  metadataBase: new URL("https://jgcreativestudios.com"),
  themeColor: "#030713",
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
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

const footerNavItems = [
  { href: "/services", label: "Websites" },
  { href: "/ai-tools", label: "AI Systems" },
  { href: "/services", label: "Services" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  if (
    process.env.NODE_ENV === "production" &&
    (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY)
  ) {
    throw new Error(
      "Clerk authentication is not configured: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY are required.",
    );
  }

  const year = new Date().getFullYear();

  return (
    <html lang="en">
      <body>
        <ClerkProvider appearance={clerkAppearance}>
        <div className="site-background" aria-hidden="true">
          <div className="site-background__depth" />
          <div className="site-background__grid" />
          <div className="site-background__contours" />
          <svg
            className="site-background__field"
            viewBox="0 0 1440 900"
            preserveAspectRatio="none"
            focusable="false"
          >
            <g className="site-background__field-band site-background__field-band--gold">
              <path d="M-180 90 C90 10 250 175 470 95 S820 5 1080 105 S1370 175 1620 65" />
              <path d="M-180 150 C80 70 255 235 485 155 S825 70 1095 165 S1370 235 1620 125" />
              <path d="M-180 215 C75 130 260 300 500 220 S830 135 1110 230 S1380 300 1620 190" />
              <path d="M-180 285 C70 195 270 365 520 285 S845 200 1130 295 S1390 365 1620 255" />
              <path d="M-180 360 C65 270 280 440 540 360 S860 275 1150 370 S1400 440 1620 330" />
              <path d="M-180 440 C60 350 290 520 560 440 S875 355 1170 450 S1410 520 1620 410" />
              <path d="M-180 525 C55 435 300 605 580 525 S890 440 1190 535 S1420 605 1620 495" />
              <path d="M-180 615 C50 525 310 695 600 615 S905 530 1210 625 S1430 695 1620 585" />
              <path d="M-180 710 C45 620 320 790 620 710 S920 625 1230 720 S1440 790 1620 680" />
              <path d="M-180 810 C40 720 330 890 640 810 S935 725 1250 820 S1450 890 1620 780" />
            </g>
            <g className="site-background__field-band site-background__field-band--blue">
              <path d="M-220 55 C120 210 300 -25 570 105 S925 230 1180 80 S1450 -10 1660 145" />
              <path d="M-220 190 C110 345 315 110 590 240 S940 365 1200 215 S1460 125 1660 280" />
              <path d="M-220 330 C100 485 330 250 610 380 S955 505 1220 355 S1470 265 1660 420" />
              <path d="M-220 475 C90 630 345 395 630 525 S970 650 1240 500 S1480 410 1660 565" />
              <path d="M-220 625 C80 780 360 545 650 675 S985 800 1260 650 S1490 560 1660 715" />
              <path d="M-220 780 C70 935 375 700 670 830 S1000 955 1280 805 S1500 715 1660 870" />
            </g>
          </svg>
          <div className="site-background__nodes" />
          <div className="site-background__scan" />
          <div className="site-background__particles" />
          <div className="site-background__readability" />
          <div className="site-background__grain" />
        </div>

        <div className="relative z-10 min-h-screen overflow-x-hidden">
          <header className="sticky top-0 z-50 border-b border-[rgba(212,175,55,0.16)] bg-[rgba(3,7,19,0.78)] backdrop-blur-xl">
            <div className="relative mx-auto my-2 flex min-h-14 w-[calc(100%-1.5rem)] max-w-[90rem] items-center justify-between gap-5 rounded-2xl border border-[rgba(212,175,55,0.22)] bg-[rgba(5,12,27,0.88)] px-4 py-2 shadow-[0_18px_60px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.05)] sm:w-[calc(100%-3rem)] sm:px-5 lg:px-6">
              <Link href="/" className="group flex min-w-0 items-center gap-3">
                <Image
                  src="/apple-touch-icon.png"
                  alt="JG Creative Studio"
                  width={40}
                  height={40}
                  className="h-10 w-10 shrink-0 rounded-lg shadow-[0_10px_26px_rgba(0,0,0,0.34)] transition-transform duration-200 group-hover:-translate-y-0.5"
                />
                <span className="absolute left-1/2 top-1/2 min-w-0 -translate-x-1/2 -translate-y-1/2 text-center sm:static sm:translate-x-0 sm:translate-y-0 sm:text-left">
                  <span className="block truncate text-xs font-black uppercase tracking-[0.16em] text-white sm:text-sm">
                    JG Creative Studio
                  </span>
                  <span className="hidden text-[0.68rem] font-medium tracking-wide text-[var(--muted)] sm:block">
                    Websites · AI Systems · Growth Technology
                  </span>
                </span>
              </Link>

              <nav className="hidden -translate-x-10 items-center gap-7 text-xs font-bold text-slate-300 lg:flex xl:-translate-x-14">
                <SiteNavLinks />
              </nav>

              <div className="flex shrink-0 items-center gap-3">
                <Link
                  href="/contact"
                  className="hidden rounded-lg border border-amber-300/15 bg-[#081226] px-4 py-2 text-xs font-black text-white shadow-[0_10px_24px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-[#0b1830] sm:inline-flex"
                >
                  Start a Project
                </Link>
                <Link
                  href="/contact"
                  aria-label="Contact JG Creative Studio"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-amber-300/15 bg-[#081226] text-lg font-black text-white shadow-[0_12px_26px_rgba(212,175,55,0.2),inset_0_1px_0_rgba(255,255,255,0.38)] transition hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-[#0b1830] sm:hidden"
                >
                  ↗
                </Link>
              </div>
            </div>

            <nav className="border-t border-white/[0.05] px-3 py-2 lg:hidden">
              <div className="mx-auto flex w-full items-center justify-between overflow-hidden text-[0.6rem] font-semibold text-slate-300 min-[390px]:text-[0.66rem]">
                <SiteNavLinks mobile />
              </div>
            </nav>
          </header>

          <main className="site-page-shell min-h-[70vh]">{children}</main>

          <footer className="mt-24 border-t border-[var(--border)] bg-[rgba(4,8,24,0.82)]">
            <div className="mx-auto grid w-full max-w-[90rem] gap-10 px-6 py-14 sm:px-8 md:grid-cols-[1.35fr_0.8fr_1fr] lg:px-10">
              <div className="text-center md:text-left">
                <p className="text-lg font-black uppercase tracking-[0.14em] text-[var(--gold)]">
                  JG Creative Studio
                </p>
                <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[var(--muted)] md:mx-0">
                  We build premium websites, practical AI business systems, and
                  custom growth technology designed to help businesses operate
                  better and win more customers.
                </p>
              </div>

              <div className="text-center md:text-left">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--gold)]">
                  Explore
                </p>
                <div className="mt-5 grid grid-cols-3 gap-x-4 gap-y-4 text-sm font-semibold text-slate-300 md:grid-cols-1 md:gap-3">
                  {footerNavItems.map((item) => (
                    <Link key={`${item.label}-${item.href}`} href={item.href} className="hover:text-white">
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-[rgba(212,175,55,0.24)] bg-[#030713] p-7 text-center shadow-[0_24px_60px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.05)]">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--gold)]">
                  Build something useful
                </p>
                <p className="mt-3 text-xl font-black leading-snug text-white">
                  Turn your next website or AI idea into a real business asset.
                </p>
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
                  <a
                    href="mailto:hello@jgcreativestudios.com"
                    className="transition-colors hover:text-[var(--gold)]"
                  >
                    hello@jgcreativestudios.com
                  </a>
                  <span aria-hidden="true">•</span>
                  <Link href="/faq" className="transition-colors hover:text-[var(--gold)]">
                    FAQ
                  </Link>
                </div>
              </div>
            </div>
          </footer>

          <JGChatWidget />
        </div>
        </ClerkProvider>
      </body>
    </html>
  );
}
