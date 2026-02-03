import "./globals.css";
import type { Metadata } from "next";

const siteUrl = "https://example.com"; // <- we will replace this AFTER you deploy (Step 7)
const siteName = "JG Creative Studio";
const siteDescription =
"Clean, modern websites and content that help your business look legit — websites, flyers, social content, and AI templates.";

export const metadata: Metadata = {
metadataBase: new URL(siteUrl),
title: {
default: siteName,
template: `%s | ${siteName}`,
},
description: siteDescription,
applicationName: siteName,
authors: [{ name: "James Gullage" }],
creator: "James Gullage",
keywords: [
"web design",
"small business website",
"flyer design",
"social media graphics",
"AI templates",
"website maintenance",
],
openGraph: {
type: "website",
url: siteUrl,
title: siteName,
description: siteDescription,
siteName,
images: [
{
url: "/og.jpg", // we'll add this file in the next tiny step
width: 1200,
height: 630,
alt: "JG Creative Studio",
},
],
},
twitter: {
card: "summary_large_image",
title: siteName,
description: siteDescription,
images: ["/og.jpg"],
},
icons: {
icon: "/favicon.ico",
},
};

export default function RootLayout({
children,
}: {
children: React.ReactNode;
}) {
const year = new Date().getFullYear();

return (
<html lang="en">
<body className="bg-slate-50 text-slate-900">
{/* BRAND HEADER */}
<div className="bg-slate-50">
<div className="mx-auto max-w-6xl px-6 pt-10 pb-6 text-center">
<h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900">
JG Creative Studio
</h1>
<p className="mt-2 text-sm md:text-base text-slate-600">
Websites • Flyers • Social Content • AI Templates
</p>
</div>
</div>

{/* NAVBAR */}
<header className="bg-[var(--navy)] text-white">
<div className="mx-auto max-w-6xl px-6 py-4">
<nav className="flex flex-wrap justify-center gap-8 text-sm font-semibold">
<a className="hover:text-[var(--gold)]" href="/">
Home
</a>
<a className="hover:text-[var(--gold)]" href="/services">
Services
</a>
<a className="hover:text-[var(--gold)]" href="/pricing">
Pricing
</a>
<a className="hover:text-[var(--gold)]" href="/examples">
Examples
</a>
<a className="hover:text-[var(--gold)]" href="/faq">
FAQ
</a>
<a className="hover:text-[var(--gold)]" href="/about">
About
</a>
<a className="hover:text-[var(--gold)]" href="/contact">
Contact
</a>
</nav>
</div>
</header>

{/* PAGE CONTENT */}
<main className="min-h-[70vh]">{children}</main>

{/* FOOTER */}
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
href="mailto:jgullage65@gmail.com"
>
jgullage65@gmail.com
</a>
</p>
</div>

{/* Quick Links */}
<div>
<p className="text-sm font-black tracking-wide text-slate-900">
QUICK LINKS
</p>
<div className="mt-4 grid gap-2 text-slate-700">
<a className="hover:text-[var(--navy)]" href="/services">
Services
</a>
<a className="hover:text-[var(--navy)]" href="/pricing">
Pricing
</a>
<a className="hover:text-[var(--navy)]" href="/examples">
Examples
</a>
<a className="hover:text-[var(--navy)]" href="/faq">
FAQ
</a>
<a className="hover:text-[var(--navy)]" href="/about">
About
</a>
<a className="hover:text-[var(--navy)]" href="/contact">
Contact
</a>
</div>
</div>

{/* CTA */}
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
<a
href="/contact"
className="mt-5 inline-block rounded-xl bg-[var(--gold)] px-6 py-3 font-semibold text-[var(--navy)] hover:opacity-90"
>
Contact Me →
</a>
</div>
</div>

<div className="border-t border-slate-200">
<div className="mx-auto max-w-6xl px-6 py-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between text-sm text-slate-500">
<p>© {year} JG Creative Studio. All rights reserved.</p>
<p>
Built with care •{" "}
<a className="hover:underline" href="/contact">
Get a quote
</a>
</p>
</div>
</div>
</footer>
</body>
</html>
);
}
