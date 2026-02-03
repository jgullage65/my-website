import Link from "next/link";

export const metadata = {
title: "Home",
};

export default function HomePage() {
return (
<main className="bg-slate-50">
{/* HERO */}
<section className="mx-auto max-w-6xl px-6 pt-14 pb-10 text-center">
<h1 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900">
Modern websites & content
<span className="block">for your business.</span>
</h1>

<p className="mx-auto mt-5 max-w-2xl text-lg md:text-xl text-slate-600">
I help businesses look legit online with clean websites, eye-catching
flyers, simple social content, and helpful AI templates — without the
stress.
</p>

<div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
<Link
href="/services"
className="rounded-xl bg-[var(--navy)] px-7 py-3 font-semibold text-white hover:opacity-90"
>
View Services
</Link>
<Link
href="/contact"
className="rounded-xl border border-slate-300 bg-white px-7 py-3 font-semibold text-slate-900 hover:bg-slate-100"
>
Get a Quote
</Link>
</div>

<p className="mt-4 text-sm text-slate-500">
Not sure what you need?{" "}
<Link href="/contact" className="font-semibold underline">
Message me
</Link>{" "}
and I’ll recommend the simplest path.
</p>
</section>

{/* TRUST STRIP */}
<section className="mx-auto max-w-6xl px-6 pb-10">
<div className="grid gap-4 md:grid-cols-4">
<div className="rounded-2xl border border-slate-200 bg-white p-5">
<p className="font-black text-slate-900">Fast turnaround</p>
<p className="mt-1 text-sm text-slate-600">
Clean work delivered quickly.
</p>
</div>
<div className="rounded-2xl border border-slate-200 bg-white p-5">
<p className="font-black text-slate-900">Affordable options</p>
<p className="mt-1 text-sm text-slate-600">
Pricing that makes sense starting out.
</p>
</div>
<div className="rounded-2xl border border-slate-200 bg-white p-5">
<p className="font-black text-slate-900">One-person studio</p>
<p className="mt-1 text-sm text-slate-600">
Direct communication with me.
</p>
</div>
<div className="rounded-2xl border border-slate-200 bg-white p-5">
<p className="font-black text-slate-900">Simple + modern</p>
<p className="mt-1 text-sm text-slate-600">
No clutter. Easy navigation.
</p>
</div>
</div>
</section>

{/* SERVICES PREVIEW */}
<section className="mx-auto max-w-6xl px-6 py-12">
<div className="flex items-end justify-between gap-4">
<div>
<h2 className="text-3xl font-black text-slate-900">
What I can help with
</h2>
<p className="mt-2 text-slate-600">
Choose one service or mix and match.
</p>
</div>
<Link
href="/services"
className="hidden sm:inline-flex rounded-xl bg-[var(--gold)] px-5 py-2 font-semibold text-[var(--navy)] hover:opacity-90"
>
All Services →
</Link>
</div>

<div className="mt-8 grid gap-6 md:grid-cols-3">
<div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
<p className="text-sm font-semibold text-slate-500">WEBSITES</p>
<h3 className="mt-2 text-xl font-black">Modern business websites</h3>
<p className="mt-2 text-slate-600">
A clean website that looks professional, loads fast, and helps
people contact you.
</p>
<Link
href="/services"
className="mt-5 inline-block font-semibold text-[var(--navy)] hover:underline"
>
Learn more →
</Link>
</div>

<div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
<p className="text-sm font-semibold text-slate-500">FLYERS</p>
<h3 className="mt-2 text-xl font-black">Flyers that get attention</h3>
<p className="mt-2 text-slate-600">
Promotions, events, menus, specials — designed to look clean and
easy to read.
</p>
<Link
href="/examples"
className="mt-5 inline-block font-semibold text-[var(--navy)] hover:underline"
>
See examples →
</Link>
</div>

<div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
<p className="text-sm font-semibold text-slate-500">SOCIAL</p>
<h3 className="mt-2 text-xl font-black">Simple social content</h3>
<p className="mt-2 text-slate-600">
Posts and graphics that match your brand and keep your page active
without extra stress.
</p>
<Link
href="/pricing"
className="mt-5 inline-block font-semibold text-[var(--navy)] hover:underline"
>
View pricing →
</Link>
</div>
</div>

<div className="mt-8 sm:hidden">
<Link
href="/services"
className="inline-flex rounded-xl bg-[var(--gold)] px-5 py-2 font-semibold text-[var(--navy)] hover:opacity-90"
>
All Services →
</Link>
</div>
</section>

{/* EXAMPLES PREVIEW */}
<section className="mx-auto max-w-6xl px-6 py-12">
<div className="rounded-3xl bg-white border border-slate-200 p-8 md:p-10">
<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
<div>
<h2 className="text-3xl font-black text-slate-900">
Want to see the style?
</h2>
<p className="mt-2 text-slate-600 max-w-2xl">
Check out flyer examples and sample site concepts so you can
picture what we can build for your business.
</p>
</div>
<Link
href="/examples"
className="inline-flex rounded-xl bg-[var(--navy)] px-7 py-3 font-semibold text-white hover:opacity-90"
>
View Examples →
</Link>
</div>
</div>
</section>

{/* HOW IT WORKS */}
<section className="mx-auto max-w-6xl px-6 py-12">
<h2 className="text-3xl font-black text-slate-900 text-center">
How it works
</h2>

<div className="mt-8 grid gap-6 md:grid-cols-3">
<div className="rounded-3xl border border-slate-200 bg-white p-7">
<p className="text-sm font-semibold text-slate-500">STEP 1</p>
<h3 className="mt-2 text-xl font-black">Tell me what you need</h3>
<p className="mt-2 text-slate-600">
Send a quick message about your business and your goal.
</p>
</div>

<div className="rounded-3xl border border-slate-200 bg-white p-7">
<p className="text-sm font-semibold text-slate-500">STEP 2</p>
<h3 className="mt-2 text-xl font-black">I recommend the best path</h3>
<p className="mt-2 text-slate-600">
I’ll suggest the simplest option that gets the result you want.
</p>
</div>

<div className="rounded-3xl border border-slate-200 bg-white p-7">
<p className="text-sm font-semibold text-slate-500">STEP 3</p>
<h3 className="mt-2 text-xl font-black">You get a finished product</h3>
<p className="mt-2 text-slate-600">
Clean deliverables, fast turnaround, and easy communication.
</p>
</div>
</div>
</section>

{/* FINAL CTA */}
<section className="mx-auto max-w-6xl px-6 pb-20">
<div className="rounded-3xl bg-[var(--navy)] text-white p-10 md:p-12 text-center">
<h2 className="text-3xl md:text-4xl font-black">
Ready to upgrade your business?
</h2>
<p className="mt-3 text-white/80 max-w-2xl mx-auto">
Message me and I’ll help you pick the best service and pricing for
what you’re trying to accomplish.
</p>
<div className="mt-7 flex flex-col sm:flex-row justify-center gap-4">
<Link
href="/contact"
className="rounded-xl bg-[var(--gold)] px-8 py-3 font-semibold text-[var(--navy)] hover:opacity-90"
>
Contact Me →
</Link>
<Link
href="/pricing"
className="rounded-xl border border-white/30 bg-transparent px-8 py-3 font-semibold hover:bg-white/10"
>
View Pricing
</Link>
</div>
</div>
</section>
</main>
);
}
