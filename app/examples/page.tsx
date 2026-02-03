import Link from "next/link";

export const metadata = {
title: "Portfolio",
};

const flyers = [
{
src: "https://i.postimg.cc/C51S6jMX/E40EE0C3-3041-41EB-8E02-B6C9FF99416E.jpg",
alt: "Flyer collage example 1",
},
{
src: "https://i.postimg.cc/1zQPZx53/FE048F29-6FB8-4500-9C49-532FCD68D4FC.jpg",
alt: "Flyer collage example 2",
},
// ✅ Add your 3rd collage link here when ready:
// { src: "PASTE_THIRD_COLLAGE_LINK_HERE", alt: "Flyer collage example 3" },
];

const websiteConcepts = [
{
title: "Local Restaurant",
desc: "Menu + hours + online ordering / reservations layout concept.",
href: "/contact",
},
{
title: "Home Services",
desc: "Lead-generating homepage with clear services + quote request CTA.",
href: "/contact",
},
{
title: "Fitness Coach",
desc: "Bold hero, program highlights, and simple booking flow concept.",
href: "/contact",
},
];

const aiTemplates = [
{
title: "Review Reply Templates",
desc: "Polished responses for Google reviews — positive, neutral, or negative.",
},
{
title: "Social Post Captions",
desc: "Ready-to-use captions with hooks, CTAs, and hashtag sets by industry.",
},
{
title: "Customer Follow-up Messages",
desc: "Text/email templates to convert leads and bring customers back.",
},
];

export default function ExamplesPage() {
return (
<main className="min-h-screen bg-slate-50 text-slate-900">
<section className="mx-auto max-w-6xl px-6 py-16 space-y-12">
{/* Header */}
<header className="text-center space-y-3">
<h1 className="text-4xl md:text-5xl font-black">Portfolio</h1>
<p className="text-slate-600 text-lg max-w-3xl mx-auto">
A quick look at the style and quality you can expect — flyers, sample
website concepts, and AI templates that help businesses move faster.
</p>
</header>

{/* Flyers */}
<section className="space-y-5">
<div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
<div>
<h2 className="text-3xl font-black">Flyer & Promo Designs</h2>
<p className="text-slate-600 mt-1">
Clean layouts that are easy to read and designed to get attention.
</p>
</div>
<Link
href="/contact"
className="inline-flex rounded-xl bg-[var(--navy)] px-6 py-3 font-semibold text-white hover:opacity-90"
>
Request a flyer →
</Link>
</div>

<div className="grid gap-6 md:grid-cols-2">
{flyers.map((img) => (
<div
key={img.src}
className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
>
{/* eslint-disable-next-line @next/next/no-img-element */}
<img
src={img.src}
alt={img.alt}
className="w-full rounded-2xl object-cover"
/>
</div>
))}
</div>

<p className="text-sm text-slate-500">
Want a specific style? Send a reference and I’ll match the vibe.
</p>
</section>

{/* Website Concepts */}
<section className="space-y-5">
<div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
<div>
<h2 className="text-3xl font-black">Website Concepts</h2>
<p className="text-slate-600 mt-1">
Professional layouts built for clarity, speed, and conversions.
</p>
</div>
<Link
href="/services"
className="inline-flex rounded-xl bg-[var(--gold)] px-6 py-3 font-semibold text-[var(--navy)] hover:opacity-90"
>
View website services →
</Link>
</div>

<div className="grid gap-6 md:grid-cols-3">
{websiteConcepts.map((w) => (
<div
key={w.title}
className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm"
>
<p className="text-sm font-semibold text-slate-500">CONCEPT</p>
<h3 className="mt-2 text-xl font-black">{w.title}</h3>
<p className="mt-2 text-slate-600">{w.desc}</p>
<Link
href={w.href}
className="mt-5 inline-block font-semibold text-[var(--navy)] hover:underline"
>
Ask about this style →
</Link>
</div>
))}
</div>

<div className="rounded-3xl bg-white border border-slate-200 p-8">
<h3 className="text-xl font-black">Want your own concept?</h3>
<p className="mt-2 text-slate-600">
If you tell me your business type and what you want your site to do
(calls, bookings, quotes, etc.), I can recommend a layout and build it.
</p>
<Link
href="/contact"
className="mt-5 inline-flex rounded-xl bg-[var(--navy)] px-6 py-3 font-semibold text-white hover:opacity-90"
>
Get a website recommendation →
</Link>
</div>
</section>

{/* AI Templates */}
<section className="space-y-5">
<div className="text-center space-y-2">
<h2 className="text-3xl font-black">AI Templates & Systems</h2>
<p className="text-slate-600 max-w-3xl mx-auto">
Plug-and-play templates that save time and keep your communication consistent.
</p>
</div>

<div className="grid gap-6 md:grid-cols-3">
{aiTemplates.map((t) => (
<div
key={t.title}
className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm"
>
<p className="text-sm font-semibold text-slate-500">TEMPLATE</p>
<h3 className="mt-2 text-xl font-black">{t.title}</h3>
<p className="mt-2 text-slate-600">{t.desc}</p>
</div>
))}
</div>

<div className="text-center">
<Link
href="/contact"
className="inline-flex rounded-xl bg-[var(--gold)] px-7 py-3 font-semibold text-[var(--navy)] hover:opacity-90"
>
Ask about templates →
</Link>
</div>
</section>
</section>
</main>
);
}
