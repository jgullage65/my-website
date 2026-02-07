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
  
  {/* ✅ Project Request Intake Form (FIRST) */}
  <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
  <div className="text-center">
  <h2 className="text-3xl font-black">Project Request</h2>
  <p className="mt-2 text-slate-600 max-w-2xl mx-auto">
  Want the fastest quote? Fill this out and I’ll reply with a clear
  price range and timeline.
  </p>
  </div>
  
  <form
  action="https://formspree.io/f/mlgldrnk"
  method="POST"
  className="mt-8 grid gap-5"
  >
  {/* Helps you identify the submission type in your inbox */}
  <input type="hidden" name="form_type" value="Project Request" />
  
  <div className="grid gap-5 md:grid-cols-2">
  <div>
  <label className="text-sm font-semibold text-slate-800">
  Your Name
  </label>
  <input
  type="text"
  name="name"
  required
  placeholder="John Smith"
  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3"
  />
  </div>
  
  <div>
  <label className="text-sm font-semibold text-slate-800">
  Email
  </label>
  <input
  type="email"
  name="email"
  required
  placeholder="you@email.com"
  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3"
  />
  </div>
  </div>
  
  <div className="grid gap-5 md:grid-cols-2">
  <div>
  <label className="text-sm font-semibold text-slate-800">
  Business Name (optional)
  </label>
  <input
  type="text"
  name="business"
  placeholder="Your business"
  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3"
  />
  </div>
  
  <div>
  <label className="text-sm font-semibold text-slate-800">
  What do you need?
  </label>
  <select
  name="service"
  required
  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 bg-white"
  defaultValue=""
  >
  <option value="" disabled>
  Select one…
  </option>
  <option>Website Creation</option>
  <option>Website Updates / Maintenance</option>
  <option>Flyer / Promo Design</option>
  <option>Social Media Posts</option>
  <option>AI Template Setup</option>
  <option>Admin / Virtual Assistance</option>
  <option>Not sure yet</option>
  </select>
  </div>
  </div>
  
  <div>
  <label className="text-sm font-semibold text-slate-800">
  Goal / What should this help you do?
  </label>
  <textarea
  name="goal"
  required
  rows={4}
  placeholder="Example: I want more customers calling or booking online."
  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3"
  />
  </div>
  
  <div className="grid gap-5 md:grid-cols-2">
  <div>
  <label className="text-sm font-semibold text-slate-800">
  Do you have a logo/photos?
  </label>
  <select
  name="assets"
  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 bg-white"
  defaultValue="Not yet"
  >
  <option>Yes</option>
  <option>No</option>
  <option>Not yet</option>
  </select>
  </div>
  
  <div>
  <label className="text-sm font-semibold text-slate-800">
  Deadline (optional)
  </label>
  <input
  type="text"
  name="deadline"
  placeholder="Example: Next Friday"
  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3"
  />
  </div>
  </div>
  
  <div>
  <label className="text-sm font-semibold text-slate-800">
  Extra details (optional)
  </label>
  <textarea
  name="notes"
  rows={3}
  placeholder="Anything else I should know?"
  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3"
  />
  </div>
  
  <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 text-sm text-slate-600">
  <p className="font-semibold text-slate-900">What happens next?</p>
  <ul className="mt-2 list-disc pl-5 space-y-1">
  <li>I’ll reply with a clear quote + timeline.</li>
  <li>If you’re ready, we’ll confirm details and start.</li>
  <li>You’ll get updates as your project is built.</li>
  </ul>
  </div>
  
  <button
  type="submit"
  className="w-full rounded-xl bg-[var(--navy)] py-3 font-semibold text-white hover:opacity-90"
  >
  Submit Project Request →
  </button>
  
  <p className="text-xs text-slate-500 text-center">
  This goes directly to my inbox. Typical response time: within 24 hours.
  </p>
  </form>
  </section>
  
  {/* Contact Box (SECOND) */}
  <div className="grid gap-8 md:grid-cols-2">
  {/* Email Info */}
  <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm space-y-4">
  <h2 className="text-2xl font-black">Email Me Directly</h2>
  
  <p className="text-slate-600">The fastest way to reach me is by email:</p>
  
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
  
  {/* Quick Contact Form */}
  <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm space-y-4">
  <h2 className="text-2xl font-black">Quick Message</h2>
  
  <form
  action="https://formspree.io/f/mlgldrnk"
  method="POST"
  className="space-y-4"
  >
  <input type="hidden" name="form_type" value="Quick Message" />
  
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
  Messages go directly to my inbox. I typically respond within 24 hours.
  </p>
  </div>
  </div>
  </section>
  </main>
  );
  }
  