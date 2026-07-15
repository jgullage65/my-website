import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Frequently asked questions about websites, flyers, social content, and AI systems from JG Creative Studio.",
};

const sections = [
  {
    number: "01",
    title: "Getting started",
    items: [
      {
        q: "What do you need from me to get started?",
        a: "Just the basics: your business name, what you do, your goal, and any photos or logos you already have. If you do not have branding yet, that is fine. We can still build something clean and professional.",
      },
      {
        q: "What if I am not sure what I need?",
        a: "That is completely normal. Tell me what your business does and what you want to improve, and I will recommend the simplest setup that makes sense.",
      },
      {
        q: "How fast can we start?",
        a: "Usually pretty quickly. Once you reach out, I will confirm the scope and timeline, then we can lock in the project with a deposit when needed.",
      },
    ],
  },
  {
    number: "02",
    title: "Websites",
    items: [
      {
        q: "Do you build mobile-friendly sites?",
        a: "Yes. Every website is built mobile-first, fast, and designed to look professional on the devices customers actually use.",
      },
      {
        q: "Can you use my existing domain?",
        a: "Yes. If you already own a domain, I can connect it. If not, I can help you choose one and get it set up.",
      },
      {
        q: "Do you handle hosting and deployment?",
        a: "Yes. I can set up hosting, connect the domain, and make sure everything is live and working correctly.",
      },
      {
        q: "Can you update my site later?",
        a: "Yes. I can handle edits, new sections, new pages, seasonal promotions, and ongoing improvements as your business grows.",
      },
    ],
  },
  {
    number: "03",
    title: "Creative support",
    items: [
      {
        q: "What kinds of flyers can you design?",
        a: "Promotions, events, menus, service lists, grand openings, specials, seasonal offers, and other materials that need to look clean and easy to understand quickly.",
      },
      {
        q: "Do you make social posts too?",
        a: "Yes. I can create matching social graphics and simple post packs so your content stays consistent and professional.",
      },
      {
        q: "What if I do not have photos or a logo?",
        a: "That is not a problem. We can still create a strong design using your business name, a clear message, and a simple visual direction.",
      },
    ],
  },
  {
    number: "04",
    title: "AI systems and automation",
    items: [
      {
        q: "What AI services do you offer?",
        a: "Custom copilots, support assistants, internal knowledge systems, workflow automation, lead capture, follow-up systems, dashboards, portals, integrations, and other practical tools built around the business.",
      },
      {
        q: "Is this just a chatbot?",
        a: "No. A chatbot can be one part of a larger system, but the focus is building useful software and automation that supports real workflows.",
      },
      {
        q: "Can AI help me get more leads?",
        a: "It can help you respond faster, qualify requests, organize information, and route people into the right next step so fewer opportunities are missed.",
      },
      {
        q: "Will I need extra subscriptions?",
        a: "Sometimes, depending on what is being built. I will always recommend the simplest option first and explain any ongoing costs before the project starts.",
      },
    ],
  },
  {
    number: "05",
    title: "Pricing and process",
    items: [
      {
        q: "How does payment work?",
        a: "Usually we confirm the scope, collect the required deposit, complete the build, review it together, and then handle any remaining balance. Some smaller services can be paid in full upfront.",
      },
      {
        q: "Do you offer revisions?",
        a: "Yes. The project includes a clear review process so wording, layout, and details can be polished before completion.",
      },
      {
        q: "How long does a project take?",
        a: "It depends on the scope. Smaller design work can move quickly, while websites and custom systems take longer. You will receive a clear timeline before work begins.",
      },
      {
        q: "Will I own my website and files?",
        a: "Yes. You will have access to the website and the final files that apply to your project. Domains and hosting can also be placed in your own accounts.",
      },
    ],
  },
] as const;

function FAQItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group border-t border-white/[.08] first:border-t-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-5 text-left">
        <span className="text-base font-black leading-6 text-white sm:text-lg">{q}</span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[rgba(212,175,55,.24)] bg-white/[.035] text-lg font-black text-[var(--gold)] transition group-open:rotate-45">
          +
        </span>
      </summary>
      <p className="max-w-3xl pb-5 pr-10 text-sm leading-7 text-[var(--muted)] sm:text-base">
        {a}
      </p>
    </details>
  );
}

export default function FAQPage() {
  return (
    <main className="bg-[#030713] text-white">
      <section className="relative overflow-hidden border-b border-[rgba(212,175,55,.10)]">
        <div className="absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(circle_at_18%_18%,rgba(212,175,55,.15),transparent_24rem),radial-gradient(circle_at_82%_10%,rgba(14,22,62,.7),transparent_34rem)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,.025)_1px,transparent_1px)] bg-[size:72px_72px] opacity-20" />
        <div className="relative mx-auto max-w-[94rem] px-5 py-16 text-center sm:px-8 sm:py-20 lg:px-10">
          <p className="text-xs font-black uppercase tracking-[.32em] text-[var(--gold)]">FAQ</p>
          <h1 className="mx-auto mt-4 max-w-4xl text-4xl font-black leading-[1] tracking-[-.055em] sm:text-6xl">
            Quick answers before you reach out.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-[var(--muted)] sm:text-lg">
            Clear answers about websites, creative support, AI systems, pricing, and how projects work.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-lg bg-[linear-gradient(180deg,#ffd56a,#c89426)] px-5 py-3 text-sm font-black text-[#06101f] shadow-[0_18px_48px_rgba(212,175,55,.24),inset_0_1px_0_rgba(255,255,255,.55)] transition hover:-translate-y-0.5"
            >
              Contact JG Creative Studio
            </Link>
            <Link
              href="/services"
              className="inline-flex items-center justify-center rounded-lg border border-[rgba(212,175,55,.42)] bg-[#081226]/80 px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/[.06]"
            >
              View Services
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-16 sm:px-8 lg:px-10 lg:py-20">
        <div className="space-y-6">
          {sections.map((section) => (
            <section
              key={section.number}
              className="rounded-[1.35rem] border border-[rgba(212,175,55,.13)] bg-[linear-gradient(145deg,rgba(9,16,32,.94),rgba(2,5,14,.98))] p-6 shadow-[0_28px_80px_rgba(0,0,0,.34)] sm:p-8"
            >
              <div className="flex items-start gap-4">
                <span className="pt-1 text-xs font-black tracking-[.18em] text-[var(--gold)]">
                  {section.number}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-2xl font-black tracking-[-.04em] text-white sm:text-3xl">
                    {section.title}
                  </h2>
                  <div className="mt-5">
                    {section.items.map((item) => (
                      <FAQItem key={item.q} q={item.q} a={item.a} />
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
