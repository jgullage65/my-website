import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";

const siteName = "JG Creative Studio LLC";
const siteDescription =
  "Modern websites, flyers, social content, and AI templates — built clean and delivered fast.";

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
    siteName: siteName,
    images: [
      {
        url: ogImage,
        width: 1200,
        height: 630,
        alt: "JG Creative Studio Social Preview",
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
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const year = new Date().getFullYear();

  return (
    <html lang="en">
      <body className="text-slate-900">
        {/* ✅ LOGO HEADER */}
        <div className="bg-white border-b border-slate-200">
          <div className="mx-auto max-w-6xl px-6 pt-10 pb-6 text-center">
            <img
              src="https://i.postimg.cc/3rsp4TY3/D8CD1815-549F-4A0F-9BF3-07BE21197B9D.jpg"
              alt="JG Creative Studio Logo"
              className="mx-auto h-56 w-auto"
            />

            <p className="mt-3 text-sm md:text-base text-slate-600">
              Websites • Flyers • Social Content • AI Templates
            </p>
          </div>

          {/* ✅ NAVBAR */}
          <header className="bg-[var(--navy)] text-white">
            <div className="mx-auto max-w-6xl px-6 py-4">
              <nav className="flex flex-wrap justify-center gap-8 text-sm font-semibold">
                <Link className="hover:text-[var(--gold)]" href="/">
                  Home
                </Link>

                <Link className="hover:text-[var(--gold)]" href="/services">
                  Services
                </Link>

                <Link className="hover:text-[var(--gold)]" href="/pricing">
                  Pricing
                </Link>

                <Link className="hover:text-[var(--gold)]" href="/payments">
                  Payments
                </Link>

                <Link className="hover:text-[var(--gold)]" href="/ai-tools">
                  AI Tools
                </Link>

                <Link className="hover:text-[var(--gold)]" href="/examples">
                  Examples
                </Link>

                <Link className="hover:text-[var(--gold)]" href="/faq">
                  FAQ
                </Link>

                <Link className="hover:text-[var(--gold)]" href="/about">
                  About
                </Link>

                <Link className="hover:text-[var(--gold)]" href="/contact">
                  Contact
                </Link>
              </nav>
            </div>
          </header>
        </div>

        {/* ✅ PAGE CONTENT */}
        <main className="min-h-[70vh]">{children}</main>

        {/* ✅ PREMIUM FOOTER */}
        <footer className="mt-20 border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-6 py-12 grid gap-10 md:grid-cols-3">
            {/* Brand */}
            <div>
              <p className="text-lg font-black text-slate-900">
                JG Creative Studio
              </p>

              <p className="mt-2 text-slate-600">
                Clean, modern websites and content that help your business look
                legit and get customers.
              </p>

              <p className="mt-4 text-sm text-slate-500">
                Email:{" "}
                <a
                  className="font-semibold text-[var(--navy)] hover:underline"
                  href="mailto:hello@jgcreativestudios.com"
                >
                  hello@jgcreativestudios.com
                </a>
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <p className="text-sm font-black tracking-wide text-slate-900">
                QUICK LINKS
              </p>

              <div className="mt-4 grid gap-2 text-slate-700">
                <Link className="hover:text-[var(--navy)]" href="/services">
                  Services
                </Link>

                <Link className="hover:text-[var(--navy)]" href="/pricing">
                  Pricing
                </Link>

                <Link className="hover:text-[var(--navy)]" href="/payments">
                  Payments
                </Link>

                <Link className="hover:text-[var(--navy)]" href="/ai-tools">
                  AI Tools
                </Link>

                <Link className="hover:text-[var(--navy)]" href="/examples">
                  Examples
                </Link>

                <Link className="hover:text-[var(--navy)]" href="/faq">
                  FAQ
                </Link>

                <Link className="hover:text-[var(--navy)]" href="/about">
                  About
                </Link>

                <Link className="hover:text-[var(--navy)]" href="/contact">
                  Contact
                </Link>
              </div>
            </div>

            {/* CTA Box */}
            <div className="rounded-3xl bg-[var(--navy)] p-8 text-white">
              <p className="text-sm font-semibold text-white/80">
                READY TO START?
              </p>

              <p className="mt-2 text-xl font-black leading-snug">
                Tell me what you need — I’ll recommend the simplest path.
              </p>

              <p className="mt-2 text-white/80">
                Websites, flyers, social posts, and helpful AI templates.
              </p>

              <Link
                href="/contact"
                className="mt-5 inline-block rounded-xl bg-[var(--gold)] px-6 py-3 font-semibold text-[var(--navy)] hover:opacity-90"
              >
                Contact Me →
              </Link>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-slate-200">
            <div className="mx-auto max-w-6xl px-6 py-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between text-sm text-slate-500">
              <p>© {year} JG Creative Studio. All rights reserved.</p>

              <p>
                Built with care •{" "}
                <Link className="hover:underline" href="/contact">
                  Get a quote
                </Link>
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}