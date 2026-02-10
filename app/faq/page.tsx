import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Frequently asked questions about websites, flyers, social content, and AI tools from JG Creative Studio.",
};

const sections: {
  title: string;
  emoji: string;
  items: { q: string; a: string }[];
}[] = [
  {
    title: "Getting started",
    emoji: "🚀",
    items: [
      {
        q: "What do you need from me to get started?",
        a: "Just the basics: your business name, what you do, your goal (calls, bookings, sales, leads), and any photos/logos you already have. If you don’t have branding yet, no problem — we can still build something clean and professional.",
      },
      {
        q: "What if I’m not sure what I need?",
        a: "Totally normal. Tell me your business + what you want to improve, and I’ll recommend the simplest setup that gets results (website, flyers, AI, or a combo).",
      },
      {
        q: "How fast can we start?",
        a: "Usually pretty quick — once you reach out, I’ll confirm scope + timeline and we can lock in your spot with a deposit.",
      },
    ],
  },
  {
    title: "Websites",
    emoji: "💻",
    items: [
      {
        q: "Do you build mobile-friendly sites?",
        a: "Yes — everything is mobile-first, fast, and designed to look legit on phones (where most customers will see you).",
      },
      {
        q: "Can you use my existing domain?",
        a: "Yep. If you already own a domain, we can connect it. If not, I can help you pick one and get it set up.",
      },
      {
        q: "Do you handle hosting and deployment?",
        a: "Yes. I can set up hosting, connect your domain, and make sure everything is live and working. If you prefer to own everything yourself, I’ll guide you through it.",
      },
      {
        q: "Can you update my site later?",
        a: "Absolutely. Small edits, new sections, new pages, seasonal promos — I can help as you grow.",
      },
    ],
  },
  {
    title: "Flyers + social content",
    emoji: "🎨",
    items: [
      {
        q: "What kinds of flyers can you design?",
        a: "Promos, events, menus, service lists, grand openings, specials, seasonal offers — anything that needs to look clean and easy to read fast.",
      },
      {
        q: "Do you make social posts too?",
        a: "Yes. I can create matching social graphics and simple post packs so your page stays consistent and professional.",
      },
      {
        q: "What if I don’t have photos or a logo?",
        a: "No worries. We can still design something clean using your business name, colors you like, and a simple layout — and you can add photos later when you have them.",
      },
    ],
  },
  {
    title: "AI tools + automations",
    emoji: "🤖",
    items: [
      {
        q: "What AI services do you offer?",
        a: "Practical stuff that saves time: website chatbots, lead capture flows, follow-up templates, review reply templates, caption systems, and simple automations for intake + responses.",
      },
      {
        q: "Is the chatbot a real AI like ChatGPT?",
        a: "It’s a smart site assistant built to guide visitors, answer common questions, and capture lead details. For many small businesses, that’s the sweet spot: simple, useful, and actually converts.",
      },
      {
        q: "Can AI help me get more leads?",
        a: "Yes — the biggest win is speed and clarity. Visitors get answers instantly, get routed to the right service, and you get better lead info to follow up faster.",
      },
      {
        q: "Do I need any subscriptions for AI tools?",
        a: "Sometimes no, sometimes yes — it depends on what we build. I’ll recommend the simplest option first, and only suggest paid tools if the upgrade actually matters for your business.",
      },
    ],
  },
  {
    title: "Pricing + process",
    emoji: "💰",
    items: [
      {
        q: "How does payment work?",
        a: "Typically: confirm scope → pay deposit → I build → you review → final payment (if applicable). Some smaller items can be paid all at once.",
      },
      {
        q: "Do you offer revisions?",
        a: "Yes. I keep the process simple: we do a clean first pass, then a review round to polish wording, layout, and details.",
      },
      {
        q: "How long does a project take?",
        a: "Depends on what you need. Flyers can be quick. Websites and AI setups depend on scope. I’ll give you a clear timeline before we start.",
      },
      {
        q: "Will I own my website and files?",
        a: "Yes. You’ll have access to your site and any final design files/exports that apply to the project. If you want everything fully in your accounts (domain/hosting), I’ll set it up that way.",
      },
    ],
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <summary className="cursor-pointer list-none">
        <div className="flex items-start justify-between gap-4">
          <p className="font-bold text-slate-900">{q}</p>
          <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 transition group-open:rotate-45">
            +
          </span>
        </div>
      </summary>
      <p className="mt-3 text-slate-600 leading-relaxed">{a}</p>
    </details>
  );
}

export default function FAQPage() {
  return (
    <main className="bg-slate-50">
      {/* HERO */}
      <section className="mx-auto max-w-6xl px-6 pt-14 pb-10">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 md:p-12 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">FAQ</p>
          <h1 className="mt-3 text-4xl md:text-6xl font-black tracking-tight text-slate-900">
            Quick answers
            <span className="block">before you reach out.</span>
          </h1>

          <p className="mt-5 max-w-2xl text-lg md:text-xl text-slate-600">
            Websites, flyers, social content, and AI tools — here’s what most people ask before
            starting.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-xl bg-[var(--navy)] px-7 py-3 font-semibold text-white hover:opacity-90"
            >
              Contact me →
            </Link>
            <Link
              href="/services"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-7 py-3 font-semibold text-slate-900 hover:bg-slate-100"
            >
              View services
            </Link>
          </div>

          <p className="mt-4 text-sm text-slate-500">
            Still unsure? Send your business type + goal and I’ll recommend the simplest setup.
          </p>
        </div>
      </section>

      {/* FAQ SECTIONS */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-8">
          {sections.map((sec) => (
            <div
              key={sec.title}
              className="rounded-3xl border border-slate-200 bg-white p-7 md:p-9 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">{sec.emoji}</div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900">
                  {sec.title}
                </h2>
              </div>

              <div className="mt-6 grid gap-4">
                {sec.items.map((it) => (
                  <FAQItem key={it.q} q={it.q} a={it.a} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-10 rounded-3xl bg-[var(--navy)] text-white p-10 md:p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-black">
            Want the simplest plan for your business?
          </h2>
          <p className="mt-3 text-white/80 max-w-2xl mx-auto">
            Tell me what you do and what you want more of — calls, bookings, orders, or leads — and
            I’ll point you to the best option.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/contact"
              className="rounded-xl bg-[var(--gold)] px-8 py-3 font-semibold text-[var(--navy)] hover:opacity-90"
            >
              Start now →
            </Link>
            <Link
              href="/pricing"
              className="rounded-xl border border-white/30 bg-transparent px-8 py-3 font-semibold hover:bg-white/10"
            >
              View pricing
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}