export default function Home() {
  return (
  <main className="min-h-screen bg-slate-50 text-slate-900">
  {/* HERO */}
  <section className="mx-auto max-w-6xl px-6 pt-12 pb-10">
  <div className="rounded-3xl border border-slate-200 bg-white p-12 shadow-sm">
  <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1 text-xs font-semibold text-slate-700">
  <span className="h-2 w-2 rounded-full bg-[var(--gold)]" />
  Fast turnaround • Simple process • Modern look
  </p>
  
  {/* ✅ SLIGHTLY BIGGER HEADING */}
  <h2 className="mt-6 text-5xl lg:text-6xl font-black tracking-tight">
  Modern design & websites for your business.
  </h2>
  
  <p className="mt-6 max-w-2xl text-lg text-slate-600">
  Websites, flyers, and content — built clean and delivered fast.
  </p>
  
  <div className="mt-8 flex flex-wrap gap-4">
  <a
  href="/contact"
  className="rounded-xl bg-[var(--navy)] px-6 py-3 font-semibold text-white shadow hover:opacity-90"
  >
  Get a Quote →
  </a>
  
  <a
  href="/services"
  className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-900 hover:bg-slate-100"
  >
  All Services →
  </a>
  </div>
  
  <div className="mt-10 grid gap-4 md:grid-cols-3">
  <Stat label="Turnaround" value="24–72h" />
  <Stat label="Approach" value="Simple" />
  <Stat label="Style" value="Modern" />
  </div>
  </div>
  </section>
  
  {/* WHAT I DO */}
  <section className="mx-auto max-w-6xl px-6 pb-16">
  <h3 className="text-3xl font-black mb-8">What I Do</h3>
  
  <div className="grid gap-6 md:grid-cols-2">
  <Card
  title="Website Creation + Updates"
  desc="Modern multi-page websites + maintenance so your business looks professional online."
  />
  <Card
  title="Flyers + Social Media"
  desc="Clean promo designs and simple post packs sized correctly for IG + Facebook."
  />
  <Card
  title="Admin Support"
  desc="Scheduling, spreadsheets, organization, and message templates to save you time."
  />
  <Card
  title="AI Templates"
  desc="Reusable scripts and workflows that help you respond faster and stay consistent."
  />
  </div>
  
  <div className="mt-10 text-center">
  <a
  href="/services"
  className="inline-block rounded-xl bg-[var(--navy)] px-8 py-3 font-semibold text-white hover:opacity-90"
  >
  View All Services →
  </a>
  </div>
  </section>
  
  {/* BOTTOM CTA */}
  <section className="bg-[var(--navy)] text-white py-14 px-6">
  <div className="mx-auto max-w-6xl text-center">
  <h4 className="text-3xl font-black">Not sure what you need?</h4>
  
  <p className="mt-3 text-white/80 max-w-2xl mx-auto">
  Send a quick message with what you’re trying to improve. I’ll recommend
  the simplest option that gets you results.
  </p>
  
  <div className="mt-7 flex flex-wrap justify-center gap-4">
  <a
  href="/contact"
  className="inline-block rounded-xl bg-[var(--gold)] px-8 py-3 font-semibold text-[var(--navy)] hover:opacity-90"
  >
  Contact Me →
  </a>
  
  <a
  href="/pricing"
  className="inline-block rounded-xl border border-white/20 bg-white/5 px-8 py-3 font-semibold text-white hover:bg-white/10"
  >
  View Pricing
  </a>
  </div>
  </div>
  </section>
  </main>
  );
  }
  
  /* Components */
  
  function Card({ title, desc }: { title: string; desc: string }) {
  return (
  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition">
  <h5 className="font-black text-lg">{title}</h5>
  <p className="mt-2 text-slate-600 text-sm leading-relaxed">{desc}</p>
  </div>
  );
  }
  
  function Stat({ label, value }: { label: string; value: string }) {
  return (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
  <div className="text-xs font-semibold text-slate-500">{label}</div>
  <div className="mt-1 text-lg font-black text-slate-900">{value}</div>
  </div>
  );
  }
  