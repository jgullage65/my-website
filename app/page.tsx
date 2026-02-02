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
  I help small businesses with flyers, social media content, admin
  support, and simple AI systems — all designed to look clean and
  professional.
  </p>
  
  <div className="mt-8 flex gap-4">
  <a
  href="#contact"
  className="rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-400 px-6 py-3 font-semibold text-white shadow hover:opacity-90"
  >
  Get a Quote →
  </a>
  
  <a
  href="#services"
  className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-900 hover:bg-slate-100"
  >
  View Services
  </a>
  </div>
  </div>
  </section>
  
  {/* SERVICES */}
  <section id="services" className="mx-auto max-w-5xl px-6 pb-20">
  <h2 className="text-3xl font-black mb-8">What I Do</h2>
  
  <div className="grid gap-6 md:grid-cols-3">
  <Card
  title="Flyers + Social Media"
  desc="Modern Canva designs and post packs sized perfectly for Instagram and Facebook."
  />
  <Card
  title="Admin Assistance"
  desc="Scheduling, spreadsheets, organization, and virtual support to save you time."
  />
  <Card
  title="AI Templates"
  desc="Smart scripts and workflows that make running your business easier."
  />
  </div>
  </section>
  
  {/* CONTACT */}
  <section
  id="contact"
  className="bg-slate-900 text-white py-20 px-6"
  >
  <div className="mx-auto max-w-3xl text-center space-y-4">
  <h3 className="text-4xl font-black">Ready to Start?</h3>
  <p className="text-white/80">
  Email me and let’s build something clean, modern, and client-friendly.
  </p>
  
  <a
  href="mailto:jgullage65@gmail.com"
  className="inline-block rounded-xl bg-gradient-to-r from-orange-400 to-cyan-400 px-8 py-3 font-semibold text-slate-900 hover:opacity-90"
  >
  Email Me →
  </a>
  </div>
  </section>
  </main>
  );
  }
  
  function Card({ title, desc }: { title: string; desc: string }) {
  return (
  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition">
  <h3 className="font-black text-lg">{title}</h3>
  <p className="mt-2 text-slate-600 text-sm leading-relaxed">{desc}</p>
  </div>
  );
  }
  