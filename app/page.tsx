export default function Home() {
  return (
  <main className="min-h-screen bg-slate-50 text-slate-900">
  {/* HERO */}
  <section className="mx-auto max-w-5xl px-6 py-20">
  <div className="rounded-3xl border border-slate-200 bg-white p-12 shadow-sm">
  <h1 className="text-5xl font-black tracking-tight">
  Local Business Help
  <span className="block bg-gradient-to-r from-indigo-500 to-cyan-400 bg-clip-text text-transparent">
  Bold. Modern. Professional.
  </span>
  </h1>
  
  <p className="mt-6 max-w-xl text-lg text-slate-600">
  Creative support that helps small businesses look legit, modern, and
  easy to trust.
  </p>
  
  {/* BUTTONS */}
  <div className="mt-8 flex gap-4 flex-wrap">
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
  
  {/* STATS */}
  <div className="mt-10 grid gap-4 md:grid-cols-3">
  <Stat label="Turnaround" value="24–72h" />
  <Stat label="Process" value="Simple" />
  <Stat label="Style" value="Modern" />
  </div>
  </div>
  </section>
  
  {/* WHAT I DO */}
  <section className="mx-auto max-w-5xl px-6 pb-20">
  <h2 className="text-3xl font-black mb-8">What I Do</h2>
  
  <div className="grid gap-6 md:grid-cols-2">
  {/* ✅ Website Services Added */}
  <Card
  title="Website Creation + Updates"
  desc="Modern multi-page websites + simple maintenance so your business looks professional online."
  />
  
  <Card
  title="Flyers + Social Media"
  desc="Modern Canva designs and post packs sized correctly for IG + Facebook."
  />
  
  <Card
  title="Admin Assistance"
  desc="Scheduling, spreadsheets, organization, inbox drafts — fast and reliable."
  />
  
  <Card
  title="AI Templates"
  desc="Reply scripts, intake forms, and workflows that save time every week."
  />
  </div>
  
  {/* Bottom Button */}
  <div className="mt-10 text-center">
  <a
  href="/services"
  className="inline-block rounded-xl bg-[var(--navy)] px-8 py-3 font-semibold text-white hover:opacity-90"
  >
  View All Services →
  </a>
  </div>
  </section>
  
  {/* ✅ CLEAN FOOTER CTA */}
  <section className="bg-[var(--navy)] text-white py-14 px-6">
  <div className="mx-auto max-w-5xl text-center">
  <h3 className="text-3xl font-black">Not sure what you need?</h3>
  
  <p className="mt-3 text-white/80 max-w-2xl mx-auto">
  Send a quick message with your business type and what you’re trying
  to improve. I’ll recommend the simplest option that gets you results.
  </p>
  
  <a
  href="/contact"
  className="mt-7 inline-block rounded-xl bg-[var(--gold)] px-8 py-3 font-semibold text-[var(--navy)] hover:opacity-90"
  >
  Contact Me →
  </a>
  </div>
  </section>
  </main>
  );
  }
  
  /* COMPONENTS */
  
  function Card({ title, desc }: { title: string; desc: string }) {
  return (
  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition">
  <h3 className="font-black text-lg">{title}</h3>
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
  