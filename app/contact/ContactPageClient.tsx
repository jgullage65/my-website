"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  const allowed = new Set(["Website Creation", "Website Updates / Maintenance", "Flyer / Promo Design", "Social Media Posts", "AI Setup", "Admin / Virtual Assistance", "Not sure yet"]);
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

export default function ContactPageClient() {
  const router = useRouter();
  const params = useSearchParams();
  const preService = normalizeService(params.get("service") || "");
  const prePreferred = normalizePreferred(params.get("preferred_contact") || params.get("preferred") || params.get("contact") || "");
  const prePhone = params.get("phone") || "";
  const preBusinessType = params.get("business_type") || params.get("business") || "";
  const preEmail = params.get("email") || "";

  const field = "contact-field mt-1 w-full rounded-xl border border-[rgba(212,175,55,.18)] bg-[#050b18] px-4 py-3 text-center text-white placeholder:text-center placeholder:text-white outline-none transition focus:border-[var(--gold)] focus:ring-2 focus:ring-[rgba(212,175,55,.18)]";
  const label = "block text-center text-sm font-semibold text-[var(--gold)]";
  const card = "flex min-h-0 w-full flex-1 flex-col rounded-none border-0 bg-[linear-gradient(180deg,rgba(8,14,34,0.99),rgba(3,7,19,0.99))] p-6 shadow-[0_30px_90px_rgba(0,0,0,.58),inset_0_1px_0_rgba(255,255,255,0.05)] sm:block sm:rounded-3xl sm:border sm:border-[rgba(212,175,55,.16)] sm:bg-[linear-gradient(145deg,rgba(9,16,32,.94),rgba(2,5,14,.98))] sm:p-8 sm:shadow-[0_24px_70px_rgba(0,0,0,.34)]";

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const html = document.documentElement;
    const { overflow: htmlOverflow, height: htmlHeight } = html.style;
    const { overflow: bodyOverflow, height: bodyHeight } = document.body.style;

    const updateScrollLock = () => {
      const shouldLock = mediaQuery.matches;
      html.style.overflow = shouldLock ? "hidden" : htmlOverflow;
      html.style.height = shouldLock ? "100%" : htmlHeight;
      document.body.style.overflow = shouldLock ? "hidden" : bodyOverflow;
      document.body.style.height = shouldLock ? "100%" : bodyHeight;
    };

    updateScrollLock();
    mediaQuery.addEventListener("change", updateScrollLock);

    return () => {
      mediaQuery.removeEventListener("change", updateScrollLock);
      html.style.overflow = htmlOverflow;
      html.style.height = htmlHeight;
      document.body.style.overflow = bodyOverflow;
      document.body.style.height = bodyHeight;
    };
  }, []);

  return (
    <main className="fixed inset-0 z-[81] flex h-[100dvh] w-screen touch-none flex-col overflow-hidden overscroll-none bg-[#030713] text-white sm:static sm:block sm:min-h-screen sm:w-auto sm:touch-auto sm:overflow-visible sm:overscroll-auto">
      <style jsx global>{`
        .contact-field:-webkit-autofill,
        .contact-field:-webkit-autofill:hover,
        .contact-field:-webkit-autofill:focus {
          -webkit-text-fill-color: #ffffff;
          caret-color: #ffffff;
          -webkit-box-shadow: 0 0 0 1000px #050b18 inset;
          box-shadow: 0 0 0 1000px #050b18 inset;
          transition: background-color 9999s ease-out 0s;
        }

        @media (max-width: 767px) {
          .contact-mobile-select {
            text-align: center;
            text-align-last: center;
          }

          .contact-mobile-select option {
            text-align: center;
          }
        }
      `}</style>

      <section className="flex min-h-0 w-full flex-1 flex-col sm:mx-auto sm:max-w-5xl sm:px-6 sm:py-16">
        <section className={card}>
          <header className="relative mb-10 space-y-3 text-center">
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Close contact form"
              className="absolute right-0 top-0 text-xl text-white/80 hover:text-white sm:hidden"
            >
              ✕
            </button>
            <h1 className="text-4xl font-black tracking-[-.045em] text-[var(--gold)] sm:text-5xl">Contact</h1>
            <p className="mx-auto max-w-2xl text-lg leading-8 text-[var(--muted)]">
              Ready to get started? Send a message and I’ll respond as soon as possible.
            </p>
          </header>

          <form action="https://formspree.io/f/mlgldrnk" method="POST" className="grid min-h-0 flex-1 touch-pan-y gap-5 overflow-y-auto overscroll-contain pr-1 sm:touch-auto sm:overflow-visible sm:overscroll-auto sm:pr-0">
            <input type="hidden" name="form_type" value="Project Request" />

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className={label}>Your Name</label>
                <input type="text" name="name" required placeholder="John Smith" className={field} />
              </div>

              <div>
                <label className={label}>Email</label>
                <input type="email" name="email" defaultValue={preEmail} required placeholder="you@email.com" className={field} />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className={label}>Phone (optional)</label>
                <input type="tel" name="phone" defaultValue={prePhone} placeholder="(555) 123-4567" className={field} />
              </div>

              <div>
                <label className={label}>Best way to follow up?</label>
                <select name="preferred_contact" className={`${field} contact-mobile-select`} defaultValue={prePreferred}>
                  <option value="Email">Email</option>
                  <option value="Text">Text</option>
                  <option value="Call">Call</option>
                </select>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className={label}>Business Name (optional)</label>
                <input type="text" name="business" placeholder="Your business" className={field} />
              </div>

              <div>
                <label className={label}>What type of business do you run? (optional)</label>
                <input type="text" name="business_type" defaultValue={preBusinessType} placeholder="Example: Cleaning service, coffee shop, barber" className={field} />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className={label}>What do you need?</label>
                <select name="service" required className={`${field} contact-mobile-select`} defaultValue={preService}>
                  <ServiceOptions />
                </select>
              </div>

              <div>
                <label className={label}>Deadline (optional)</label>
                <input type="text" name="deadline" placeholder="Example: Next Friday" className={field} />
              </div>
            </div>

            <div>
              <label className={label}>Goal / What should this help you do?</label>
              <textarea name="goal" required rows={4} placeholder="Example: I want more customers calling or booking online." className={field} />
            </div>

            <div className="flex justify-center">
              <button type="submit" className="rounded-xl border border-amber-300/15 bg-[#081226] px-8 py-2.5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-[#0b1830]">
                Submit Project Request
              </button>
            </div>

            <p className="text-center text-xs text-slate-500">
              This goes directly to my inbox. Typical response time: within 24 hours.
            </p>
          </form>
        </section>
      </section>
    </main>
  );
}
