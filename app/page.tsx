import Link from "next/link";

export const metadata = {
  title: "Premium Websites & AI for Business",
  description:
    "JG Creative Studio builds premium websites, AI systems, and custom business tools, and is the creator of LEADFORGE.",
};

const services = [
  {
    title: "Custom Websites",
    description:
      "Premium websites built around your brand, your customers, and the action you want visitors to take.",
    points: ["Custom responsive design", "Clear business positioning", "Conversion-focused structure"],
  },
  {
    title: "AI for Business",
    description:
      "Useful AI systems that help businesses answer faster, support customers, organize knowledge, and automate repetitive work.",
    points: ["Custom copilots", "Support assistants", "Internal AI tools"],
  },
  {
    title: "Business Systems",
    description:
      "Custom tools and automation designed around the way your business actually operates.",
    points: ["Dashboards and portals", "Workflow automation", "Lead and operations tools"],
  },
];

const capabilities = [
  "AI copilots",
  "Customer support systems",
  "Business dashboards",
  "Lead intelligence",
  "Workflow automation",
  "Custom web applications",
];

export default function HomePage() {
  return (
    <main className="overflow-hidden">
      <section className="relative border-b border-white/[0.06]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[34rem] w-[52rem] -translate-x-1/2 rounded-full bg-[rgba(245,158,11,0.11)] blur-[140px]" />
        </div>

        <div className="relative mx-auto max-w-[90rem] px-6 pb-20 pt-20 text-center sm:px-8 lg:px-10 lg:pb-28 lg:pt-28">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-[var(--gold)]">
            JG Creative Studio
          </p>

          <h1 className="mx-auto mt-6 max-w-6xl text-5xl font-black leading-[0.96] tracking-[-0.06em] text-white sm:text-6xl lg:text-8xl">
            Premium websites.
            <span className="block bg-[linear-gradient(180deg,#ffffff_12%,#d4af37_100%)] bg-clip-text text-transparent">
              Intelligent AI for business.
            </span>
          </h1>

          <p className="mx-auto mt-7 max-w-3xl text-lg leading-8 text-[var(--muted)] sm:text-xl">
            We design high-performance websites, AI-powered business tools, and custom automation systems that help businesses attract customers, save time, and grow.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(180deg,#e2be48,#b78b1f)] px-7 py-4 text-sm font-black text-[#07101f] shadow-[0_18px_44px_rgba(212,175,55,0.24),inset_0_1px_0_rgba(255,255,255,0.4)] transition hover:-translate-y-0.5"
            >
              Start Your Project
            </Link>
            <Link
              href="#leadforge"
              className="inline-flex items-center justify-center rounded-2xl border border-[rgba(212,175,55,0.3)] bg-[linear-gradient(180deg,rgba(17,27,72,0.9),rgba(7,12,31,0.96))] px-7 py-4 text-sm font-black text-white shadow-[0_18px_44px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:-translate-y-0.5 hover:border-[rgba(245,158,11,0.55)]"
            >
              Explore LEADFORGE
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[90rem] px-6 py-20 sm:px-8 lg:px-10 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--gold)]">
            What we build
          </p>
          <h2 className="mt-4 text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl">
            The digital tools your business actually needs.
          </h2>
          <p className="mt-5 text-lg leading-8 text-[var(--muted)]">
            Every project is built around a real business goal, not a generic template or unnecessary technology.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {services.map((service, index) => (
            <article
              key={service.title}
              className="rounded-[1.8rem] border border-[rgba(212,175,55,0.2)] bg-[linear-gradient(145deg,rgba(17,27,72,0.9),rgba(6,10,30,0.98))] p-7 shadow-[0_28px_70px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-8"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(212,175,55,0.28)] bg-[rgba(212,175,55,0.09)] text-sm font-black text-[var(--gold)]">
                0{index + 1}
              </div>
              <h3 className="mt-7 text-2xl font-black text-white">{service.title}</h3>
              <p className="mt-4 leading-7 text-[var(--muted)]">{service.description}</p>
              <ul className="mt-7 space-y-3 text-sm font-semibold text-slate-200">
                {service.points.map((point) => (
                  <li key={point} className="flex items-center gap-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--gold)] shadow-[0_0_12px_rgba(212,175,55,0.7)]" />
                    {point}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-white/[0.06] bg-white/[0.015]">
        <div className="mx-auto grid max-w-[90rem] gap-10 px-6 py-20 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-10 lg:py-24">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--gold)]">
              AI showcase
            </p>
            <h2 className="mt-4 text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl">
              More than chatbots.
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-[var(--muted)]">
              We build AI that fits into the way a business works: helping teams answer questions, support customers, organize information, and make better decisions.
            </p>
            <Link
              href="/ai-tools"
              className="mt-8 inline-flex items-center gap-2 text-sm font-black text-[var(--gold)] hover:text-[#f0ca50]"
            >
              Explore AI systems →
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {capabilities.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-[rgba(212,175,55,0.18)] bg-[linear-gradient(180deg,rgba(17,27,72,0.7),rgba(7,12,31,0.84))] p-5 shadow-[0_18px_44px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                <p className="font-black text-white">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="leadforge" className="mx-auto max-w-[90rem] px-6 py-20 sm:px-8 lg:px-10 lg:py-28">
        <div className="relative overflow-hidden rounded-[2.2rem] border border-[rgba(212,175,55,0.32)] bg-[linear-gradient(145deg,#10183a_0%,#070c1e_52%,#050918_100%)] p-8 shadow-[0_42px_120px_rgba(0,0,0,0.54),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-10 lg:p-14">
          <div className="pointer-events-none absolute -right-28 -top-28 h-96 w-96 rounded-full bg-[rgba(245,158,11,0.16)] blur-[110px]" />

          <div className="relative grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--gold)]">
                Built by JG Creative Studio
              </p>
              <h2 className="mt-4 text-5xl font-black tracking-[-0.06em] text-white sm:text-7xl">
                LEADFORGE
              </h2>
              <p className="mt-5 text-2xl font-black text-[var(--gold)]">
                Search Once. Discover Continuously.
              </p>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">
                An AI-assisted territory discovery and sales intelligence platform for agencies. LEADFORGE is proof that we do more than build websites—we create complete products, intelligent workflows, and business systems.
              </p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(180deg,#e2be48,#b78b1f)] px-6 py-4 text-sm font-black text-[#07101f] shadow-[0_18px_44px_rgba(212,175,55,0.22),inset_0_1px_0_rgba(255,255,255,0.4)]"
                >
                  Build Something Powerful
                </Link>
                <Link
                  href="/about"
                  className="inline-flex items-center justify-center rounded-2xl border border-[rgba(212,175,55,0.28)] bg-white/[0.035] px-6 py-4 text-sm font-black text-white"
                >
                  About the Studio
                </Link>
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-white/[0.08] bg-[#070d20]/86 p-6 shadow-[0_26px_70px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-8">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                The LEADFORGE workflow
              </p>
              <div className="mt-6 space-y-3">
                {["Discover", "Build Territory", "Unlock Leads", "Pitch", "Win"].map((step, index) => (
                  <div
                    key={step}
                    className="flex items-center gap-4 rounded-2xl border border-[rgba(212,175,55,0.16)] bg-white/[0.035] p-4"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(180deg,#e2be48,#b78b1f)] text-sm font-black text-[#07101f]">
                      {index + 1}
                    </span>
                    <span className="font-black text-white">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[90rem] px-6 pb-24 sm:px-8 lg:px-10">
        <div className="rounded-[2rem] border border-[rgba(212,175,55,0.26)] bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.13),transparent_30rem),linear-gradient(145deg,rgba(17,27,72,0.9),rgba(6,10,30,0.98))] p-8 text-center shadow-[0_34px_90px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-12">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--gold)]">
            Ready to build
          </p>
          <h2 className="mx-auto mt-4 max-w-4xl text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl">
            Build the website or system your business should already have.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[var(--muted)]">
            Tell us what you are trying to improve, and we will recommend the right path.
          </p>
          <Link
            href="/contact"
            className="mt-8 inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(180deg,#e2be48,#b78b1f)] px-8 py-4 text-sm font-black text-[#07101f] shadow-[0_18px_44px_rgba(212,175,55,0.24),inset_0_1px_0_rgba(255,255,255,0.4)]"
          >
            Start Your Project
          </Link>
        </div>
      </section>
    </main>
  );
}
