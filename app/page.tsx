import Link from "next/link";

export const metadata = {
  title: "Premium Websites & AI Business Systems",
};

const services = [
  {
    title: "Premium Websites",
    eyebrow: "POSITIONING + PERFORMANCE",
    description:
      "Custom web experiences built around the way your business sells, earns trust, and turns attention into qualified action.",
    points: [
      "Custom responsive websites",
      "Strong business positioning",
      "Conversion-focused structure",
      "Performance and mobile quality",
    ],
  },
  {
    title: "AI Business Systems",
    eyebrow: "COPILOTS + AUTOMATION",
    description:
      "Purpose-built AI tools that support your team, answer faster, organize knowledge, and reduce repetitive work.",
    points: [
      "Custom copilots",
      "Support assistants",
      "Internal knowledge tools",
      "AI-assisted workflows",
      "Business automation",
    ],
  },
  {
    title: "Growth Technology",
    eyebrow: "TOOLS + OPERATIONS",
    description:
      "Custom software for the operational layer of your business, from lead systems to dashboards and workflow tools.",
    points: [
      "Dashboards",
      "Lead systems",
      "Workflow tools",
      "Internal business software",
      "Custom operational systems",
    ],
  },
];

const proof = [
  "Complex SaaS products",
  "AI copilots",
  "Lead intelligence systems",
  "Business dashboards",
  "Workflow automation",
];

const process = [
  {
    step: "01",
    title: "Understand the business",
    text: "We identify your offer, audience, sales process, bottlenecks, and the business outcome the build needs to support.",
  },
  {
    step: "02",
    title: "Design the right solution",
    text: "We map the website, AI system, automation, or custom tool around a clear strategy instead of forcing a generic template.",
  },
  {
    step: "03",
    title: "Build and refine",
    text: "We turn the plan into a polished, responsive product and refine structure, copy, flow, and usability as it comes together.",
  },
  {
    step: "04",
    title: "Launch and support",
    text: "We prepare the experience for real users, launch cleanly, and keep the door open for improvements after release.",
  },
];

function CheckIcon() {
  return (
    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[rgba(212,175,55,0.38)] bg-[rgba(212,175,55,0.12)] text-[10px] font-black text-[var(--gold)]">
      ✓
    </span>
  );
}

export default function HomePage() {
  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-[rgba(245,158,11,0.13)] blur-3xl" />
        <div className="absolute right-[-10rem] top-[30rem] h-[28rem] w-[28rem] rounded-full bg-[rgba(212,175,55,0.08)] blur-3xl" />
      </div>

      <section className="mx-auto grid w-full max-w-[90rem] gap-10 px-6 pb-16 pt-16 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:px-10 lg:pb-24 lg:pt-24">
        <div className="flex flex-col justify-center">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-[var(--gold)]">
            JG CREATIVE STUDIO
          </p>
          <h1 className="mt-5 max-w-5xl text-5xl font-black tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl xl:text-8xl">
            Premium Websites.
            <span className="block text-transparent bg-clip-text bg-[linear-gradient(180deg,#ffffff,#d4af37)]">
              Intelligent Business Systems.
            </span>
          </h1>
          <p className="mt-7 max-w-3xl text-lg leading-8 text-[var(--muted)] sm:text-xl">
            JG Creative Studio builds high-performance websites, custom AI
            tools, automation, and growth systems for businesses that need more
            than a brochure page.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(180deg,#e1bd45,#b88c1f)] px-7 py-4 text-sm font-black text-[#07101f] shadow-[0_20px_44px_rgba(212,175,55,0.22),inset_0_1px_0_rgba(255,255,255,0.38)] transition hover:-translate-y-0.5"
            >
              Start a Project
            </Link>
            <Link
              href="#leadforge"
              className="inline-flex items-center justify-center rounded-2xl border border-[rgba(212,175,55,0.32)] bg-[rgba(14,22,62,0.68)] px-7 py-4 text-sm font-black text-white shadow-[0_18px_40px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:-translate-y-0.5 hover:border-[rgba(245,158,11,0.58)]"
            >
              Explore LEADFORGE
            </Link>
          </div>
        </div>

        <div className="relative rounded-[2rem] border border-[rgba(212,175,55,0.24)] bg-[linear-gradient(145deg,rgba(17,27,72,0.94),rgba(6,10,30,0.98))] p-5 shadow-[0_36px_90px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-7">
          <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-[rgba(245,158,11,0.22)] blur-2xl" />
          <div className="relative rounded-[1.5rem] border border-white/[0.07] bg-[#07101f]/80 p-5">
            <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] pb-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--gold)]">Business command layer</p>
                <p className="mt-2 text-2xl font-black text-white">Website + AI + Growth Systems</p>
              </div>
              <span className="rounded-full border border-[rgba(212,175,55,0.28)] px-3 py-1 text-xs font-bold text-[var(--gold)]">LIVE READY</span>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {["Position", "Capture", "Automate", "Scale"].map((item) => (
                <div key={item} className="rounded-2xl border border-[rgba(212,175,55,0.16)] bg-white/[0.04] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <p className="text-sm font-black text-white">{item}</p>
                  <div className="mt-4 h-2 rounded-full bg-white/[0.08]">
                    <div className="h-2 rounded-full bg-[linear-gradient(90deg,#d4af37,#f59e0b)]" style={{ width: item === "Scale" ? "68%" : "86%" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[90rem] px-6 py-14 sm:px-8 lg:px-10">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--gold)]">Core services</p>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">Premium builds for the parts of your business customers and teams actually use.</h2>
        </div>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {services.map((service) => (
            <article key={service.title} className="rounded-[1.75rem] border border-[rgba(212,175,55,0.22)] bg-[linear-gradient(145deg,rgba(17,27,72,0.9),rgba(7,16,31,0.96))] p-7 shadow-[0_28px_70px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:-translate-y-1 hover:border-[rgba(245,158,11,0.45)]">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--gold)]">{service.eyebrow}</p>
              <h3 className="mt-4 text-2xl font-black text-white">{service.title}</h3>
              <p className="mt-4 leading-7 text-[var(--muted)]">{service.description}</p>
              <ul className="mt-6 space-y-3 text-sm font-semibold text-slate-200">
                {service.points.map((point) => (
                  <li key={point} className="flex gap-3"><CheckIcon /> <span>{point}</span></li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section id="leadforge" className="mx-auto w-full max-w-[90rem] px-6 py-16 sm:px-8 lg:px-10">
        <div className="overflow-hidden rounded-[2rem] border border-[rgba(212,175,55,0.28)] bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.18),transparent_28rem),linear-gradient(145deg,rgba(17,27,72,0.98),rgba(4,8,24,0.98))] p-7 shadow-[0_38px_100px_rgba(0,0,0,0.48),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-10 lg:p-12">
          <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--gold)]">Flagship product</p>
              <h2 className="mt-4 text-5xl font-black tracking-[-0.055em] text-white sm:text-7xl">LEADFORGE</h2>
              <p className="mt-4 text-2xl font-black text-[var(--gold)]">Search Once. Discover Continuously.</p>
              <p className="mt-6 text-lg leading-8 text-[var(--muted)]">
                An AI-assisted territory discovery and sales intelligence platform for agencies. LEADFORGE shows the same thinking JG Creative Studio brings to client work: useful systems, premium interfaces, and software designed around real business motion.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/[0.08] bg-[#07101f]/72 p-5 sm:p-7">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-300">Agency workflow</p>
              <div className="mt-6 grid gap-3">
                {"Discover → Build Territory → Unlock Leads → Pitch → Win".split(" → ").map((item, index) => (
                  <div key={item} className="flex items-center gap-4 rounded-2xl border border-[rgba(212,175,55,0.16)] bg-white/[0.04] p-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(180deg,#e1bd45,#b88c1f)] text-sm font-black text-[#07101f]">{index + 1}</span>
                    <span className="font-black text-white">{item}</span>
                  </div>
                ))}
              </div>
              <Link
                href="/contact"
                className="mt-6 inline-flex items-center justify-center rounded-xl border border-[rgba(212,175,55,0.32)] bg-[rgba(212,175,55,0.1)] px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:border-[rgba(245,158,11,0.58)]"
              >
                Build a system like this →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[90rem] px-6 py-14 sm:px-8 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--gold)]">Proof of capability</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">Built by a studio shipping real production software.</h2>
            <p className="mt-5 leading-8 text-[var(--muted)]">
              JG Creative Studio is positioned around business assets that have to work in the real world. LEADFORGE is proof that the studio can design, build, and ship systems with product logic, data workflows, and premium user experiences.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {proof.map((item) => (
              <div key={item} className="rounded-2xl border border-[rgba(212,175,55,0.18)] bg-white/[0.045] p-5 shadow-[0_18px_44px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="mb-4 h-1.5 w-16 rounded-full bg-[linear-gradient(90deg,#d4af37,#f59e0b)]" />
                <p className="font-black text-white">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[90rem] px-6 py-14 sm:px-8 lg:px-10">
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--gold)]">Process</p>
          <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-5xl">A clear path from business problem to useful shipped system.</h2>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {process.map((item) => (
            <article key={item.step} className="rounded-[1.5rem] border border-[rgba(212,175,55,0.2)] bg-[rgba(14,22,62,0.62)] p-6 shadow-[0_22px_54px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.04)]">
              <p className="text-sm font-black text-[var(--gold)]">{item.step}</p>
              <h3 className="mt-4 text-xl font-black text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[90rem] px-6 pb-24 pt-12 sm:px-8 lg:px-10">
        <div className="rounded-[2rem] border border-[rgba(212,175,55,0.28)] bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.16),transparent_28rem),linear-gradient(145deg,rgba(17,27,72,0.92),rgba(6,10,30,0.98))] p-8 text-center shadow-[0_34px_90px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-12">
          <h2 className="mx-auto max-w-4xl text-3xl font-black tracking-tight text-white sm:text-5xl">Build something your business can actually use.</h2>
          <p className="mx-auto mt-5 max-w-2xl leading-8 text-[var(--muted)]">
            If you need a premium website, an AI-powered workflow, or a custom tool that improves how your business runs, start with a focused project request.
          </p>
          <Link href="/contact" className="mt-8 inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(180deg,#e1bd45,#b88c1f)] px-8 py-4 text-sm font-black text-[#07101f] shadow-[0_20px_44px_rgba(212,175,55,0.22),inset_0_1px_0_rgba(255,255,255,0.38)] transition hover:-translate-y-0.5">
            Start a Project →
          </Link>
        </div>
      </section>
    </main>
  );
}
