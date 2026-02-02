export default function ContactPage() {
  return (
  <main className="min-h-screen bg-slate-50 text-slate-900">
  <section className="mx-auto max-w-3xl px-6 py-16">
  <h1 className="text-4xl font-black">Contact</h1>
  <p className="mt-3 text-slate-600">
  Send a message and I’ll reply ASAP.
  </p>
  
  <form
  className="mt-10 space-y-5 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"
  action="https://formspree.io/f/mlgldrnk"
  method="POST"
  >
  <div>
  <label className="block text-sm font-semibold">Name</label>
  <input
  name="name"
  required
  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400"
  placeholder="Your name"
  />
  </div>
  
  <div>
  <label className="block text-sm font-semibold">Email</label>
  <input
  name="email"
  type="email"
  required
  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400"
  placeholder="you@email.com"
  />
  </div>
  
  <div>
  <label className="block text-sm font-semibold">Message</label>
  <textarea
  name="message"
  required
  rows={6}
  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400"
  placeholder="What do you need help with?"
  />
  </div>
  
  {/* Formspree options */}
  <input type="hidden" name="_subject" value="New Website Help inquiry" />
  <input type="hidden" name="_redirect" value="/thank-you" />
  
  <button
  type="submit"
  className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-400 px-6 py-3 font-semibold text-white shadow hover:opacity-90"
  >
  Send Message →
  </button>
  </form>
  
  <div className="mt-6">
  <a
  href="/"
  className="inline-block rounded-xl border border-slate-300 bg-white px-5 py-2 font-semibold hover:bg-slate-100"
  >
  ← Back to Home
  </a>
  </div>
  </section>
  </main>
  );
  }
  