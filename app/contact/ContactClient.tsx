"use client";

import { useSearchParams } from "next/navigation";

const inputClass = "mt-1 w-full rounded-xl border border-[rgba(212,175,55,.18)] bg-[#050b18] px-4 py-3 text-white placeholder:text-slate-500 outline-none transition focus:border-[var(--gold)] focus:ring-2 focus:ring-[rgba(212,175,55,.18)]";
const bareInputClass = inputClass.replace("mt-1 ", "");
const labelClass = "text-sm font-semibold text-slate-200";
const cardClass = "rounded-3xl border border-[rgba(212,175,55,.16)] bg-[linear-gradient(145deg,rgba(9,16,32,.94),rgba(2,5,14,.98))] p-8 shadow-[0_24px_70px_rgba(0,0,0,.34)]";

function normalizePreferred(raw: string) {
  const v = decodeURIComponent(raw || "").trim().toLowerCase();
  if (["text", "sms"].includes(v)) return "Text";
  if (["phone", "call"].includes(v)) return "Call";
  if (["email", "e-mail", "mail"].includes(v)) return "Email";
  return "Email";
}

function normalizeService(raw: string) {
  const v = (raw || "").trim().toLowerCase();

  if (["website", "web", "site"].includes(v)) return "Website Creation";
  if (["flyers", "flyer", "social", "flyers / social", "flyers and social", "design"].includes(v)) return "Flyer / Promo Design";
  if (["ai", "ai setup", "ai templates", "ai business solutions"].includes(v)) return "AI Setup";
  if (["maintenance", "updates", "website updates"].includes(v)) return "Website Updates / Maintenance";
  if (["admin", "virtual assistance"].includes(v)) return "Admin / Virtual Assistance";

  const exact = (raw || "").trim();
  const allowed = new Set([
    "Website Creation",
    "Website Updates / Maintenance",
    "Flyer / Promo Design",
    "Social Media Posts",
    "AI Setup",
    "Admin / Virtual Assistance",
    "Not sure yet",
  ]);
  if (allowed.has(exact)) return exact;

  return "Not sure yet";
}

function ServiceOptions() {
  return (
    <>
      <option value="Website Creation">Website Creation</option>
      <option value="Website Updates / Maintenance">Website Updates / Maintenance</option>
      <option value="Flyer / Promo Design">Flyer / Promo Design</option>
      <option value="Social Media Posts">Social Media Posts</option>
      <option value="AI Setup">AI Setup</option>
      <option value="Admin / Virtual Assistance">Admin / Virtual Assistance</option>
      <option value="Not sure yet">Not sure yet</option>
    </>
  );
}

export default function ContactClient() {
  const params = useSearchParams();

  const preService = normalizeService(params.get("service") || "");
  const prePreferred = normalizePreferred(params.get("preferred_contact") || params.get("preferred") || params.get("contact") || "");
  const prePhone = params.get("phone") || "";
  const preBusinessType = params.get("business_type") || params.get("business") || "";
  const preEmail = params.get("email") || "";

  return (
    <main className="min-h-screen bg-[#030713] text-white">
      <section className="mx-auto max-w-5xl space-y-10 px-6 py-16">
        <header className="space-y-3 text-center">
          <p className="text-xs font-black uppercase tracking-[.32em] text-[var(--gold)]">Contact</p>
          <h1 className="text-4xl font-black tracking-[-.045em] sm:text-5xl">Contact JG Creative Studio</h1>
          <p className="mx-auto max-w-2xl text-lg leading-8 text-[var(--muted)]">
            Ready to get started? Send a message and I’ll respond as soon as possible.
          </p>
        </header>

        <section className={cardClass}>
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[.28em] text-[var(--gold)]">Project Request</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-.04em]">Tell me what you need.</h2>
            <p className="mx-auto mt-2 max-w-2xl text-[var(--muted)]">
              Want the fastest quote? Fill this out and I’ll reply with a clear price range and timeline.
            </p>
          </div>

          <form action="https://formspree.io/f/mlgldrnk" method="POST" className="mt-8 grid gap-5">
            <input type="hidden" name="form_type" value="Project Request" />

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className={labelClass}>Your Name</label>
                <input type="text" name="name" required placeholder="John Smith" className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>Email</label>
                <input type="email" name="email" defaultValue={preEmail} required placeholder="you@email.com" className={inputClass} />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className={labelClass}>Phone (optional)</label>
                <input type="tel" name="phone" defaultValue={prePhone} placeholder="(555) 123-4567" className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>Best way to follow up?</label>
                <select name="preferred_contact" className={inputClass} defaultValue={prePreferred}>
                  <option value="Email">Email</option>
                  <option value="Text">Text</option>
                  <option value="Call">Call</option>
                </select>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className={labelClass}>Business Name (optional)</label>
                <input type="text" name="business" placeholder="Your business" className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>What type of business do you run? (optional)</label>
                <input type="text" name="business_type" defaultValue={preBusinessType} placeholder="Example: Cleaning service, coffee shop, barber" className={inputClass} />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className={labelClass}>What do you need?</label>
                <select name="service" required className={inputClass} defaultValue={preService}>
                  <ServiceOptions />
                </select>
              </div>

              <div>
                <label className={labelClass}>Deadline (optional)</label>
                <input type="text" name="deadline" placeholder="Example: Next Friday" className={inputClass} />
              </div>
            </div>

            <div>
              <label className={labelClass}>Goal / What should this help you do?</label>
              <textarea name="goal" required rows={4} placeholder="Example: I want more customers calling or booking online." className={inputClass} />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className={labelClass}>Do you have a logo/photos?</label>
                <select name="assets" className={inputClass} defaultValue="Not yet">
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                  <option value="Not yet">Not yet</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Extra details (optional)</label>
                <textarea name="notes" rows={3} placeholder="Anything else I should know?" className={inputClass} />
              </div>
            </div>

            <div className="rounded-2xl border border-[rgba(212,175,55,.12)] bg-white/[.035] p-5 text-sm text-slate-300">
              <p className="font-semibold text-white">What happens next?</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>I’ll reply with a clear quote and timeline.</li>
                <li>If you’re ready, we’ll confirm details and start.</li>
                <li>You’ll get updates as your project is built.</li>
              </ul>
            </div>

            <button type="submit" className="w-full rounded-xl bg-[var(--gold)] py-3 font-black text-[#06101f] transition hover:-translate-y-0.5">
              Submit Project Request
            </button>

            <p className="text-center text-xs text-slate-500">
              This goes directly to my inbox. Typical response time: within 24 hours.
            </p>
          </form>
        </section>

        <div className="grid gap-8 md:grid-cols-2">
          <div className={`${cardClass} space-y-4`}>
            <h2 className="text-2xl font-black tracking-[-.035em]">Email Me Directly</h2>
            <p className="text-[var(--muted)]">The fastest way to reach me is by email:</p>
            <p className="text-lg font-semibold text-[var(--gold)]">
              <a href="mailto:hello@jgcreativestudios.com" className="hover:underline">
                hello@jgcreativestudios.com
              </a>
            </p>
            <p className="text-[var(--muted)]">
              Tell me what kind of business you run and what you need help with — website, flyers, social content, or AI systems.
            </p>
          </div>

          <div className={`${cardClass} space-y-4`}>
            <h2 className="text-2xl font-black tracking-[-.035em]">Quick Message</h2>

            <form action="https://formspree.io/f/mlgldrnk" method="POST" className="space-y-4">
              <input type="hidden" name="form_type" value="Quick Message" />
              <input type="text" name="name" placeholder="Your Name" required className={bareInputClass} />
              <input type="email" name="email" placeholder="Your Email" required className={bareInputClass} />
              <input type="tel" name="phone" defaultValue={prePhone} placeholder="Phone (optional)" className={bareInputClass} />
              <select name="preferred_contact" className={bareInputClass} defaultValue={prePreferred}>
                <option value="Email">Email</option>
                <option value="Text">Text</option>
                <option value="Call">Call</option>
              </select>
              <select name="service" className={bareInputClass} defaultValue={preService}>
                <ServiceOptions />
              </select>
              <textarea name="message" placeholder="Tell me what you need help with..." required rows={5} className={bareInputClass} />
              <button type="submit" className="w-full rounded-xl bg-[var(--gold)] py-3 font-black text-[#06101f] transition hover:-translate-y-0.5">
                Send Message
              </button>
            </form>

            <p className="pt-2 text-xs text-slate-500">
              Messages go directly to my inbox. I typically respond within 24 hours.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
