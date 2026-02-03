export const metadata = {
  title: "Contact",
  };
  
  export default function ContactPage() {
  return (
  <main className="min-h-screen bg-slate-50 text-slate-900">
  <section className="mx-auto max-w-5xl px-6 py-16 space-y-10">
  {/* Header */}
  <header className="space-y-3 text-center">
  <h1 className="text-4xl font-black">Contact</h1>
  <p className="text-slate-600 text-lg max-w-2xl mx-auto">
  Ready to get started? Send a message and I’ll respond as soon as
  possible.
  </p>
  </header>
  
  {/* Contact Box */}
  <div className="grid gap-8 md:grid-cols-2">
  {/* Email Info */}
  <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm space-y-4">
  <h2 className="text-2xl font-black">Email Me Directly</h2>
  
  <p className="text-slate-600">
  The fastest way to reach me is by email:
  </p>
  
  <p className="text-lg font-semibold text-[var(--navy)]">
  <a
  href="mailto:hello@jgcreativestudios.com"
  className="hover:underline"
  >
  hello@jgcreativestudios.com
  </a>
  </p>
  
  <p className="text-slate-600">
  Tell me what kind of business you run and what you need help with —
  website, flyers, social content, or AI templates.
  </p>
  </div>
  
  {/* Contact Form */}
  <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm space-y-4">
  <h2 className="text-2xl font-black">Send a Message</h2>
  
  <form
  action="https://formspree.io/f/mlgldrnk"
  method="POST"
  className="space-y-4"
  >
  <input
  type="text"
  name="name"
  placeholder="Your Name"
  required
  className="w-full rounded-xl border border-slate-300 px-4 py-3"
  />
  
  <input
  type="email"
  name="email"
  placeholder="Your Email"
  required
  className="w-full rounded-xl border border-slate-300 px-4 py-3"
  />
  
  <textarea
  name="message"
  placeholder="Tell me what you need help with..."
  required
  rows={5}
  className="w-full rounded-xl border border-slate-300 px-4 py-3"
  />
  
  <button
  type="submit"
  className="w-full rounded-xl bg-[var(--navy)] py-3 font-semibold text-white hover:opacity-90"
  >
  Send Message →
  </button>
  </form>
  
  <p className="text-xs text-slate-500 pt-2">
  Messages go directly to my inbox. I typically respond within 24
  hours.
  </p>
  </div>
  </div>
  </section>
  </main>
  );
  }
  