"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function ContactPageClient() {
  const router = useRouter();
  const params = useSearchParams();
  const preEmail = params.get("email") || "";

  const field = "contact-field mt-2 w-full rounded-xl border border-white/[0.08] bg-[#050505] px-4 py-3 text-center text-white placeholder:text-center placeholder:text-slate-600 outline-none transition focus:border-white/[0.18] focus:ring-2 focus:ring-white/[0.05]";
  const label = "block text-center text-sm font-semibold text-slate-300";

  return (
    <main className="fixed inset-0 z-[81] min-h-dvh w-screen overflow-y-auto overscroll-contain bg-black text-white [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-[1200px]:static min-[1200px]:min-h-screen min-[1200px]:w-auto">
      <style jsx global>{`
        .contact-field:-webkit-autofill,
        .contact-field:-webkit-autofill:hover,
        .contact-field:-webkit-autofill:focus {
          -webkit-text-fill-color: #ffffff;
          caret-color: #ffffff;
          -webkit-box-shadow: 0 0 0 1000px #050505 inset;
          box-shadow: 0 0 0 1000px #050505 inset;
          transition: background-color 9999s ease-out 0s;
        }
      `}</style>

      <section className="flex min-h-dvh w-full items-start justify-center px-4 py-5 sm:items-center sm:py-10 min-[1200px]:px-6 min-[1200px]:py-16">
        <section className="relative w-full max-w-2xl bg-black px-1 pb-8 pt-10 sm:rounded-[28px] sm:border sm:border-white/[0.08] sm:bg-[#020202] sm:p-8 sm:shadow-[0_28px_90px_rgba(0,0,0,.55)]">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Close contact form"
            className="fixed right-4 top-4 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.1] bg-[#090909] text-xl text-white transition hover:border-white/[0.2] hover:bg-[#111111] sm:absolute"
          >
            ×
          </button>

          <header className="mx-auto max-w-xl text-center">
            <h1 className="text-3xl font-medium tracking-[-.04em] text-white sm:text-4xl">Contact</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base">Questions, concerns, or interested in collaborating? Send a message.</p>
          </header>

          <form action="https://formspree.io/f/mlgldrnk" method="POST" className="mt-8 grid gap-5">
            <input type="hidden" name="form_type" value="AI Builder Contact" />

            <div>
              <label className={label}>Name</label>
              <input type="text" name="name" required placeholder="Your name" className={field} />
            </div>

            <div>
              <label className={label}>Email</label>
              <input type="email" name="email" defaultValue={preEmail} required placeholder="you@email.com" className={field} />
            </div>

            <div>
              <label className={label}>Questions, concerns, or collaboration</label>
              <textarea name="message" required rows={7} placeholder="Tell us how we can help." className={`${field} resize-y text-left placeholder:text-left`} />
            </div>

            <div className="flex justify-center pt-1">
              <button type="submit" className="cta-raised inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-amber-300/20 bg-[#080808] px-6 py-3 text-sm font-black text-white shadow-[0_10px_24px_rgba(0,0,0,.28),inset_0_1px_0_rgba(255,255,255,.05)] transition duration-300 hover:-translate-y-0.5 hover:border-amber-300/35 hover:bg-[#111111] sm:w-auto sm:min-w-48">
                Send Message
              </button>
            </div>
          </form>
        </section>
      </section>
    </main>
  );
}
